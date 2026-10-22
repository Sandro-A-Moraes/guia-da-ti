using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);
var catalogPath = Path.GetFullPath(builder.Configuration["CATALOG_PATH"]
    ?? Path.Combine(builder.Environment.ContentRootPath, "../../..", "tools/catalog/dist/catalog.json"));
var json = await File.ReadAllTextAsync(catalogPath);
var catalog = JsonSerializer.Deserialize<Catalog>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web))
    ?? throw new InvalidDataException("Catálogo ausente. Execute a validação dos dados.");
if (catalog.Version != 1) throw new InvalidDataException("Versão de catálogo incompatível.");
builder.Services.AddSingleton(catalog);
builder.Services.AddHttpClient("discussions", client => client.Timeout = TimeSpan.FromSeconds(10));
builder.Services.AddSingleton<DiscussionsClient>();
builder.Services.AddSingleton<DiscussionWriter>();
builder.Services.AddSingleton<ContributionService>();
builder.Services.AddSingleton<ContributionImages>();
builder.Services.AddSingleton<ContributionNotifications>();
builder.Services.AddSingleton<ContributorsClient>();
builder.Logging.AddFilter("System.Net.Http.HttpClient.creator-profiles", LogLevel.None);
// Request logs include the query string, such as the OAuth callback code and state.
builder.Logging.AddFilter("Microsoft.AspNetCore.Hosting.Diagnostics", LogLevel.Warning);
builder.Services.AddHttpClient("creator-profiles", client => client.Timeout = TimeSpan.FromSeconds(8))
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false });
builder.Services.AddSingleton<CreatorProfiles>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<CommunityActivity>();
builder.Services.AddSingleton<StudyEngagement>();
builder.Services.AddSingleton<Advertising>();
builder.AddCommunityAuth();
var forwardedProxyIp = builder.Configuration["FORWARDED_PROXY_IP"];
builder.Services.Configure<ForwardedHeadersOptions>(options => {
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    if (!string.IsNullOrWhiteSpace(forwardedProxyIp)) {
        if (!IPAddress.TryParse(forwardedProxyIp, out var proxyIp))
            throw new InvalidOperationException("FORWARDED_PROXY_IP inválido.");
        options.KnownProxies.Add(proxyIp);
    }
});
var app = builder.Build();
app.UseForwardedHeaders();
// Only sent on HTTPS requests. Production requires FORWARDED_PROXY_IP so the proxy protocol is trusted.
if (!app.Environment.IsDevelopment()) app.UseHsts();
app.Use(async (context, next) => {
    if (context.Request.Path == "/" && int.TryParse(context.Request.Query["conversa"], out _)) {
        context.Response.Redirect("/forum" + context.Request.QueryString, permanent: true);
        return;
    }
    if (context.Request.Path.Value?.TrimEnd('/') == "/contribuir") {
        context.Response.Redirect("/?sugerir=" + Uri.EscapeDataString(context.Request.Query["categoria"].ToString()));
        return;
    }
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    // Radix menus/selects use inline positioning and scroll-lock styles. Scripts remain self-only.
    var frameAncestors = context.Request.Path == "/guia-animacoes/index.html" ? "'self'" : "'none'";
    context.Response.Headers["Content-Security-Policy"] = $"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; object-src 'none'; base-uri 'self'; frame-ancestors {frameAncestors}";
    await next();
});
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.MapCommunityAuth();
app.MapDiscussionWrites();
app.MapDiscussions();
app.MapContributions();
app.MapContributionImages();
app.MapContributionNotifications();
app.MapContributors();
app.MapCreatorProfiles();
app.MapCommunityActivity();
app.MapRegisteredUsers();
app.MapStudyEngagement();
app.MapDiscussionResourceContext();
app.MapAdvertising();
app.MapGet("/sobre", () => Results.Redirect("/", permanent: true));
app.MapGet("/apoiadores", () => Results.Redirect("/#apoiadores", permanent: true));
app.MapGet("/contribuidores", () => Results.Redirect("/#mantenedores", permanent: true));
app.MapGet("/mantenedores", () => Results.Redirect("/#mantenedores", permanent: true));
app.MapGet("/health", () => Results.Ok(new { status = "ok", resources = catalog.Resources.Length }));
app.MapGet("/api/resources", (string? q, string? type, int? page, int? pageSize) => {
    if (q?.Length > 200 || page is < 1 || pageSize is < 1 or > 100) return Results.BadRequest(new { error = "Parâmetros inválidos." });
    var tokens = Normalize(q ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries);
    var filtered = catalog.Resources.Where(r => (string.IsNullOrEmpty(type) || r.Type == type)
        && tokens.All(token => Normalize(string.Join(' ', new[] { r.Name, r.Summary, r.Description }.Concat(r.Areas).Concat(r.Technologies).Concat(r.Languages).Concat(r.Countries ?? []))).Contains(token))).ToArray();
    var current = page ?? 1; var size = pageSize ?? 24;
    return Results.Ok(new { total = filtered.Length, page = current, pageSize = size, items = filtered.Skip((int)Math.Min((long)(current - 1) * size, int.MaxValue)).Take(size) });
});
app.MapGet("/api/resources/{type}/{slug}", (string type, string slug) => {
    var resource = catalog.Resources.FirstOrDefault(r => r.Type == type && r.Slug == slug);
    return resource is null ? Results.NotFound() : Results.Ok(resource);
});
app.MapFallback(async context => {
    context.Response.StatusCode = 404;
    var notFound = Path.Combine(app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"), "404/index.html");
    if (File.Exists(notFound)) { context.Response.ContentType = "text/html; charset=utf-8"; await context.Response.SendFileAsync(notFound); }
});
app.Run();

static string Normalize(string value) => string.Concat(value.Normalize(NormalizationForm.FormD)
    .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)).ToLowerInvariant();

public record Catalog(int Version, Taxonomy Taxonomy, Resource[] Resources);
public record Taxonomy(string[] Areas, string[] Technologies, string[] Languages, string[] Types);
public record Resource(string Slug, string Type, string Name, string Summary, string Description, string Url,
    string[] Areas, string[] Technologies, string[] Languages, string UpdatedAt, bool Demo, string[]? Countries = null, CommunityLocation? CommunityLocation = null, string[]? CommunityPlatforms = null, string? CommunityModality = null, string[]? CreatorCategories = null, string? CommunityAudience = null, CommunityLink[]? CommunityLinks = null, CommunityMembers? CommunityMembers = null, string? UniversityType = null, string? ImageUrl = null, int? DiscussionNumber = null);
