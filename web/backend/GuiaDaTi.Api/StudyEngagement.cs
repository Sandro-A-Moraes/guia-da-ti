using System.Collections.Concurrent;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;

// Single-instance, server-side persistence, like RegisteredUsers. Never browser storage.
public sealed class StudyEngagement(IConfiguration configuration, IHostEnvironment environment,
    Catalog catalog, DiscussionsClient reader, DiscussionWriter writer)
{
    public static readonly HashSet<string> Types = ["courses", "platforms", "universities", "bootcamps", "roadmaps", "books", "certifications"];
    private readonly string path = Path.GetFullPath(configuration["STUDY_ACTIVITY_PATH"]
        ?? Path.Combine(environment.ContentRootPath, "App_Data", "study-activity.json"));
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly ConcurrentDictionary<string, SemaphoreSlim> resourceGates = new();
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    public Resource? Find(string type, string slug) => Types.Contains(type) ? catalog.Resources.FirstOrDefault(r => r.Type == type && r.Slug == slug) : null;
    public static string Key(Resource r) => r.Type + "/" + r.Slug;
    public static string TopicTitle(Resource r) => r.Name;
    public static string TopicBody(Resource r) => $"### {r.Name}\n\n{r.Summary}\n\n{r.Description}\n\n{(r.Url is null ? "" : $"**Link:** {r.Url}\n\n")}**Idiomas:** {string.Join(", ", r.Languages)}";

    public async Task<StudySummary[]> ListAsync(string? userId, CancellationToken cancellation)
    {
        Store store;
        await gate.WaitAsync(cancellation);
        try { store = await ReadAsync(cancellation); }
        finally { gate.Release(); }
        var commentCounts = new Dictionary<int, int>();
        var needed = store.Items.Values.Where(e => e.Discussion is not null).Select(e => e.Discussion!.Value)
            .Concat(catalog.Resources.Where(r => Types.Contains(r.Type) && r.DiscussionNumber is not null).Select(r => r.DiscussionNumber!.Value)).ToHashSet();
        var verified = false;
        if (needed.Count > 0 && reader.Configured) {
            try {
                string? cursor = null;
                do {
                    var page = await reader.ListAsync(null, cursor, cancellation);
                    foreach (var topic in page.Items.Where(d => needed.Contains(d.Number))) {
                        commentCounts[topic.Number] = topic.CommentCount;
                        needed.Remove(topic.Number);
                    }
                    cursor = page.PageInfo.HasNextPage ? page.PageInfo.EndCursor : null;
                } while (needed.Count > 0 && cursor is not null);
                verified = true;
            }
            catch (Exception e) when (e is HttpRequestException or JsonException or DiscussionsUnavailableException or InvalidOperationException or KeyNotFoundException or OperationCanceledException) {
                if (cancellation.IsCancellationRequested) throw;
            }
        }
        var result = new List<StudySummary>();
        foreach (var resource in catalog.Resources.Where(r => Types.Contains(r.Type))) {
            var entry = store.Items.GetValueOrDefault(Key(resource)) ?? new Entry();
            var linkedDiscussion = CurrentDiscussion(resource, entry);
            var discussion = verified && linkedDiscussion is int missing && needed.Contains(missing) ? null : linkedDiscussion;
            int? comments = discussion is null ? 0 : null;
            if (discussion is int number && commentCounts.TryGetValue(number, out var count)) comments = count;
            var ratings = entry.Votes.Values.Where(v => v.Rating is not null).Select(v => v.Rating!.Value).ToArray();
            var mine = userId is null ? null : entry.Votes.GetValueOrDefault(userId);
            result.Add(new(Key(resource), ratings.Length == 0 ? null : (double)ratings.Sum() / ratings.Length,
                ratings.Length, entry.Votes.Values.Count(v => v.Hype), comments, discussion, mine?.Rating, mine?.Hype ?? false));
        }
        return result.ToArray();
    }

    public async Task<Resource?> LinkedResourceAsync(int number, CancellationToken cancellation)
    {
        await gate.WaitAsync(cancellation);
        try {
            var store = await ReadAsync(cancellation);
            return catalog.Resources.FirstOrDefault(resource => Types.Contains(resource.Type)
                && CurrentDiscussion(resource, store.Items.GetValueOrDefault(Key(resource)) ?? new Entry()) == number);
        }
        finally { gate.Release(); }
    }

    public async Task<Dictionary<int, DiscussionResourceReference>> LinkedResourcesAsync(IEnumerable<int> numbers, CancellationToken cancellation)
    {
        var requested = numbers.Where(number => number > 0).ToHashSet();
        if (requested.Count == 0) return [];
        await gate.WaitAsync(cancellation);
        try {
            var store = await ReadAsync(cancellation);
            var linked = new Dictionary<int, DiscussionResourceReference>();
            foreach (var resource in catalog.Resources.Where(resource => Types.Contains(resource.Type))) {
                var discussion = CurrentDiscussion(resource, store.Items.GetValueOrDefault(Key(resource)) ?? new Entry());
                if (discussion is int number && requested.Contains(number))
                    linked.TryAdd(number, new(resource.Type, resource.Slug, resource.Name));
            }
            return linked;
        }
        finally { gate.Release(); }
    }

    private static int? CurrentDiscussion(Resource resource, Entry entry) =>
        entry.DiscussionOverride ? resource.DiscussionNumber : resource.DiscussionNumber ?? entry.Discussion;

    public async Task VoteAsync(Resource resource, string userId, StudyVote vote, CancellationToken cancellation)
    {
        if (!long.TryParse(userId, out var id) || id <= 0) throw new ArgumentException("Conta inválida.");
        if (vote.Rating is < 1 or > 5 || (vote.Rating is null && vote.Hype is null)) throw new ArgumentException("Escolha uma nota de 1 a 5 ou um hype.");
        await gate.WaitAsync(cancellation);
        try {
            var store = await ReadAsync(cancellation);
            var entry = store.Items.GetValueOrDefault(Key(resource)) ?? new Entry();
            var previous = entry.Votes.GetValueOrDefault(userId) ?? new Vote();
            entry.Votes[userId] = new(vote.Rating ?? previous.Rating, vote.Hype ?? previous.Hype);
            store.Items[Key(resource)] = entry;
            await WriteAsync(store, cancellation);
        }
        finally { gate.Release(); }
    }

    // Approved resources keep the suggestion's topic. Legacy topics start with the resource, never a visitor's comment.
    // Search recovers a successful GitHub write if saving the local mapping failed.
    public async Task<int> CommentAsync(Resource resource, string token, string body, CancellationToken cancellation)
    {
        if (string.IsNullOrWhiteSpace(body) || body.Length > 9000) throw new ArgumentException("Escreva um comentário de até 9.000 caracteres.");
        if (resource.Demo) throw new ArgumentException("Itens de exemplo não recebem comentários.");
        if (!reader.Configured) throw new DiscussionsUnavailableException();
        var key = Key(resource);
        var resourceGate = resourceGates.GetOrAdd(key, static _ => new SemaphoreSlim(1, 1));
        await resourceGate.WaitAsync(cancellation);
        try {
            var entry = await ReadEntryAsync(key, cancellation);
            entry.Discussion = resource.DiscussionNumber ?? (entry.DiscussionOverride ? null : entry.Discussion);
            entry.DiscussionOverride = false;
            if (entry.Discussion is int linked && await reader.ThreadAsync(linked, null, cancellation) is null)
                entry.Discussion = null;
            if (entry.Discussion is null && !entry.DiscussionOverride) {
                await reader.InvalidateAsync(cancellation);
                string? cursor = null;
                do {
                    // Read the repository directly: GitHub search indexing can lag behind a write.
                    var found = await reader.ListAsync(null, cursor, cancellation);
                    entry.Discussion = found.Items.FirstOrDefault(d => d.Title == $"[Estudar: {Key(resource)}] {resource.Name}")?.Number;
                    if (entry.Discussion is null) {
                        foreach (var candidate in found.Items.Where(d => d.Title == TopicTitle(resource) || d.Title == $"[Sugestão] {resource.Name}")) {
                            var topic = await reader.ThreadAsync(candidate.Number, null, cancellation);
                            if (resource.Url is not null && topic?.Body.Contains(resource.Url, StringComparison.OrdinalIgnoreCase) == true) { entry.Discussion = candidate.Number; break; }
                        }
                    }
                    cursor = found.PageInfo.HasNextPage ? found.PageInfo.EndCursor : null;
                } while (entry.Discussion is null && cursor is not null);
            }
            if (entry.Discussion is null) {
                entry.Discussion = await writer.PublishAsync(token, new(TopicBody(resource), Title: TopicTitle(resource), CategoryName: configuration["STUDY_DISCUSSION_CATEGORY"] ?? "Geral"), cancellation);
                await UpdateEntryAsync(key, current => {
                    current.Discussion = entry.Discussion;
                    return current;
                }, CancellationToken.None);
                await reader.InvalidateAsync(CancellationToken.None);
            }
            var number = await writer.PublishAsync(token, new(body, Number: entry.Discussion), cancellation);
            entry.Discussion = number;
            // Complete persistence even if the browser disconnects after GitHub accepted the write.
            await UpdateEntryAsync(key, current => {
                current.Discussion = entry.Discussion;
                return current;
            }, CancellationToken.None);
            await reader.InvalidateAsync(CancellationToken.None);
            return number;
        }
        finally { resourceGate.Release(); }
    }

    private async Task<Entry> ReadEntryAsync(string key, CancellationToken cancellation)
    {
        await gate.WaitAsync(cancellation);
        try {
            var store = await ReadAsync(cancellation);
            return store.Items.GetValueOrDefault(key) ?? new Entry();
        }
        finally { gate.Release(); }
    }

    private async Task UpdateEntryAsync(string key, Func<Entry, Entry> apply, CancellationToken cancellation)
    {
        await gate.WaitAsync(cancellation);
        try {
            var store = await ReadAsync(cancellation);
            var current = store.Items.GetValueOrDefault(key) ?? new Entry();
            store.Items[key] = apply(current);
            await WriteAsync(store, cancellation);
        }
        finally { gate.Release(); }
    }

    private async Task<Store> ReadAsync(CancellationToken cancellation)
    {
        if (!File.Exists(path)) return new Store();
        await using var stream = File.OpenRead(path);
        var store = await JsonSerializer.DeserializeAsync<Store>(stream, Options, cancellation);
        if (store is null || store.Version != 1 || store.Items is null || store.Items.Values.Any(e => e is null || e.Votes is null || e.Discussion is <= 0 || e.Votes.Any(v => !long.TryParse(v.Key, out var id) || id <= 0 || v.Value is null || v.Value.Rating is < 1 or > 5)))
            throw new InvalidDataException("Registro de avaliações inválido.");
        return store;
    }
    private async Task WriteAsync(Store store, CancellationToken cancellation)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try {
            await using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None)) {
                await JsonSerializer.SerializeAsync(stream, store, Options, cancellation);
                await stream.FlushAsync(cancellation); stream.Flush(true);
            }
            File.Move(temporary, path, true);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
    private sealed record Store { public int Version { get; init; } = 1; public Dictionary<string, Entry> Items { get; init; } = []; }
    private sealed record Entry { public int? Discussion { get; set; } public bool DiscussionOverride { get; set; } public Dictionary<string, Vote> Votes { get; init; } = []; }
    private sealed record Vote(int? Rating = null, bool Hype = false);
}
public record StudyVote(int? Rating = null, bool? Hype = null);
public record StudySummary(string Key, double? Average, int Ratings, int Hypes, int? Comments, int? Discussion, int? MyRating, bool MyHype);
public record StudyComment(string Body);

