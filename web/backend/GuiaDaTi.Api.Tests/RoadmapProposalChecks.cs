using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

static class RoadmapProposalChecks
{
    static readonly Catalog Catalog = new(1, new(["geral"], [], ["pt-BR"], ["roadmaps", "courses"]), [
        new("trilha-existente", "roadmaps", "Trilha existente", "Um resumo da trilha existente", "Uma descrição da trilha existente", null, ["geral"], [], ["pt-BR"], "2026-01-01", false, Roadmap: new("beginner")),
        new("roadmap-externo", "roadmaps", "Roadmap externo", "Um resumo do roadmap externo", "Uma descrição do roadmap externo", "https://example.org/roadmap", ["geral"], [], ["pt-BR"], "2026-01-01", false)]);

    static RoadmapData Data(string firstTitle = "Lógica") => new("beginner", [
        new("base", "Base", [new("logica", firstTitle, "Pensar em passos", "essential"), new("dados", "Dados", null, "recommended"), new("sql", "SQL", null, "optional")]),
        new("pratica", "Prática", [new("projeto", "Projeto", null, "essential"), new("portfolio", "Portfólio", null, "optional")])]);

    static RoadmapDraft Draft(string name = "Trilha de dados", string? slug = null, string? sha = null, RoadmapData? data = null)
        => new(slug, sha, name, "Um resumo do roadmap de dados", "Uma descrição do roadmap de dados", ["geral"], [], ["pt-BR"], data ?? Data());

    static string ExistingFile() => CatalogJson.Serialize(RoadmapRules.ToResource(Draft("Trilha existente"), "trilha-existente", "2026-01-01"));

