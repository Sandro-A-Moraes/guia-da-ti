using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

var handler = new FakeGitHub();
var settings = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
{
    ["DISCUSSIONS_REPOSITORY"] = "example/community", ["DISCUSSIONS_TOKEN"] = "test-only-token"
}).Build();
using var client = new DiscussionsClient(new FakeFactory(handler), settings);
Check(client.Configured, "Configured client");
var page = await client.ListAsync("category-1", "cursor-1", default);
Check(page.Items.Length == 1 && page.Items[0].Author == "Usuário removido", "Deleted authors");
Check(page.Items[0].Preview == "Texto do tópico", "Discussion preview uses plain text");
Check(page.Items[0].Url == "https://github.com/example/community/discussions/7", "Canonical public URL");
Check(page.PageInfo.HasNextPage && page.PageInfo.EndCursor == "cursor-2", "Pagination");
Check(handler.LastVariables.GetProperty("category").GetString() == "category-1"
    && handler.LastVariables.GetProperty("after").GetString() == "cursor-1", "Filters passed as GraphQL variables");
Check(handler.Authorized, "Server-side authorization");
await client.ListAsync("category-1", "cursor-1", default);
Check(handler.Calls == 1, "Successful pages are cached");
var thread = await client.ThreadAsync(7, null, default);
Check(thread?.Body == "Texto do tópico" && thread.Comments[0].IsAnswer, "Thread and answer");
Check(thread!.Comments[0].Replies.Length == 1 && thread.Comments[0].ReplyCount == 6, "Reply preview and total");
Check(thread.Comments[1].Body == "Comentário ocultado pela moderação." && thread.Comments[1].Replies.Length == 0, "Moderated text and replies stay hidden");
handler.Mode = "missing";
Check(await client.ThreadAsync(404, null, default) is null, "Missing topic");
handler.Mode = "github-missing";
Check(await client.ThreadAsync(405, null, default) is null, "GitHub NOT_FOUND envelope");
handler.Mode = "empty";
Check((await client.ListAsync("empty", null, default)).Items.Length == 0, "Empty discussions");
handler.Mode = "announcement";
Check(!(await client.ListAsync("announcement", null, default)).Items[0].IsAnswered, "Announcements may have a null answer status");
foreach (var mode in new[] { "private", "disabled", "graphql-error", "rate-limit", "malformed" })
{
    handler.Mode = mode;
    var failed = false;
    try { await client.ListAsync(mode, null, default); }
    catch (Exception error) when (error is DiscussionsUnavailableException or HttpRequestException or JsonException) { failed = true; }
    Check(failed, $"Reject {mode}");
}
handler.Mode = "ready";
Check((await client.ListAsync("rate-limit", null, default)).Items.Length == 1, "Failures do not poison cache");
var found = await client.SearchAsync("erro js", "category-1", "search-cursor", default);
Check(found.TotalCount == 1 && found.Items.Length == 1, "Search results and count");
var searchQuery = handler.LastVariables.GetProperty("search").GetString()!;
Check(searchQuery.Contains("repo:example/community is:public in:title,body,comments")
    && searchQuery.Contains("\"erro\" \"js\"") && searchQuery.Contains("category:\"Dúvidas\""), "Search scope, keywords and category");
