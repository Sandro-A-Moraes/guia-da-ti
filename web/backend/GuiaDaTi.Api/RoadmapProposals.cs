using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

public record RoadmapSource(string Sha, JsonElement Roadmap);

// Proposals to create or change a community roadmap. Each one becomes a PR in the catalog repository.
public sealed class RoadmapProposals(IHttpClientFactory clients, IConfiguration configuration, RoadmapContributors contributors, ILogger<RoadmapProposals> logger, ContributionImages? images = null)
{
    public const int OpenProposalLimit = 3;
    private readonly string repository = configuration["DISCUSSIONS_REPOSITORY"] ?? "guia-da-ti/guia-da-ti-dados";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<ContributionResult> Submit(string token, string login, RoadmapDraft draft, Catalog catalog, CancellationToken cancellation)
    {
        RoadmapRules.Validate(draft, catalog, images);
        var editing = draft.Slug is not null;
        string slug;
        if (editing) {
            slug = draft.Slug!;
            if (!IsCommunityRoadmap(catalog, slug)) throw new ContributionRejectedException("Esse roadmap não existe ou não é da comunidade.");
            if (string.IsNullOrWhiteSpace(draft.BaseSha)) throw new ContributionRejectedException("Abra o editor de novo para editar a versão mais recente do roadmap.");
        } else {
            slug = RoadmapRules.SlugFor(draft.Name);
            if (catalog.Resources.Any(r => r.Type == "roadmaps" && r.Slug == slug)) throw new ContributionRejectedException("Já existe um roadmap com esse nome.");
        }
        await EnforceLimit(token, login, cancellation);
        var resource = RoadmapRules.ToResource(draft, slug, DateTime.UtcNow.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        var path = $"data/roadmaps/{slug}.json";
        RoadmapData? before = null;
        string? creator = null;
        if (editing) {
            var current = await Read(token, slug, cancellation) ?? throw new ContributionRejectedException("Esse roadmap não existe mais no catálogo.");
            if (current.Sha != draft.BaseSha) throw ChangedSince();
            before = current.Roadmap.TryGetProperty("roadmap", out var block) ? block.Deserialize<RoadmapData>(JsonOptions) : null;
            creator = await Creator(slug, cancellation);
        }
        var body = new StringBuilder(editing ? "Edição de roadmap enviada pelo Guia da TI para revisão dos mantenedores.\n\n" : "Roadmap novo enviado pelo Guia da TI para revisão dos mantenedores.\n\n");
        body.Append("**O que muda**\n\n");
        foreach (var line in RoadmapDiff.Summarize(before, draft.Roadmap)) body.Append("- ").Append(line).Append('\n');
        if (SiteLink(slug) is { } link) body.Append($"\n**Página no Guia:** {link}\n");
        if (creator is not null && !string.Equals(creator, login, StringComparison.OrdinalIgnoreCase)) body.Append($"\ncc @{creator}, que criou este roadmap. Conte o que acha desta mudança.\n");
        var change = new ProposalChange(path, $"contributions/roadmap-{slug}", $"catalog: {(editing ? "update" : "add")} roadmap {slug}",
            $"Roadmap: {(editing ? "atualizar" : "adicionar")} {resource.Name}", body.ToString(), resource, editing ? draft.BaseSha : null,
            RejectExisting: !editing, ExistsMessage: "Já existe um roadmap com esse nome.");
        return new(await new CatalogProposalWriter(clients, configuration, images).PublishChange(token, change, cancellation));
    }

    // Current file in main, read with the visitor's credential. Null when it does not exist.
    public async Task<RoadmapSource?> Read(string token, string slug, CancellationToken cancellation)
    {
        if (!Regex.IsMatch(repository, @"^[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+$")) throw new DiscussionsUnavailableException();
        using var client = Client(token);
        using var response = await client.GetAsync($"repos/{repository}/contents/data/roadmaps/{slug}.json?ref={CatalogTargetBranch.Default}", cancellation);
        if (response.StatusCode == HttpStatusCode.NotFound) return null;
        response.EnsureSuccessStatusCode();
        using var file = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellation));
        var sha = file.RootElement.GetProperty("sha").GetString()!;
        var text = Encoding.UTF8.GetString(Convert.FromBase64String(file.RootElement.GetProperty("content").GetString()!));
        using var resource = JsonDocument.Parse(text);
        return new(sha, resource.RootElement.Clone());
    }

    public static bool IsCommunityRoadmap(Catalog catalog, string slug)
        => Regex.IsMatch(slug, @"^[a-z0-9]+(?:-[a-z0-9]+)*$") && slug.Length <= 80 && catalog.Resources.Any(r => r.Type == "roadmaps" && r.Slug == slug && r.Roadmap is not null);

    private static ContributionRejectedException ChangedSince()
        => new("Este roadmap mudou desde que você abriu o editor. Abra o editor de novo para trabalhar a partir da versão mais recente.");

    private async Task EnforceLimit(string token, string login, CancellationToken cancellation)
    {
        if (!Regex.IsMatch(login, @"^[A-Za-z0-9][A-Za-z0-9-]*$")) return;
        try {
            using var client = Client(token);
            var query = Uri.EscapeDataString($"repo:{repository} is:pr is:open author:{login} in:title \"Roadmap:\"");
            using var response = await client.GetAsync($"search/issues?q={query}&per_page=1", cancellation);
            response.EnsureSuccessStatusCode();
            using var found = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellation));
            if (found.RootElement.GetProperty("total_count").GetInt32() >= OpenProposalLimit)
                throw new ContributionRejectedException($"Você já tem {OpenProposalLimit} propostas de roadmap abertas. Aguarde a revisão de uma delas.");
        }
        catch (Exception error) when (error is HttpRequestException or JsonException or KeyNotFoundException or InvalidOperationException) {
            logger.LogWarning("Roadmap proposal limit could not be checked: {Reason}", error.GetType().Name);
        }
    }

    private async Task<string?> Creator(string slug, CancellationToken cancellation)
    {
        try { return (await contributors.GetAsync(slug, cancellation)).Creator?.Login; }
        catch (Exception error) when (error is HttpRequestException or JsonException or DiscussionsUnavailableException or KeyNotFoundException or InvalidOperationException) {
            logger.LogWarning("Roadmap creator could not be read: {Reason}", error.GetType().Name);
            return null;
        }
    }

    private string? SiteLink(string slug)
        => Uri.TryCreate(configuration["SITE_URL"], UriKind.Absolute, out var site) && site.Scheme == Uri.UriSchemeHttps && string.IsNullOrEmpty(site.UserInfo)
            ? $"{site.GetLeftPart(UriPartial.Authority)}/roadmaps/{slug}" : null;

    private HttpClient Client(string token)
    {
        var client = clients.CreateClient("discussions");
        client.BaseAddress = new("https://api.github.com/");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        client.DefaultRequestHeaders.UserAgent.ParseAdd("GuiaDaTi/1.0");
        client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
        return client;
    }
}
