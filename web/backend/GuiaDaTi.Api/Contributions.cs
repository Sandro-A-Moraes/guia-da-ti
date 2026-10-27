using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Antiforgery;

public sealed class ContributionService(IHttpClientFactory clients, IConfiguration configuration, ContributionImages? images = null)
{
    private readonly string repository = configuration["DISCUSSIONS_REPOSITORY"] ?? "guia-da-ti/guia-da-ti-dados";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    public async Task<ContributionResult> Submit(string token, ContributionDraft proposal, Catalog catalog, CancellationToken cancellation)
    {
        var slug = Slug(proposal.Name);
        var resource = Validate(proposal, catalog, slug);
        if (catalog.Resources.Any(r => r.Slug == slug && r.Type == proposal.Type || r.Url is not null && SameUrl(r.Url, resource.Url!)))
            throw new ContributionRejectedException("Esse recurso ou link já existe no catálogo.");
        return new(await new CatalogProposalWriter(clients, configuration, images).Publish(token, resource, cancellation));
    }

    public async Task<bool> CanApprove(string token, int number, CancellationToken cancellation)
    {
        var parts = repository.Split('/');
        var data = await Graph(token, """
            query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){viewerPermission discussion(number:$number){body}}}
            """, new { owner = parts[0], name = parts[1], number }, cancellation);
        var repo = data.GetProperty("repository");
        if (repo.ValueKind == JsonValueKind.Null) return false;
        var permission = repo.GetProperty("viewerPermission").GetString();
        var discussion = repo.GetProperty("discussion");
        return new[] { "WRITE", "MAINTAIN", "ADMIN" }.Contains(permission)
            && discussion.ValueKind == JsonValueKind.Object
            && Regex.IsMatch(discussion.GetProperty("body").GetString() ?? "", @"<!-- guia-da-ti:resource:v1:[A-Za-z0-9+/=]+ -->");
    }

