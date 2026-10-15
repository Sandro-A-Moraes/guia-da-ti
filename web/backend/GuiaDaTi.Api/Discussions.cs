using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;

// Public read-only facade: credentials and GitHub's response details never reach the browser.
public sealed class DiscussionsClient(IHttpClientFactory clients, IConfiguration configuration) : IDisposable
{
    private readonly MemoryCache cache = new(new MemoryCacheOptions { SizeLimit = 128 });
    private readonly Dictionary<string, Task<JsonElement>> pending = new();
    private readonly SemaphoreSlim gate = new(6);
    private int generation;
    private readonly string repository = configuration["DISCUSSIONS_REPOSITORY"] ?? "guia-da-ti/guia-da-ti-dados";
    private readonly string? token = configuration["DISCUSSIONS_TOKEN"];
    public bool Configured => !string.IsNullOrWhiteSpace(token)
        && Regex.IsMatch(repository, @"^[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+$");
    public string RepositoryUrl => $"https://github.com/{repository}/discussions";
    // Queries already in flight still answer their callers, but their results are not cached.
    public Task InvalidateAsync(CancellationToken cancellation) {
        lock (cache) { generation++; cache.Clear(); pending.Clear(); }
        return Task.CompletedTask;
    }

    public async Task<DiscussionList> ListAsync(string? category, string? after, CancellationToken cancellation)
    {
        var data = (await QueryAsync(ListQuery, new { owner = repository.Split('/')[0], name = repository.Split('/')[1], category, after }, cancellation)).GetProperty("repository");
        var connection = data.GetProperty("discussions");
        return new("ready", RepositoryUrl,
            data.GetProperty("discussionCategories").GetProperty("nodes").EnumerateArray().Select(Category).ToArray(),
            connection.GetProperty("nodes").EnumerateArray().Select(Summary).ToArray(), Page(connection));
    }