    static IConfiguration Settings() => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
        ["DISCUSSIONS_REPOSITORY"] = "example/catalog", ["DISCUSSIONS_TOKEN"] = "read-only-token", ["SITE_URL"] = "https://guia.example"
    }).Build();

    static RoadmapProposals Service(RoadmapGitHub handler, CommitsGitHub commits, ListLogger<RoadmapProposals>? logger = null)
    {
        var settings = Settings();
        return new(new RoadmapFactory(handler, commits), settings, new RoadmapContributors(new RoadmapFactory(handler, commits), settings, TimeProvider.System), logger ?? new ListLogger<RoadmapProposals>());
    }

    static async Task Rejected(Func<Task> action, string message)
    {
        try { await action(); }
        catch (ContributionRejectedException) { return; }
        throw new Exception(message);
    }

    public static async Task Run()
    {
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        foreach (var mode in new[] { "existing-fork", "new-fork", "maintainer" }) {
            using var handler = new RoadmapGitHub { Mode = mode };
            using var commits = new CommitsGitHub();
            var result = await Service(handler, commits).Submit("user-token", "ana", Draft(), Catalog, default);
            var owner = mode == "maintainer" ? "example" : "ana";
            Check(result.Url == "https://github.com/example/catalog/pull/10", "Roadmap proposal returns the catalog PR");
            Check(handler.UserTokenOnly, "Roadmap proposal uses visitor credentials exclusively");
            Check(handler.Forks == (mode == "new-fork" ? 1 : 0), "Roadmap proposal reuses the fork or writes as maintainer");
            Check(handler.FileTarget == $"/repos/{owner}/catalog/contents/data/roadmaps/trilha-de-dados.json", "Roadmap file target");
            Check(handler.PutSha is null, "A new roadmap is written without a file sha");
            Check(handler.Resource.GetProperty("type").GetString() == "roadmaps" && !handler.Resource.TryGetProperty("url", out _)
                && handler.Resource.GetProperty("roadmap").GetProperty("level").GetString() == "beginner"
                && handler.Resource.GetProperty("roadmap").GetProperty("sections").GetArrayLength() == 2
                && handler.Resource.GetProperty("updatedAt").GetString() == today, "Community roadmap is saved without url and with its steps");
            Check(handler.PullTitle == "Roadmap: adicionar Trilha de dados" && handler.PullBase == "main" && handler.PullHead.StartsWith($"{owner}:contributions/roadmap-trilha-de-dados-"), "Roadmap PR title, base and branch");
            Check(handler.PullBody.Contains("Roadmap novo") && handler.PullBody.Contains("https://guia.example/roadmaps/trilha-de-dados") && !handler.PullBody.Contains("cc @"), "New roadmap PR describes the roadmap and links the Guia page");
            Check(handler.Searches == 1 && handler.SearchQuery.Contains("repo:example/catalog") && handler.SearchQuery.Contains("is:pr") && handler.SearchQuery.Contains("is:open") && handler.SearchQuery.Contains("author:ana") && handler.SearchQuery.Contains("\"Roadmap:\""), "Open proposals are counted for the author");
        }

        // Editing: file sha is sent, the diff and the creator mention reach the PR.
        foreach (var (login, mentioned) in new[] { ("ana", true), ("maria", false) }) {
            using var handler = new RoadmapGitHub();
            handler.Files["data/roadmaps/trilha-existente.json"] = ("sha-1", ExistingFile());
            using var commits = new CommitsGitHub();
            var result = await Service(handler, commits).Submit("user-token", login, Draft("Trilha existente", "trilha-existente", "sha-1", Data("Pensamento lógico")), Catalog, default);
            Check(result.Url.EndsWith("/pull/10") && handler.PutSha == "sha-1", "Edit writes with the sha the editor loaded");
            Check(handler.FileTarget == "/repos/ana/catalog/contents/data/roadmaps/trilha-existente.json", "Edit targets the existing file");
            Check(handler.PullTitle == "Roadmap: atualizar Trilha existente" && handler.PullBody.Contains("Etapa renomeada"), "Edit PR carries the plain-language summary");
            Check(handler.PullBody.Contains("cc @maria") == mentioned, "The creator is mentioned only when someone else edits");
            Check(handler.PullHead.Contains(":contributions/roadmap-trilha-existente-"), "Edit branch prefix");
        }

        // A newer version in main, a missing file or a missing sha stop the edit before any write.
        using (var handler = new RoadmapGitHub { Mode = "new-fork" }) {
            handler.Files["data/roadmaps/trilha-existente.json"] = ("sha-2", ExistingFile());
            using var commits = new CommitsGitHub();
            var service = Service(handler, commits);
            await Rejected(() => service.Submit("user-token", "ana", Draft("Trilha existente", "trilha-existente", "sha-1"), Catalog, default), "Accepted a stale sha");
            await Rejected(() => service.Submit("user-token", "ana", Draft("Trilha existente", "trilha-existente", null), Catalog, default), "Accepted an edit without sha");
            await Rejected(() => service.Submit("user-token", "ana", Draft("Roadmap externo", "roadmap-externo", "sha-2"), Catalog, default), "Accepted an edit of an external roadmap");
            await Rejected(() => service.Submit("user-token", "ana", Draft("Outra", "nao-existe", "sha-2"), Catalog, default), "Accepted an edit of an unknown roadmap");
            Check(handler.Writes == 0 && handler.Forks == 0, "Rejected edits do not write to GitHub");
        }
        using (var handler = new RoadmapGitHub { Mode = "new-fork" }) {
            using var commits = new CommitsGitHub();
            await Rejected(() => Service(handler, commits).Submit("user-token", "ana", Draft("Trilha existente", "trilha-existente", "sha-1"), Catalog, default), "Accepted an edit of a deleted file");
            Check(handler.Writes == 0, "No writes when the file no longer exists");
        }
        // GitHub can still refuse the write if main moved after the check.
        using (var handler = new RoadmapGitHub { PutStatus = HttpStatusCode.Conflict }) {
            handler.Files["data/roadmaps/trilha-existente.json"] = ("sha-1", ExistingFile());
            using var commits = new CommitsGitHub();
            await Rejected(() => Service(handler, commits).Submit("user-token", "ana", Draft("Trilha existente", "trilha-existente", "sha-1"), Catalog, default), "Accepted a write refused by GitHub");
        }

        // Creating: a name already used in the catalog or in main is refused before the fork exists.
        using (var handler = new RoadmapGitHub { Mode = "new-fork" }) {
            handler.Files["data/roadmaps/trilha-de-dados.json"] = ("sha-9", ExistingFile());
            using var commits = new CommitsGitHub();
            var service = Service(handler, commits);
            await Rejected(() => service.Submit("user-token", "ana", Draft(), Catalog, default), "Accepted a roadmap that exists in GitHub");
            await Rejected(() => service.Submit("user-token", "ana", Draft("Trilha existente"), Catalog, default), "Accepted a roadmap that exists in the catalog");
            Check(handler.Writes == 0 && handler.Forks == 0, "Duplicates are refused before any write");
        }

        // An invalid draft never reaches GitHub.
        using (var handler = new RoadmapGitHub()) {
            using var commits = new CommitsGitHub();
            var invalid = Draft(data: new("beginner", [Data().Sections[0]]));
            await Rejected(() => Service(handler, commits).Submit("user-token", "ana", invalid, Catalog, default), "Accepted an invalid roadmap");
            Check(handler.Requests == 0, "Invalid roadmaps are refused before GitHub access");
        }

        // At most three open proposals per person; a failing search does not block.
        foreach (var (total, allowed) in new[] { (2, true), (3, false), (8, false) }) {
            using var handler = new RoadmapGitHub { SearchTotal = total };
            using var commits = new CommitsGitHub();
            if (allowed) await Service(handler, commits).Submit("user-token", "ana", Draft(), Catalog, default);
            else await Rejected(() => Service(handler, commits).Submit("user-token", "ana", Draft(), Catalog, default), "Accepted more than three open proposals");
            Check(allowed || handler.Writes == 0, "The limit stops the proposal before any write");
        }
        using (var handler = new RoadmapGitHub { SearchFails = true }) {
            using var commits = new CommitsGitHub();
            var logger = new ListLogger<RoadmapProposals>();
            await Service(handler, commits, logger).Submit("user-token", "ana", Draft(), Catalog, default);
            Check(handler.Writes > 0 && logger.Messages.Count == 1 && !logger.Messages[0].Contains("user-token"), "A failing search is logged without the token and does not block");
        }

        // Source for the editor.
        using (var handler = new RoadmapGitHub()) {
            handler.Files["data/roadmaps/trilha-existente.json"] = ("sha-1", ExistingFile());
            using var commits = new CommitsGitHub();
            var service = Service(handler, commits);
            var source = await service.Read("user-token", "trilha-existente", default);
            Check(source!.Sha == "sha-1" && source.Roadmap.GetProperty("slug").GetString() == "trilha-existente" && source.Roadmap.GetProperty("roadmap").GetProperty("sections").GetArrayLength() == 2, "The editor loads the current file with its sha");
            Check(await service.Read("user-token", "outra-trilha", default) is null && handler.UserTokenOnly, "Missing file returns nothing and uses the visitor credential");
        }
        Check(RoadmapProposals.IsCommunityRoadmap(Catalog, "trilha-existente") && !RoadmapProposals.IsCommunityRoadmap(Catalog, "roadmap-externo")
            && !RoadmapProposals.IsCommunityRoadmap(Catalog, "nao-existe") && !RoadmapProposals.IsCommunityRoadmap(Catalog, "../trilha-existente"), "Only community roadmaps are editable");

        // Notice after a confirmed proposal.
        var notices = new ContributionNotifications(TimeProvider.System);
        var notice = notices.Publish("ana", " Trilha de dados ", "roadmaps", new("https://github.com/example/catalog/pull/10"));
        Check(notice.Login == "ana" && notice.Name == "Trilha de dados" && notice.Category == "roadmaps" && notice.Url.EndsWith("/pull/10"), "Roadmap proposals publish a notice");

        await Contributors();
        Console.WriteLine("Roadmap proposals OK: create and edit PRs, stale edits, limits, editor source and authorship verified.");
    }

    static async Task Contributors()
    {
        var settings = Settings();
        var clock = new ManualClock();
        static string[] Slugs(int count) => Enumerable.Range(0, count).Select(i => $"trilha-{i}").ToArray();

        using (var commits = new CommitsGitHub { Pages = 2 }) {
            using var contributors = new RoadmapContributors(new RoadmapFactory(new RoadmapGitHub(), commits), settings, clock);
            var authorship = await contributors.GetAsync("trilha-existente", default);
            Check(authorship.Creator is { Login: "maria", Url: "https://github.com/maria", AvatarUrl: "https://avatars.githubusercontent.com/u/2?s=80" }, "The creator is the author of the oldest commit");
            Check(authorship.Contributors.Select(c => (c.Login, c.Contributions)).SequenceEqual([("ana", 2), ("maria", 1)]), "People are counted and sorted by contributions, without bots or commits without account");
            Check(authorship.Contributors[0].Url == "https://github.com/ana" && authorship.Contributors[0].AvatarUrl == "https://avatars.githubusercontent.com/u/1?s=80", "Profile and avatar addresses are built from the account");
            Check(commits.ReadOnlyTokenOnly && commits.CommitRequests == 2, "History uses the read credential and follows the next page");
            await contributors.GetAsync("trilha-existente", default);
            Check(commits.CommitRequests == 2, "Authorship is cached");
            clock.Advance(TimeSpan.FromMinutes(61));
            await contributors.GetAsync("trilha-existente", default);
            Check(commits.CommitRequests == 4, "Authorship expires after an hour");
            foreach (var invalid in new[] { "../segredo", "Trilha", "" }) {
                try { await contributors.GetAsync(invalid, default); throw new Exception("Accepted an invalid slug"); } catch (KeyNotFoundException) { }
            }
        }
        using (var commits = new CommitsGitHub { Pages = 11, Numbered = true }) {
            using var contributors = new RoadmapContributors(new RoadmapFactory(new RoadmapGitHub(), commits), settings, clock);
            var authorship = await contributors.GetAsync("trilha-longa", default);
            Check(authorship.Creator?.Login == "pessoa11" && commits.CommitRequests == 11, "A long history reaches the last page to find the creator");
            Check(authorship.Contributors.Length == 10, "Only the first ten pages are counted");
        }
        using (var commits = new CommitsGitHub { Pages = 1 }) {
            using var contributors = new RoadmapContributors(new RoadmapFactory(new RoadmapGitHub(), commits), settings, clock);
            foreach (var slug in Slugs(70)) await contributors.GetAsync(slug, default);
            var before = commits.CommitRequests;
            await contributors.GetAsync("trilha-69", default);
            Check(commits.CommitRequests == before, "Recent entries stay cached");
            await contributors.GetAsync("trilha-0", default);
            Check(commits.CommitRequests == before + 1, "The cache keeps at most 64 roadmaps");
        }
        foreach (var failure in new[] { "private", "error" }) {
            using var commits = new CommitsGitHub { Failure = failure, Pages = 1 };
            using var contributors = new RoadmapContributors(new RoadmapFactory(new RoadmapGitHub(), commits), settings, clock);
            try { await contributors.GetAsync("trilha-existente", default); throw new Exception("Accepted a failure"); } catch (DiscussionsUnavailableException) { }
            commits.Failure = "";
            Check((await contributors.GetAsync("trilha-existente", default)).Creator is not null, "Failures are not cached");
        }
    }

    static void Check(bool condition, string name) { if (!condition) throw new Exception(name); }
}