public static class StudyEndpoints
{
    public static void MapStudyEngagement(this WebApplication app)
    {
        app.MapGet("/api/study/activity", async (HttpContext context, StudyEngagement activity) => {
            context.Response.Headers.CacheControl = "no-store";
            try { return Results.Ok(await activity.ListAsync(context.User.FindFirstValue(ClaimTypes.NameIdentifier), context.RequestAborted)); }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException or JsonException) { return Results.Json(new { error = "Não foi possível carregar as avaliações." }, statusCode: 503); }
        });
        app.MapPost("/api/study/{type}/{slug}/vote", async (string type, string slug, StudyVote vote, HttpContext context, IAntiforgery csrf, StudyEngagement activity) => {
            context.Response.Headers.CacheControl = "no-store";
            if (context.User.Identity?.IsAuthenticated != true || !long.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) || userId <= 0) return Results.Unauthorized();
            try { await csrf.ValidateRequestAsync(context); }
            catch (AntiforgeryValidationException) { return Results.BadRequest(new { error = "Atualize a página e tente novamente." }); }
            var resource = activity.Find(type, slug);
            if (resource is null) return Results.NotFound();
            if (resource.Demo) return Results.BadRequest(new { error = "Itens de exemplo não recebem avaliações." });
            try { await activity.VoteAsync(resource, userId.ToString(System.Globalization.CultureInfo.InvariantCulture), vote, context.RequestAborted); return Results.Ok(new { saved = true }); }
            catch (ArgumentException e) { return Results.BadRequest(new { error = e.Message }); }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException or JsonException) { return Results.Json(new { error = "Não foi possível salvar sua avaliação." }, statusCode: 503); }
        }).WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(4096));
        app.MapPost("/api/study/{type}/{slug}/comments", async (string type, string slug, StudyComment comment, HttpContext context, IAntiforgery csrf, StudyEngagement activity) => {
            context.Response.Headers.CacheControl = "no-store";
            if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
            try { await csrf.ValidateRequestAsync(context); }
            catch (AntiforgeryValidationException) { return Results.BadRequest(new { error = "Atualize a página e tente novamente." }); }
            var resource = activity.Find(type, slug);
            if (resource is null) return Results.NotFound();
            var token = await context.GetTokenAsync("access_token");
            if (string.IsNullOrEmpty(token)) return Results.Unauthorized();
            try { return Results.Ok(new { number = await activity.CommentAsync(resource, token, comment.Body, context.RequestAborted) }); }
            catch (ArgumentException e) { return Results.BadRequest(new { error = e.Message }); }
            catch (DiscussionWriteRejectedException e) { return Results.Json(new { error = e.Message }, statusCode: 403); }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException or HttpRequestException or JsonException or DiscussionsUnavailableException or InvalidOperationException or KeyNotFoundException or OperationCanceledException) {
                return Results.Json(new { error = "Não foi possível confirmar a publicação. Confira o fórum no GitHub antes de tentar novamente." }, statusCode: 503);
            }
        }).WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(65536));
    }
}