Check(handler.LastVariables.GetProperty("after").GetString() == "search-cursor", "Search pagination");
var calls = handler.Calls;
await client.SearchAsync("erro js", "category-1", "search-cursor", default);
Check(handler.Calls == calls, "Search cache");
Check((await client.SearchAsync("js", "unknown", null, default)).Items.Length == 0, "Unknown category must not broaden search");
await client.SearchAsync("repo:evil/private OR secret", null, null, default);
Check(!handler.LastVariables.GetProperty("search").GetString()!.Contains("repo:evil"), "User qualifiers are not executable");
handler.Mode = "wrong-search-repo";
try { await client.SearchAsync("leak", null, null, default); throw new Exception("Foreign search results must be rejected"); }
catch (DiscussionsUnavailableException) { }
handler.Mode = "private-search-result";
try { await client.SearchAsync("private", null, null, default); throw new Exception("Private search results must be rejected"); }
catch (DiscussionsUnavailableException) { }
using var unconfigured = new DiscussionsClient(new FakeFactory(handler), new ConfigurationBuilder().Build());
Check(!unconfigured.Configured, "No token means unconfigured");
settings["DISCUSSIONS_REPOSITORY"] = "https://evil.example/repo";
using var invalid = new DiscussionsClient(new FakeFactory(handler), settings);
Check(!invalid.Configured, "Reject malformed repository");
await ParticipationChecks.Run();
await DiscussionPermissionChecks.Run();
await DiscussionChangeChecks.Run();
await ContributorChecks.Run();
ActivityChecks.Run();
await RegisteredUserChecks.Run();
await StudyChecks.Run();
await AdvertisingChecks.Run();
await CreatorProfileChecks.Run();
CommunityLocationChecks.Run();
await CatalogProposalChecks.Run();
CatalogJsonChecks.Run();
ContributionNoticeChecks.Run();
Console.WriteLine("Discussions OK: filtering, cursors, cache, thread, replies, moderation, public-only data, errors and configuration.");

static void Check(bool condition, string name) { if (!condition) throw new Exception(name); }

sealed class FakeFactory(FakeGitHub handler) : IHttpClientFactory
{
    public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
}

sealed class FakeGitHub : HttpMessageHandler
{
    public string Mode { get; set; } = "ready";
    public int Calls { get; private set; }
    public bool Authorized { get; private set; }
    public JsonElement LastVariables { get; private set; }
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Calls++;
        Authorized = request.Headers.Authorization?.Parameter == "test-only-token";
        using var payload = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellationToken));
        LastVariables = payload.RootElement.GetProperty("variables").Clone();
        var category = new { id = "category-1", name = "Dúvidas" };
        var pageInfo = new { hasNextPage = true, endCursor = "cursor-2" };
        var comment = new { id = "c1", bodyText = "Resposta", createdAt = "2026-10-05T12:00:00Z", isAnswer = true, isMinimized = false, deletedAt = (string?)null, author = new { login = "member", avatarUrl = (string?)null } };
        var comments = new
        {
            totalCount = 2, pageInfo,
            nodes = new[] {
                new { id = "c1", bodyText = "Resposta", createdAt = "2026-10-05T12:00:00Z", isAnswer = true, isMinimized = false, deletedAt = (string?)null, author = new { login = "member", avatarUrl = (string?)null }, replies = new { totalCount = 6, nodes = new[] { comment } } },
                new { id = "c2", bodyText = "CONTEUDO MODERADO", createdAt = "2026-10-05T12:00:00Z", isAnswer = false, isMinimized = true, deletedAt = (string?)null, author = new { login = "member", avatarUrl = (string?)null }, replies = new { totalCount = 1, nodes = new[] { comment } } }
            }
        };
        var discussion = new { number = 7, title = "Como começar?", bodyText = "Texto do tópico", author = (object?)null, category, comments, updatedAt = "2026-10-05T12:00:00Z", isAnswered = Mode == "announcement" ? (bool?)null : true, locked = false,
            repository = new { nameWithOwner = Mode == "wrong-search-repo" ? "other/repo" : "example/community", isPrivate = Mode == "private-search-result" } };
        var repository = new
        {
            isPrivate = Mode == "private", hasDiscussionsEnabled = Mode != "disabled",
            discussionCategories = new { nodes = new[] { category } },
            discussions = new { nodes = Mode == "empty" ? [] : new[] { discussion }, pageInfo },
            discussion = Mode is "missing" or "github-missing" ? null : discussion
        };
        var body = Mode switch
        {
            "graphql-error" => "{\"errors\":[{\"message\":\"secret upstream detail\"}]}",
            "malformed" => "not JSON",
            "github-missing" => JsonSerializer.Serialize(new { data = new { repository }, errors = new[] { new { type = "NOT_FOUND", path = new[] { "repository", "discussion" } } } }),
            _ => JsonSerializer.Serialize(new { data = new { repository, search = new { discussionCount = 1, nodes = new[] { discussion }, pageInfo } } })
        };
        return new HttpResponseMessage(Mode == "rate-limit" ? HttpStatusCode.TooManyRequests : HttpStatusCode.OK) { Content = new StringContent(body) };
    }
}