sealed class RoadmapFactory(RoadmapGitHub proposals, CommitsGitHub commits) : IHttpClientFactory
{
    // Commit history requests use the read credential and a separate fake.
    readonly HttpMessageHandler router = new Router(proposals, commits);
    public HttpClient CreateClient(string name) => new(router, false);
    sealed class Router(RoadmapGitHub proposals, CommitsGitHub commits) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellation)
            => request.RequestUri!.AbsolutePath.EndsWith("/commits") || request.Headers.Authorization?.Parameter == "read-only-token" ? commits.Forward(request, cancellation) : proposals.Forward(request, cancellation);
    }
}

sealed class ManualClock : TimeProvider
{
    DateTimeOffset now = new(2026, 10, 27, 12, 0, 0, TimeSpan.Zero);
    public void Advance(TimeSpan span) => now += span;
    public override DateTimeOffset GetUtcNow() => now;
}

sealed class ListLogger<T> : ILogger<T>
{
    public List<string> Messages { get; } = [];
    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel logLevel) => true;
    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) => Messages.Add(formatter(state, exception));
}

sealed class RoadmapGitHub : HttpMessageHandler
{
    public string Mode = "existing-fork", FileTarget = "", PullHead = "", PullBase = "", PullTitle = "", PullBody = "", SearchQuery = "";
    public string? PutSha;
    public int Forks, Writes, Requests, Searches, SearchTotal;
    public bool UserTokenOnly = true, SearchFails;
    public HttpStatusCode PutStatus = HttpStatusCode.Created;
    public JsonElement Resource;
    public Dictionary<string, (string Sha, string Json)> Files = [];

