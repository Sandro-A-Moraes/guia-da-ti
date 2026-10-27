using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

// A catalog file change prepared as a reviewed PR. BaseSha is set when the file already exists and is being edited.
public sealed record ProposalChange(string Path, string BranchPrefix, string CommitMessage, string PullTitle, string PullBody, ContributionResource Resource,
    string? BaseSha = null, bool RejectExisting = false, string ExistsMessage = "Esse cadastro já existe no catálogo.");

// Prepare a reviewed catalog change with the visitor's credential, never the read token.
public sealed class CatalogProposalWriter(IHttpClientFactory clients, IConfiguration configuration, ContributionImages? images = null)
{
    private readonly string repository = configuration["DISCUSSIONS_REPOSITORY"] ?? "guia-da-ti/guia-da-ti-dados";

    public Task<string> Publish(string token, ContributionResource resource, CancellationToken cancellation)
        => PublishChange(token, new($"data/{resource.Type}/{resource.Slug}.json", $"contributions/{resource.Slug}", $"catalog: add {resource.Slug}",
            $"Adicionar {resource.Name} ao catálogo", $"Sugestão de cadastro enviada pelo Guia da TI para revisão dos mantenedores.\n\n**Link:** {resource.Url}", resource), cancellation);

    public async Task<string> PublishChange(string token, ProposalChange change, CancellationToken cancellation)
    {
        var resource = change.Resource;
        if (!Regex.IsMatch(repository, @"^[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+$")) throw new DiscussionsUnavailableException();
        using var client = clients.CreateClient("discussions");
        client.BaseAddress = new("https://api.github.com/");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        client.DefaultRequestHeaders.UserAgent.ParseAdd("GuiaDaTi/1.0");
        client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
        var upstream = await Read(client, $"repos/{repository}", cancellation);
        if (upstream.GetProperty("private").GetBoolean()) throw new ContributionRejectedException("O catálogo precisa estar em um repositório público.");
        var baseBranch = CatalogTargetBranch.Default;
        var reference = await Read(client, $"repos/{repository}/git/ref/heads/{CatalogTargetBranch.ApiRef(baseBranch)}", cancellation);
        var sha = reference.GetProperty("object").GetProperty("sha").GetString();
        if (change.RejectExisting) {
            using var existingFile = await client.GetAsync($"repos/{repository}/contents/{change.Path}?ref={sha}", cancellation);
            if (existingFile.StatusCode != HttpStatusCode.NotFound) {
                existingFile.EnsureSuccessStatusCode();
                throw new ContributionRejectedException(change.ExistsMessage);
            }
        }
        var target = repository;
        var headOwner = repository.Split('/')[0];
        var writable = upstream.TryGetProperty("permissions", out var permissions) && permissions.TryGetProperty("push", out var push) && push.GetBoolean();
        if (!writable) {
            var user = await Read(client, "user", cancellation);
            headOwner = user.GetProperty("login").GetString()!;
            if (!Regex.IsMatch(headOwner, @"^[A-Za-z0-9][A-Za-z0-9-]*$")) throw new DiscussionsUnavailableException();
            target = $"{headOwner}/{repository.Split('/')[1]}";
            using var existing = await client.GetAsync($"repos/{target}", cancellation);
            if (existing.StatusCode == HttpStatusCode.NotFound) {
                using var fork = await client.PostAsJsonAsync($"repos/{repository}/forks", new { default_branch_only = true }, cancellation);
                fork.EnsureSuccessStatusCode();
                using var forkJson = JsonDocument.Parse(await fork.Content.ReadAsStringAsync(cancellation));
                target = forkJson.RootElement.GetProperty("full_name").GetString()!;
                if (!target.StartsWith(headOwner + "/", StringComparison.OrdinalIgnoreCase) || !Regex.IsMatch(target, @"^[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+$")) throw new DiscussionsUnavailableException();
            } else existing.EnsureSuccessStatusCode();
            // Fork creation is asynchronous; check identity before any branch/file writes.
            JsonElement forkMetadata = default;
            for (var attempt = 0; attempt < 6; attempt++) {
                using var ready = await client.GetAsync($"repos/{target}", cancellation);
                if (ready.IsSuccessStatusCode) {
                    using var data = JsonDocument.Parse(await ready.Content.ReadAsStringAsync(cancellation));
                    forkMetadata = data.RootElement.Clone();
                    if (forkMetadata.TryGetProperty("source", out _)) break;
                } else if (ready.StatusCode != HttpStatusCode.NotFound) ready.EnsureSuccessStatusCode();
                if (attempt < 5) await Task.Delay(1000, cancellation);
            }
            if (forkMetadata.ValueKind != JsonValueKind.Object || !forkMetadata.TryGetProperty("source", out var source))
                throw new ContributionRejectedException("O GitHub ainda está preparando sua cópia do catálogo. Aguarde alguns segundos e envie novamente; os dados continuam no formulário.");
            if (forkMetadata.GetProperty("private").GetBoolean() || !forkMetadata.GetProperty("fork").GetBoolean()
                || !string.Equals(source.GetProperty("full_name").GetString(), repository, StringComparison.OrdinalIgnoreCase))
                throw new ContributionRejectedException("Já existe um repositório com esse nome na sua conta que não é uma cópia deste catálogo.");
        }
        var branch = $"{change.BranchPrefix}-{Guid.NewGuid():N}";
        // A new fork may exist before its Git objects are ready.
        for (var attempt = 0; ; attempt++) {
            using var created = await client.PostAsJsonAsync($"repos/{target}/git/refs", new { @ref = $"refs/heads/{branch}", sha }, cancellation);
            if (created.IsSuccessStatusCode) break;
            if (writable || attempt >= 5 || created.StatusCode is not (HttpStatusCode.NotFound or HttpStatusCode.UnprocessableEntity)) created.EnsureSuccessStatusCode();
            await Task.Delay(1000, cancellation);
        }
        if (images is not null) resource = await images.Publish(client, target, repository, branch, baseBranch, resource, cancellation);
        var content = Convert.ToBase64String(Encoding.UTF8.GetBytes(CatalogJson.Serialize(resource)));
        var write = new Dictionary<string, object> { ["message"] = change.CommitMessage, ["content"] = content, ["branch"] = branch };
        if (change.BaseSha is not null) write["sha"] = change.BaseSha;
        using var file = await client.PutAsJsonAsync($"repos/{target}/contents/{change.Path}", write, cancellation);
        if (change.BaseSha is not null && file.StatusCode is HttpStatusCode.Conflict or HttpStatusCode.UnprocessableEntity)
            throw new ContributionRejectedException("Este roadmap mudou desde que você abriu o editor. Abra o editor de novo para trabalhar a partir da versão mais recente.");
        file.EnsureSuccessStatusCode();
        using var pull = await client.PostAsJsonAsync($"repos/{repository}/pulls", new {
            title = change.PullTitle, head = $"{headOwner}:{branch}", @base = baseBranch,
            body = change.PullBody,
            maintainer_can_modify = false
        }, cancellation);
        pull.EnsureSuccessStatusCode();
        using var result = JsonDocument.Parse(await pull.Content.ReadAsStringAsync(cancellation));
        return result.RootElement.GetProperty("html_url").GetString()!;
    }

    private static async Task<JsonElement> Read(HttpClient client, string path, CancellationToken cancellation)
    {
        using var response = await client.GetAsync(path, cancellation);
        response.EnsureSuccessStatusCode();
        using var data = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellation));
        return data.RootElement.Clone();
    }
}