    public async Task<string> Approve(string token, int number, Catalog catalog, CancellationToken cancellation)
    {
        var owner = repository.Split('/')[0]; var name = repository.Split('/')[1];
        var discussionData = await Graph(token, """
            query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){viewerPermission discussion(number:$number){title body url}}}
            """, new { owner, name, number }, cancellation);
        var repo = discussionData.GetProperty("repository");
        if (repo.ValueKind == JsonValueKind.Null || !new[] { "WRITE", "MAINTAIN", "ADMIN" }.Contains(repo.GetProperty("viewerPermission").GetString()))
            throw new ContributionRejectedException("A aprovação está disponível apenas para mantenedores com acesso de escrita ao repositório.");
        var discussion = repo.GetProperty("discussion");
        if (discussion.ValueKind == JsonValueKind.Null) throw new ContributionRejectedException("Conversa não encontrada.");
        var body = discussion.GetProperty("body").GetString() ?? "";
        var marker = Regex.Match(body, @"<!-- guia-da-ti:resource:v1:([A-Za-z0-9+/=]+) -->");
        if (!marker.Success) throw new ContributionRejectedException("Esta conversa não contém uma sugestão de recurso estruturada.");
        ContributionResource? resource;
        try { resource = JsonSerializer.Deserialize<ContributionResource>(Encoding.UTF8.GetString(Convert.FromBase64String(marker.Groups[1].Value)), JsonOptions); }
        catch (Exception error) when (error is FormatException or JsonException) { throw new ContributionRejectedException("Os dados da sugestão estão inválidos."); }
        if (resource is null) throw new ContributionRejectedException("Os dados da sugestão estão inválidos.");
        resource = Validate(resource.ToDraft(), catalog, resource.Slug) with { DiscussionNumber = number };
        if (catalog.Resources.Any(r => r.Slug == resource.Slug && r.Type == resource.Type || r.Url is not null && SameUrl(r.Url, resource.Url!)))
            throw new ContributionRejectedException("Esse recurso ou link já existe no catálogo.");

        var api = new Uri("https://api.github.com/");
        using var client = clients.CreateClient("discussions");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        client.DefaultRequestHeaders.UserAgent.ParseAdd("GuiaDaTi/1.0");
        var targetBranch = CatalogTargetBranch.Default;
        var branch = $"contributions/discussion-{number}";
        var refResponse = await client.GetAsync(new Uri(api, $"repos/{owner}/{name}/git/ref/heads/{CatalogTargetBranch.ApiRef(targetBranch)}"), cancellation);
        refResponse.EnsureSuccessStatusCode();
        using var refJson = JsonDocument.Parse(await refResponse.Content.ReadAsStringAsync(cancellation));
        var sha = refJson.RootElement.GetProperty("object").GetProperty("sha").GetString();
        using var createBranch = await client.PostAsJsonAsync(new Uri(api, $"repos/{owner}/{name}/git/refs"), new { @ref = $"refs/heads/{branch}", sha }, cancellation);
        if (!createBranch.IsSuccessStatusCode) throw new ContributionRejectedException("Não foi possível criar um branch de revisão. Verifique se esta sugestão já foi aprovada.");
        if (images is not null) resource = await images.Publish(client, repository, repository, branch, targetBranch, resource, cancellation);
        var path = $"data/{resource.Type}/{resource.Slug}.json";
        var content = Convert.ToBase64String(Encoding.UTF8.GetBytes(CatalogJson.Serialize(resource)));
        using var putFile = await client.PutAsJsonAsync(new Uri(api, $"repos/{owner}/{name}/contents/{path}"), new { message = $"catalog: add {resource.Slug}", content, branch }, cancellation);
        if (!putFile.IsSuccessStatusCode) throw new ContributionRejectedException("O arquivo do recurso não pôde ser criado. Confira se já existe no catálogo.");
        using var pull = await client.PostAsJsonAsync(new Uri(api, $"repos/{owner}/{name}/pulls"), new {
            title = $"Adicionar {resource.Name} ao catálogo", head = branch, @base = targetBranch,
            body = $"Cadastro revisado a partir da [conversa #{number}]({discussion.GetProperty("url").GetString()}).\n\nOs dados foram enviados originalmente no fórum e estão prontos para validação do catálogo."
        }, cancellation);
        if (!pull.IsSuccessStatusCode) throw new ContributionRejectedException("O cadastro foi preparado, mas o Pull Request não pôde ser aberto. Confira os branches no GitHub.");
        using var pullJson = JsonDocument.Parse(await pull.Content.ReadAsStringAsync(cancellation));
        return pullJson.RootElement.GetProperty("html_url").GetString()!;
    }