    public Task<HttpResponseMessage> Forward(HttpRequestMessage request, CancellationToken cancellation) => SendAsync(request, cancellation);

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellation)
    {
        Requests++;
        UserTokenOnly &= request.Headers.Authorization?.Parameter == "user-token";
        var path = request.RequestUri!.AbsolutePath;
        if (request.Method != HttpMethod.Get) Writes++;
        if (path == "/search/issues") {
            Searches++;
            SearchQuery = Uri.UnescapeDataString(request.RequestUri.Query);
            return SearchFails ? new(HttpStatusCode.InternalServerError) : Response(new { total_count = SearchTotal });
        }
        if (path == "/repos/example/catalog" && request.Method == HttpMethod.Get)
            return Response(new { @private = false, default_branch = "main", permissions = new { push = Mode == "maintainer" } });
        if (path == "/user") return Response(new { login = "ana" });
        if (path == "/repos/ana/catalog") {
            if (Mode == "new-fork" && Forks == 0) return new(HttpStatusCode.NotFound);
            return Response(new { @private = false, fork = true, source = new { full_name = "example/catalog" } });
        }
        if (path == "/repos/example/catalog/forks") { Forks++; return Response(new { full_name = "ana/catalog" }, HttpStatusCode.Accepted); }
        if (path.Contains("/git/ref/heads/")) return Response(new { @object = new { sha = "upstream-sha" } });
        if (path.EndsWith("/git/refs")) return Response(new { }, HttpStatusCode.Created);
        if (path.Contains("/contents/data/roadmaps/") && request.Method == HttpMethod.Get) {
            var file = path[(path.IndexOf("/contents/") + "/contents/".Length)..];
            return Files.TryGetValue(file, out var found)
                ? Response(new { sha = found.Sha, encoding = "base64", content = Convert.ToBase64String(Encoding.UTF8.GetBytes(found.Json)) })
                : new(HttpStatusCode.NotFound);
        }
        if (path.Contains("/contents/data/roadmaps/")) {
            FileTarget = path;
            using var payload = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellation));
            PutSha = payload.RootElement.TryGetProperty("sha", out var sha) ? sha.GetString() : null;
            if (PutStatus != HttpStatusCode.Created) return new(PutStatus);
            using var content = JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(payload.RootElement.GetProperty("content").GetString()!)));
            Resource = content.RootElement.Clone();
            return Response(new { }, HttpStatusCode.Created);
        }
        if (path == "/repos/example/catalog/pulls") {
            using var payload = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellation));
            PullHead = payload.RootElement.GetProperty("head").GetString()!;
            PullBase = payload.RootElement.GetProperty("base").GetString()!;
            PullTitle = payload.RootElement.GetProperty("title").GetString()!;
            PullBody = payload.RootElement.GetProperty("body").GetString()!;
            return Response(new { html_url = "https://github.com/example/catalog/pull/10" }, HttpStatusCode.Created);
        }
        throw new Exception("Unexpected GitHub request: " + request.Method + " " + path);
    }
    static HttpResponseMessage Response(object body, HttpStatusCode status = HttpStatusCode.OK)
        => new(status) { Content = new StringContent(JsonSerializer.Serialize(body)) };
}