    public async Task<DiscussionList> SearchAsync(string q, string? category, string? after, CancellationToken cancellation)
    {
        var owner = repository.Split('/')[0];
        var name = repository.Split('/')[1];
        var metadata = (await QueryAsync(CategoriesQuery, new { owner, name }, cancellation)).GetProperty("repository");
        var categories = metadata.GetProperty("discussionCategories").GetProperty("nodes").EnumerateArray().Select(Category).ToArray();
        var selected = categories.FirstOrDefault(item => item.Id == category);
        // Accept plain keywords, never user-supplied GitHub qualifiers or boolean operators.
        var terms = Regex.Matches(q, @"[\p{L}\p{N}_+#.-]+").Select(match => $"\"{match.Value}\"").ToArray();
        if (terms.Length == 0 || (!string.IsNullOrEmpty(category) && selected is null))
            return new("ready", RepositoryUrl, categories, [], new(false, null), 0);
        var search = $"repo:{repository} is:public in:title,body,comments {string.Join(' ', terms)}";
        if (selected is not null) search += $" category:\"{selected.Name.Replace("\\", "\\\\").Replace("\"", "\\\"")}\"";
        var data = await QueryAsync(SearchQuery, new { owner, name, search, after }, cancellation);
        var connection = data.GetProperty("search");
        var nodes = connection.GetProperty("nodes").EnumerateArray().ToArray();
        // Defense in depth: never expose a result outside the configured public repository.
        if (nodes.Any(item => item.GetProperty("repository").GetProperty("isPrivate").GetBoolean()
            || !string.Equals(Text(item.GetProperty("repository"), "nameWithOwner"), repository, StringComparison.OrdinalIgnoreCase)))
            throw new DiscussionsUnavailableException();
        return new("ready", RepositoryUrl, categories, nodes.Select(Summary).ToArray(), Page(connection), connection.GetProperty("discussionCount").GetInt32());
    }

    public async Task<DiscussionThread?> ThreadAsync(int number, string? after, CancellationToken cancellation)
    {
        var data = (await QueryAsync(ThreadQuery, new { owner = repository.Split('/')[0], name = repository.Split('/')[1], number, after }, cancellation)).GetProperty("repository");
        var discussion = data.GetProperty("discussion");
        if (discussion.ValueKind == JsonValueKind.Null) return null;
        var comments = discussion.GetProperty("comments");
        return new("ready", Summary(discussion), Text(discussion, "bodyText"),
            comments.GetProperty("nodes").EnumerateArray().Select(Comment).ToArray(), Page(comments));
    }

    private async Task<JsonElement> QueryAsync(string query, object variables, CancellationToken cancellation)
    {
        var key = query + JsonSerializer.Serialize(variables);
        if (cache.TryGetValue(key, out JsonElement cached)) return cached;
        // Callers of the same key share one GitHub call; different keys only share the concurrency limit.
        // The cache check, the shared call registration and its completion run under one lock, the network call outside it.
        Task<JsonElement> shared;
        TaskCompletionSource<JsonElement>? mine = null;
        int version;
        lock (cache)
        {
            if (cache.TryGetValue(key, out cached)) return cached;
            version = generation;
            if (!pending.TryGetValue(key, out shared!))
            {
                mine = new(TaskCreationOptions.RunContinuationsAsynchronously);
                pending[key] = shared = mine.Task;
            }
        }
        if (mine is not null) _ = FillAsync(key, query, variables, version, mine);
        return await shared.WaitAsync(cancellation);
    }

    private async Task FillAsync(string key, string query, object variables, int version, TaskCompletionSource<JsonElement> result)
    {
        JsonElement fetched;
        try { fetched = await FetchAsync(query, variables); }
        catch (Exception error)
        {
            lock (cache) Forget(key, result.Task);
            result.SetException(error);
            return;
        }
        lock (cache)
        {
            if (version == generation)
                cache.Set(key, fetched, new MemoryCacheEntryOptions { Size = 1, AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1) });
            Forget(key, result.Task);
        }
        result.SetResult(fetched);
    }

    private void Forget(string key, Task<JsonElement> task)
    {
        if (pending.TryGetValue(key, out var current) && current == task) pending.Remove(key);
    }

    // Shared by several callers, so one caller giving up does not cancel the others; the client timeout bounds it.
    private async Task<JsonElement> FetchAsync(string query, object variables)
    {
        var cancellation = CancellationToken.None;
        await gate.WaitAsync(cancellation);
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.github.com/graphql");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            request.Headers.UserAgent.ParseAdd("GuiaDaTi/1.0");
            request.Content = JsonContent.Create(new { query, variables });
            using var client = clients.CreateClient("discussions");
            using var response = await client.SendAsync(request, cancellation);
            response.EnsureSuccessStatusCode();
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellation));
            var root = document.RootElement;
            // GitHub reports a missing discussion as both null data and a NOT_FOUND error.
            if (root.TryGetProperty("errors", out var errors) && !errors.EnumerateArray().All(error =>
                error.TryGetProperty("type", out var type) && type.GetString() == "NOT_FOUND"
                && error.TryGetProperty("path", out var path) && path.ValueKind == JsonValueKind.Array
                && path.EnumerateArray().Select(part => part.GetString()).SequenceEqual(new[] { "repository", "discussion" })))
                throw new DiscussionsUnavailableException();
            var data = root.GetProperty("data").GetProperty("repository");
            // Never publish private content, even if the configured token can read it.
            if (data.ValueKind == JsonValueKind.Null || data.GetProperty("isPrivate").GetBoolean()
                || !data.GetProperty("hasDiscussionsEnabled").GetBoolean()) throw new DiscussionsUnavailableException();
            return root.GetProperty("data").Clone();
        }
        finally { gate.Release(); }
    }

    private DiscussionSummary Summary(JsonElement item) => new(
        item.GetProperty("number").GetInt32(), Text(item, "title"), Category(item.GetProperty("category")),
        Author(item), Text(item, "updatedAt"), item.GetProperty("comments").GetProperty("totalCount").GetInt32(),
        item.GetProperty("isAnswered").ValueKind == JsonValueKind.True, item.GetProperty("locked").GetBoolean(),
        $"{RepositoryUrl}/{item.GetProperty("number").GetInt32()}", Preview(item), ResourceCategory(item), ImageUrl(item));
    private static string? ImageUrl(JsonElement item)
    {
        var match = Regex.Match(Text(item, "bodyText"), @"(?:\*\*)?Imagem:\**\s*(\S+)", RegexOptions.IgnoreCase);
        if (!match.Success) return null;
        var value = match.Groups[1].Value.TrimEnd('.', ',', ')');
        if (Regex.IsMatch(value, @"^/api/contributions/images/[a-f0-9]{32}\.(png|jpg|webp)$")) return value;
        return Uri.TryCreate(value, UriKind.Absolute, out var image) && image.Scheme == Uri.UriSchemeHttps
            && image.IsDefaultPort && string.IsNullOrEmpty(image.UserInfo) && image.Host.Contains('.') ? image.AbsoluteUri : null;
    }
    private static string? ResourceCategory(JsonElement item) {
        var match = Regex.Match(Text(item, "bodyText"), @"Categoria do guia:\**\s*([a-z0-9-]+)", RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value : null;
    }
    private static string Preview(JsonElement item) {
        var body = Regex.Replace(Text(item, "bodyText"), @"\s+", " ").Trim();
        return body.Length <= 320 ? body : body[..320] + "…";
    }
    private static DiscussionCategory Category(JsonElement item) => new(Text(item, "id"), Text(item, "name"));
    private static string Author(JsonElement item) => item.GetProperty("author").ValueKind == JsonValueKind.Null
        ? "Usuário removido" : Text(item.GetProperty("author"), "login");
    private static string Text(JsonElement item, string name) => item.GetProperty(name).GetString() ?? "";
    private static DiscussionPage Page(JsonElement connection)
    {
        var info = connection.GetProperty("pageInfo");
        return new(info.GetProperty("hasNextPage").GetBoolean(), info.GetProperty("endCursor").GetString());
    }
    private static DiscussionComment Comment(JsonElement item)
    {
        var hidden = item.GetProperty("isMinimized").GetBoolean();
        var deleted = item.GetProperty("deletedAt").ValueKind != JsonValueKind.Null;
        var hasReplies = item.TryGetProperty("replies", out var replies);
        return new(Text(item, "id"), Author(item), AvatarUrl(item), hidden ? "Comentário ocultado pela moderação." : Text(item, "bodyText"),
            Text(item, "createdAt"), item.GetProperty("isAnswer").GetBoolean(), deleted,
            hasReplies && !hidden ? replies.GetProperty("nodes").EnumerateArray().Select(Comment).ToArray() : [],
            hasReplies && !hidden ? replies.GetProperty("totalCount").GetInt32() : 0);
    }

    private static string? AvatarUrl(JsonElement item)
    {
        if (!item.TryGetProperty("author", out var author) || author.ValueKind != JsonValueKind.Object
            || !author.TryGetProperty("avatarUrl", out var avatar) || avatar.ValueKind != JsonValueKind.String
            || !Uri.TryCreate(avatar.GetString(), UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps) return null;
        return uri.ToString();
    }

    public void Dispose() { cache.Dispose(); gate.Dispose(); }
    private const string CategoriesQuery = """
        query($owner:String!, $name:String!) {
          repository(owner:$owner, name:$name) {
            isPrivate hasDiscussionsEnabled
            discussionCategories(first:100) { nodes { id name } }
          }
        }
        """;
    private const string SearchQuery = """
        query($owner:String!, $name:String!, $search:String!, $after:String) {
          repository(owner:$owner, name:$name) { isPrivate hasDiscussionsEnabled }
          search(query:$search, type:DISCUSSION, first:20, after:$after) {
            discussionCount pageInfo { hasNextPage endCursor }
            nodes { ... on Discussion {
              number title bodyText updatedAt isAnswered locked author { login } category { id name } comments { totalCount }
              repository { nameWithOwner isPrivate }
            } }
          }
        }
        """;
    private const string ListQuery = """
        query($owner:String!, $name:String!, $category:ID, $after:String) {
          repository(owner:$owner, name:$name) {
            isPrivate hasDiscussionsEnabled
            discussionCategories(first:100) { nodes { id name } }
            discussions(first:20, after:$after, categoryId:$category, orderBy:{field:UPDATED_AT,direction:DESC}) {
              pageInfo { hasNextPage endCursor }
              nodes { number title bodyText updatedAt isAnswered locked author { login } category { id name } comments { totalCount } }
            }
          }
        }
        """;
    private const string ThreadQuery = """
        query($owner:String!, $name:String!, $number:Int!, $after:String) {
          repository(owner:$owner, name:$name) {
            isPrivate hasDiscussionsEnabled
            discussion(number:$number) {
              number title bodyText updatedAt isAnswered locked author { login } category { id name }
              comments(first:20, after:$after) {
                totalCount pageInfo { hasNextPage endCursor }
                nodes {
                  id bodyText createdAt isAnswer isMinimized deletedAt author { login avatarUrl }
                  replies(first:5) {
                    totalCount
                    nodes { id bodyText createdAt isAnswer isMinimized deletedAt author { login avatarUrl } }
                  }
                }
              }
            }
          }
        }
        """;
}

public sealed class DiscussionsUnavailableException : Exception;
public record DiscussionCategory(string Id, string Name);
public record DiscussionPage(bool HasNextPage, string? EndCursor);
public record DiscussionSummary(int Number, string Title, DiscussionCategory Category, string Author,
    string UpdatedAt, int CommentCount, bool IsAnswered, bool Locked, string Url, string Preview = "", string? ResourceCategory = null, string? ImageUrl = null);
public record DiscussionList(string Status, string RepositoryUrl, DiscussionCategory[] Categories, DiscussionSummary[] Items, DiscussionPage PageInfo, int? TotalCount = null);
public record DiscussionComment(string Id, string Author, string? AvatarUrl, string Body, string CreatedAt, bool IsAnswer, bool IsDeleted, DiscussionComment[] Replies, int ReplyCount);
public record DiscussionThread(string Status, DiscussionSummary Discussion, string Body, DiscussionComment[] Comments, DiscussionPage PageInfo);

public static class DiscussionEndpoints
{
    public static void MapDiscussions(this WebApplication app)
    {
        app.MapGet("/api/discussions", async (string? q, string? category, string? after, DiscussionsClient client, CancellationToken cancellation) =>
        {
            if (q?.Length > 200 || category?.Length > 200 || after?.Length > 500) return Results.BadRequest(new { error = "Parâmetros inválidos." });
            return await Respond(client, async () => Results.Ok(string.IsNullOrWhiteSpace(q)
                ? await client.ListAsync(category, after, cancellation)
                : await client.SearchAsync(q.Trim(), category, after, cancellation)), cancellation);
        });
        app.MapGet("/api/discussions/{number:int}", async (int number, string? after, DiscussionsClient client, CancellationToken cancellation) =>
        {
            if (number < 1 || after?.Length > 500) return Results.BadRequest(new { error = "Parâmetros inválidos." });
            return await Respond(client, async () => await client.ThreadAsync(number, after, cancellation) is { } discussion
                ? Results.Ok(discussion) : Results.NotFound(new { error = "Conversa não encontrada." }), cancellation);
        });
    }
    private static async Task<IResult> Respond(DiscussionsClient client, Func<Task<IResult>> action, CancellationToken cancellation)
    {
        if (!client.Configured) return Results.Ok(new { status = "unconfigured" });
        try { return await action(); }
        catch (OperationCanceledException) when (!cancellation.IsCancellationRequested) { return Unavailable(); }
        catch (Exception error) when (error is HttpRequestException or JsonException or DiscussionsUnavailableException or InvalidOperationException or KeyNotFoundException)
        { return Unavailable(); }
    }
    private static IResult Unavailable() => Results.Json(new { status = "unavailable", error = "Não foi possível carregar as conversas. Tente novamente em instantes." }, statusCode: 503);
}