    private async Task<JsonElement> Graph(string token, string query, object variables, CancellationToken cancellation)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.github.com/graphql");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Headers.UserAgent.ParseAdd("GuiaDaTi/1.0"); request.Content = JsonContent.Create(new { query, variables });
        using var client = clients.CreateClient("discussions"); using var response = await client.SendAsync(request, cancellation);
        response.EnsureSuccessStatusCode(); using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellation));
        if (document.RootElement.TryGetProperty("errors", out _)) throw new ContributionRejectedException("Não foi possível verificar a conversa no GitHub.");
        return document.RootElement.GetProperty("data").Clone();
    }

    private ContributionResource Validate(ContributionDraft p, Catalog c, string slug)
    {
        if (p is null || string.IsNullOrWhiteSpace(p.Type) || !c.Taxonomy.Types.Contains(p.Type)
            || string.IsNullOrWhiteSpace(p.Name) || p.Name.Trim().Length is < 2 or > 100
            || string.IsNullOrWhiteSpace(p.Summary) || p.Summary.Trim().Length is < 10 or > 240
            || string.IsNullOrWhiteSpace(p.Description) || p.Description.Trim().Length is < 10 or > 4000
            || string.IsNullOrWhiteSpace(slug) || slug.Length > 80 || slug != Slug(p.Name) || !Regex.IsMatch(slug, @"^[a-z0-9]+(?:-[a-z0-9]+)*$"))
            throw new ContributionRejectedException("Confira a categoria, o nome, o resumo e a descrição.");
        if (!TryPublicHttps(p.Url, out var url))
            throw new ContributionRejectedException("Informe um link público seguro começando com https://.");
        if (p.Areas is null || p.Areas.Length < 1 || p.Areas.Length > 15 || p.Areas.Any(a => !c.Taxonomy.Areas.Contains(a)) || p.Technologies is null || p.Technologies.Length > 20 || p.Technologies.Any(t => !c.Taxonomy.Technologies.Contains(t)) || p.Languages is null || p.Languages.Length < 1 || p.Languages.Length > 15 || p.Languages.Any(l => !c.Taxonomy.Languages.Contains(l)))
            throw new ContributionRejectedException("Escolha assuntos, tecnologias e idiomas disponíveis no guia.");
        if (p.ImageUrl is { } imageUrl && !TryPublicHttps(imageUrl, out _))
            throw new ContributionRejectedException("Informe um link público da imagem começando com https://.");
        if (p.ImageUploadId is { } imageId) {
            if (p.ImageUrl is not null || images is null) throw new ContributionRejectedException("Envie um arquivo ou um link de imagem.");
            images.Require(imageId);
        }
        CreatorCategoryRules.ValidateContribution(p.Type, p.CreatorCategories);
        if (p.Type == "universities" && p.UniversityType is not ("public" or "private"))
            throw new ContributionRejectedException("Escolha se a faculdade é pública ou privada.");
        if (p.Type != "universities" && p.UniversityType is not null)
            throw new ContributionRejectedException("O tipo de instituição só se aplica a faculdades.");
        CommunityLocationRules.ValidateContribution(p.Type, p.CommunityLocation, p.CommunityPlatforms, p.CommunityModality, p.CommunityAudience, p.CommunityLinks, p.CommunityMembers);
        return new(slug, p.Type, p.Name.Trim(), p.Summary.Trim(), p.Description.Trim(), url.AbsoluteUri, p.Areas.Distinct().ToArray(), p.Technologies.Distinct().ToArray(), p.Languages.Distinct().ToArray(), DateTime.UtcNow.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), CommunityLocation: p.CommunityLocation, CommunityPlatforms: p.CommunityPlatforms, CommunityModality: p.CommunityModality, CreatorCategories: p.CreatorCategories, CommunityAudience:p.CommunityAudience, CommunityLinks:p.CommunityLinks, CommunityMembers:p.CommunityMembers, UniversityType:p.UniversityType, ImageUrl:p.ImageUrl, ImageUploadId:p.ImageUploadId);
    }
    internal static bool TryPublicHttps(string? value, out Uri uri)
    {
        uri = null!;
        if (string.IsNullOrWhiteSpace(value) || value.Length > 500 || !Uri.TryCreate(value, UriKind.Absolute, out var parsed)
            || parsed.Scheme != "https" || !parsed.IsDefaultPort || !string.IsNullOrEmpty(parsed.UserInfo) || !parsed.Host.Contains('.')
            || Regex.IsMatch(parsed.Host, @"(^localhost$|\.local$|\.localhost$|\.internal$|^[\d.]+$|:)", RegexOptions.IgnoreCase)) return false;
        uri = parsed;
        return true;
    }
    internal static string Slug(string value) => Regex.Replace(string.Concat((value ?? "").Normalize(NormalizationForm.FormD).Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)).ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
    private static bool SameUrl(string a, string b) { static string Key(string value) { var uri = new Uri(value); return uri.GetLeftPart(UriPartial.Path).TrimEnd('/').ToLowerInvariant(); } return Key(a) == Key(b); }
}

public record ContributionResult(string Url, ContributionNotice? Notice = null);