// Commit history of a roadmap file: page 1 has newer commits, the last page the oldest.
sealed class CommitsGitHub : HttpMessageHandler
{
    public int Pages = 1, CommitRequests;
    public bool ReadOnlyTokenOnly = true, Numbered;
    public string Failure = "";

    public Task<HttpResponseMessage> Forward(HttpRequestMessage request, CancellationToken cancellation) => SendAsync(request, cancellation);

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellation)
    {
        ReadOnlyTokenOnly &= request.Headers.Authorization?.Parameter == "read-only-token";
        var path = request.RequestUri!.AbsolutePath;
        if (Failure == "error") return Task.FromResult(new HttpResponseMessage(HttpStatusCode.InternalServerError));
        if (path == "/repos/example/catalog") return Task.FromResult(Json(new { @private = Failure == "private" }));
        if (!path.EndsWith("/commits")) throw new Exception("Unexpected GitHub request: " + path);
        CommitRequests++;
        var query = System.Web.HttpUtility.ParseQueryString(request.RequestUri.Query);
        var page = int.Parse(query["page"] ?? "1");
        object[] commits = Numbered ? [Commit($"pessoa{page}", page, "User")]
            : page == 1 ? [Commit("ana", 1, "User"), Commit("ana", 1, "User"), Commit("dependabot", 3, "Bot"), new { author = (object?)null }]
            : [Commit("maria", 2, "User")];
        if (Pages == 1) commits = [Commit("maria", 2, "User")];
        var response = Json(commits);
        var links = new List<string>();
        string Link(int target, string rel) => $"<https://api.github.com/repos/example/catalog/commits?path={query["path"]}&per_page=100&page={target}>; rel=\"{rel}\"";
        if (page < Pages) { links.Add(Link(page + 1, "next")); links.Add(Link(Pages, "last")); }
        if (links.Count > 0) response.Headers.TryAddWithoutValidation("Link", string.Join(", ", links));
        return Task.FromResult(response);
    }
    static object Commit(string login, long id, string type) => new { author = new { login, id, type } };
    static HttpResponseMessage Json(object body) => new(HttpStatusCode.OK) { Content = new StringContent(JsonSerializer.Serialize(body)) };
}