public record ContributionDraft(string Type, string Name, string Url, string Summary, string Description, string[] Areas, string[] Technologies, string[] Languages, CommunityLocation? CommunityLocation = null, string[]? CommunityPlatforms = null, string? CommunityModality = null, string[]? CreatorCategories = null, string? CommunityAudience = null, CommunityLink[]? CommunityLinks = null, CommunityMembers? CommunityMembers = null, string? UniversityType = null, string? ImageUrl = null, string? ImageUploadId = null);
public record ContributionResource(string Slug, string Type, string Name, string Summary, string Description, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Url, string[] Areas, string[] Technologies, string[] Languages, string UpdatedAt, bool Demo = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] CommunityLocation? CommunityLocation = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string[]? CommunityPlatforms = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? CommunityModality = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string[]? CreatorCategories = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? CommunityAudience = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] CommunityLink[]? CommunityLinks = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] CommunityMembers? CommunityMembers = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? UniversityType = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? ImageUrl = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? ImageUploadId = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? DiscussionNumber = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] RoadmapData? Roadmap = null)
{ public ContributionDraft ToDraft() => new(Type, Name, Url ?? "", Summary, Description, Areas, Technologies, Languages, CommunityLocation, CommunityPlatforms, CommunityModality, CreatorCategories, CommunityAudience, CommunityLinks, CommunityMembers, UniversityType, ImageUrl, ImageUploadId); }
public sealed class ContributionRejectedException(string message) : Exception(message);

public static class ContributionEndpoints
{
    public static void MapContributions(this WebApplication app)
    {
        app.MapPost("/api/contributions", async (ContributionDraft draft, HttpContext context, IAntiforgery csrf, ContributionService service, Catalog catalog, ContributionNotifications notices) => {
            if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
            try { await csrf.ValidateRequestAsync(context); } catch (AntiforgeryValidationException) { return Results.BadRequest(new { error = "Atualize a página e tente novamente." }); }
            var token = await context.GetTokenAsync("access_token"); if (string.IsNullOrEmpty(token)) return Results.Unauthorized();
            try { var result = await service.Submit(token, draft, catalog, context.RequestAborted); return Results.Ok(result with { Notice = notices.Publish(context.User.Identity!.Name!, draft, result) }); }
            catch (ContributionRejectedException error) { return Results.BadRequest(new { error = error.Message }); }
            catch (Exception error) when (error is HttpRequestException or JsonException or DiscussionsUnavailableException or InvalidOperationException or KeyNotFoundException or OperationCanceledException) { return Results.Json(new { error = "Não foi possível enviar a sugestão. Os dados continuam no formulário; tente novamente." }, statusCode: 503); }
        }).WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(65536));
        app.MapPost("/api/discussions/{number:int}/approve", async (int number, HttpContext context, IAntiforgery csrf, ContributionService service, Catalog catalog) => {
            if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
            try { await csrf.ValidateRequestAsync(context); } catch (AntiforgeryValidationException) { return Results.BadRequest(new { error = "Atualize a página e tente novamente." }); }
            var token = await context.GetTokenAsync("access_token"); if (string.IsNullOrEmpty(token)) return Results.Unauthorized();
            try { var url = await service.Approve(token, number, catalog, context.RequestAborted); return Results.Ok(new { url }); }
            catch (ContributionRejectedException error) { return Results.Json(new { error = error.Message }, statusCode: 403); }
            catch (Exception error) when (error is HttpRequestException or JsonException or InvalidOperationException or KeyNotFoundException or OperationCanceledException) { return Results.Json(new { error = "Não foi possível preparar o cadastro no GitHub." }, statusCode: 503); }
        }).WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(65536));
        app.MapGet("/api/discussions/{number:int}/approval-status", async (int number, HttpContext context, ContributionService service) => {
            context.Response.Headers.CacheControl = "no-store";
            if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
            var token = await context.GetTokenAsync("access_token"); if (string.IsNullOrEmpty(token)) return Results.Unauthorized();
            try { return Results.Ok(new { allowed = await service.CanApprove(token, number, context.RequestAborted) }); }
            catch (Exception error) when (error is HttpRequestException or JsonException or InvalidOperationException or KeyNotFoundException or OperationCanceledException) { return Results.Ok(new { allowed = false }); }
        });
    }
}
