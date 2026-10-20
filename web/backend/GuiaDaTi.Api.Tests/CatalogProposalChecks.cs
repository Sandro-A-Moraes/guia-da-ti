using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

static class CatalogProposalChecks
{
    public static async Task Run()
    {
        var types = new[] { "courses", "platforms", "universities", "bootcamps", "roadmaps", "books", "certifications", "news", "blogs", "newsletters", "podcasts", "youtube", "creators", "articles", "tutorials", "studies", "case-studies", "reports", "communities", "events", "meetups", "conferences", "hackathons", "tools", "open-source", "challenges", "labs", "jobs", "scholarships", "mentoring", "volunteering" };
        var catalog = new Catalog(1, new(["geral"], [], ["pt-BR"], types), []);
        var settings = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
            ["DISCUSSIONS_REPOSITORY"] = "example/catalog", ["DISCUSSIONS_TOKEN"] = "read-only-token", ["CATALOG_TARGET_BRANCH"] = "catalog-review"
        }).Build();
        foreach (var type in types) {
            foreach (var mode in new[] { "existing-fork", "new-fork", "maintainer" }) {
                using var handler = new ProposalGitHub { Mode = mode };
                var service = new ContributionService(new ProposalFactory(handler), settings);
                var draft = new ContributionDraft(type, "Novo cadastro", "https://example.org/new", "Um resumo do cadastro", "Uma descrição do cadastro", ["geral"], [], ["pt-BR"],
                    ImageUrl: "https://example.org/profile.png",
                    CreatorCategories: type is "creators" or "youtube" ? ["career", "humor"] : null,
                    CommunityLocation: type == "communities" ? new("national") : null,
                    CommunityPlatforms: type == "communities" ? ["discord","website"] : null, CommunityModality: type == "communities" ? "online" : null,
                    CommunityAudience:type=="communities"?"general":null,CommunityLinks:type=="communities"?[new("discord","https://discord.gg/example"),new("website","https://example.org/new")]:null,CommunityMembers:type=="communities"?new(4000,"2026-10-07",true):null,
                    UniversityType:type=="universities"?"public":null);
                var result = await service.Submit("user-token", draft, catalog, default);
                Check(result.Url == "https://github.com/example/catalog/pull/10", "Every category returns the catalog PR");
                Check(handler.Discussions == 0, "Every category skips forum publication");
                Check(handler.UserTokenOnly, "Uses visitor credentials exclusively");
                Check(handler.Forks == (mode == "new-fork" ? 1 : 0), "Reuse fork or write as maintainer");
                Check(handler.FileTarget == $"/repos/{(mode == "maintainer" ? "example" : "ana")}/catalog/contents/data/{type}/novo-cadastro.json", "Catalog file target");
                Check(handler.Resource.GetProperty("type").GetString() == type && handler.Resource.GetProperty("areas")[0].GetString() == "geral", "Preserve validated resource");
                Check(handler.Resource.GetProperty("imageUrl").GetString() == draft.ImageUrl, "Preserve image URL in catalog proposals");
                if (type is "creators" or "youtube") Check(handler.Resource.GetProperty("creatorCategories").EnumerateArray().Select(item => item.GetString()).SequenceEqual(new[] { "career", "humor" }), "Preserve creator categories in GitHub JSON");
                if (type == "universities") Check(handler.Resource.GetProperty("universityType").GetString() == "public", "Preserve university type in GitHub JSON");
                Check(handler.PullHead.StartsWith(mode == "maintainer" ? "example:contributions/" : "ana:contributions/"), "Open upstream PR from writable branch");
                Check(handler.PullBase == "main" && handler.RequestedRef == "main", "Catalog PR and source branch use main");
                if (type == "communities") Check(handler.Resource.GetProperty("communityLocation").GetProperty("scope").GetString() == "national"
                    && handler.Resource.GetProperty("communityPlatforms")[0].GetString() == "discord"
                    && handler.Resource.GetProperty("communityAudience").GetString()=="general"
                    && handler.Resource.GetProperty("communityMembers").GetProperty("count").GetInt32()==4000
                    && handler.Resource.GetProperty("communityMembers").GetProperty("moreThan").GetBoolean()
                    && handler.Resource.GetProperty("communityLinks")[1].GetProperty("url").GetString()=="https://example.org/new", "Preserve community metadata");
            }
        }
        foreach (var mode in new[] { "wrong-fork", "private" }) {
            using var handler = new ProposalGitHub { Mode = mode };
            var service = new ContributionService(new ProposalFactory(handler), settings);
            try { await service.Submit("user-token", new("creators", "Novo cadastro", "https://example.org/new", "Um resumo do cadastro", "Uma descrição do cadastro", ["geral"], [], ["pt-BR"], CreatorCategories: ["career"]), catalog, default); throw new Exception("Accepted invalid target"); }
            catch (ContributionRejectedException) { }
            Check(handler.FileTarget == "" && handler.Writes == 0, "No writes to private or unrelated repository");
        }
        foreach (var type in new[] { "creators", "youtube" }) {
            foreach (var invalid in new string[]?[] { null, [], ["unknown"], ["career", "career"], ["career", null!] }) {
                using var handler = new ProposalGitHub();
                var service = new ContributionService(new ProposalFactory(handler), settings);
                try { await service.Submit("user-token", new(type, "Novo cadastro", "https://example.org/new", "Um resumo do cadastro", "Uma descrição do cadastro", ["geral"], [], ["pt-BR"], CreatorCategories: invalid), catalog, default); throw new Exception("Accepted invalid creator categories"); }
                catch (ContributionRejectedException) { }
                Check(handler.Writes == 0 && handler.Discussions == 0, "Invalid creator categories rejected before GitHub access");
            }
        }
        try { CreatorCategoryRules.ValidateContribution("courses", ["career"]); throw new Exception("Accepted creator categories on a course"); }
        catch (ContributionRejectedException) { }
        var saved = new ContributionResource("perfil", "creators", "Perfil", "Resumo do perfil", "Descrição do perfil", "https://example.org/profile", ["geral"], [], ["pt-BR"], "2026-10-06", CreatorCategories: ["lifestyle", "career"]);
        foreach (var institution in new[] { "public", "private" }) {
            using var handler = new ProposalGitHub();
            var service = new ContributionService(new ProposalFactory(handler), settings);
            await service.Submit("user-token", new("universities", "Nova faculdade", "https://example.org/university", "Um resumo da faculdade", "Uma descrição da faculdade", ["geral"], [], ["pt-BR"], UniversityType: institution), catalog, default);
            Check(handler.Resource.GetProperty("universityType").GetString() == institution, "University type survives direct PR creation");
            Check(handler.PullBase == "main" && handler.Discussions == 0, "University suggestion opens a PR without a forum topic");
        }
        foreach (var invalid in new (string Type, string? Institution)[] { ("universities", null), ("universities", ""), ("universities", "unknown"), ("courses", "public") }) {
            using var handler = new ProposalGitHub();
            var service = new ContributionService(new ProposalFactory(handler), settings);
            try { await service.Submit("user-token", new(invalid.Type, "Nova faculdade", "https://example.org/university", "Um resumo da faculdade", "Uma descrição da faculdade", ["geral"], [], ["pt-BR"], UniversityType: invalid.Institution), catalog, default); throw new Exception("Accepted invalid institution type"); }
            catch (ContributionRejectedException) { }
            Check(handler.Writes == 0 && handler.Discussions == 0, "Reject invalid institution type before GitHub access");
        }
        Check(saved.ToDraft().CreatorCategories!.SequenceEqual(saved.CreatorCategories!), "Preserve categories on approval round trip");
        var folder = Path.Combine(Path.GetTempPath(), "guia-images-" + Guid.NewGuid().ToString("N"));
        try {
            var images = new ContributionImages(new ImageEnvironment {ContentRootPath=folder}, settings);
            var png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAvsAAAAASUVORK5CYII=");
            var id = await images.Save(png, default);
            Check(File.ReadAllBytes(images.PathFor(id)).SequenceEqual(png), "Uploaded image persists on disk");
            foreach (var mode in new[] {"existing-fork", "maintainer"}) {
                using var handler = new ProposalGitHub {Mode=mode};
                var service = new ContributionService(new ProposalFactory(handler), settings, images);
                await service.Submit("user-token", new("creators", "Perfil com imagem", "https://example.org/profile", "Resumo do perfil com imagem", "Descrição do perfil com imagem", ["geral"], [], ["pt-BR"], CreatorCategories:["career"], ImageUploadId:id), catalog, default);
                Check(handler.ImageBytes!.SequenceEqual(png) && handler.ImageBranch == handler.ResourceBranch, "Image and resource published in same contribution branch");
                Check(handler.UserTokenOnly && handler.Resource.GetProperty("imageUrl").GetString() == $"https://raw.githubusercontent.com/example/catalog/main/assets/images/perfil-com-imagem-{id}", "Image uses visitor credential and canonical public URL");
                Check(!handler.Resource.TryGetProperty("imageUploadId", out _), "Pending image ID stays out of public catalog");
            }
            using (var handler = new ProposalGitHub()) {
                var service = new ContributionService(new ProposalFactory(handler), settings, images);
                await service.Submit("user-token", new("courses", "Curso com imagem", "https://example.org/course", "Resumo do curso com imagem", "Descrição do curso com imagem", ["geral"], [], ["pt-BR"], ImageUploadId:id), catalog, default);
                Check(handler.ImageBytes!.SequenceEqual(png) && handler.Resource.GetProperty("imageUrl").GetString() == $"https://raw.githubusercontent.com/example/catalog/main/assets/images/curso-com-imagem-{id}", "Uploaded image is included in the direct PR");
                Check(handler.PullBase == "main" && handler.Discussions == 0, "Course image submission skips the forum");
            }
            foreach (var bytes in new[] {Array.Empty<byte>(), new byte[ContributionImages.MaximumBytes + 1], System.Text.Encoding.UTF8.GetBytes("<svg>image</svg>")}) {
                try { await images.Save(bytes, default); throw new Exception("Accepted invalid image"); } catch (ContributionRejectedException) { }
            }
            try { images.Require("../../secrets.png"); throw new Exception("Accepted traversal"); } catch (ContributionRejectedException) { }
        } finally { if (Directory.Exists(folder)) Directory.Delete(folder, true); }
        foreach (var imageUrl in new[] {"http://example.org/image.png", "https://127.0.0.1/image.png", "https://host.internal/image.png", "https://user:password@example.org/image.png"}) {
            using var handler = new ProposalGitHub();
            var service = new ContributionService(new ProposalFactory(handler), settings);
            try { await service.Submit("user-token", saved.ToDraft() with {ImageUrl=imageUrl}, catalog, default); throw new Exception("Accepted unsafe image URL"); } catch (ContributionRejectedException) { }
            Check(handler.Writes == 0, "Reject invalid image before GitHub access");
        }
        Console.WriteLine("Catalog proposals OK: every category opens a PR to main; visitor credentials, forks, permissions, metadata and images verified.");
    }
    static void Check(bool condition, string name) { if (!condition) throw new Exception(name); }
}

sealed class ProposalFactory(ProposalGitHub handler) : IHttpClientFactory
{ public HttpClient CreateClient(string name) => new(handler, false); }
sealed class ProposalGitHub : HttpMessageHandler
{
    public byte[]? ImageBytes;
    public string ImageBranch = "", ResourceBranch = "";
    public string Mode = "existing-fork", FileTarget = "", PullHead = "", PullBase = "", RequestedRef = "";
    public int Forks, Discussions, Writes;
    public bool UserTokenOnly = true;
    public JsonElement Resource;
    public string DiscussionBody = "";
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellation)
    {
        UserTokenOnly &= request.Headers.Authorization?.Parameter == "user-token";
        var path = request.RequestUri!.AbsolutePath;
        if (request.Method != HttpMethod.Get) Writes++;
        if (path == "/graphql") {
            Discussions++;
            using var body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellation));
            if (body.RootElement.GetProperty("query").GetString()!.Contains("mutation")) DiscussionBody = body.RootElement.GetProperty("variables").GetProperty("input").GetProperty("body").GetString()!;
            return Response(body.RootElement.GetProperty("query").GetString()!.Contains("mutation")
                ? new { data = new { createDiscussion = new { discussion = new { number = 8 } } } }
                : (object)new { data = new { repository = new { id = "repo", isPrivate = false, hasDiscussionsEnabled = true, discussionCategories = new { nodes = new[] { new { id = "ideas", name = "Ideias" } } } } } });
        }
        if (path == "/repos/example/catalog" && request.Method == HttpMethod.Get)
            return Response(new { @private = Mode == "private", default_branch = "main", permissions = new { push = Mode == "maintainer" } });
        if (path == "/user") return Response(new { login = "ana" });
        if (path == "/repos/ana/catalog") {
            if (Mode == "new-fork" && Forks == 0) return new(HttpStatusCode.NotFound);
            return Response(new { @private = false, fork = true, source = new { full_name = Mode == "wrong-fork" ? "other/catalog" : "example/catalog" } });
        }
        if (path == "/repos/example/catalog/forks") { Forks++; return Response(new { full_name = "ana/catalog" }, HttpStatusCode.Accepted); }
        if (path.Contains("/git/ref/heads/")) { RequestedRef = path.Split("/git/ref/heads/")[1]; return Response(new { @object = new { sha = "upstream-sha" } }); }
        if (path.EndsWith("/git/refs")) {
            using var payload = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellation));
            if (payload.RootElement.GetProperty("sha").GetString() != "upstream-sha") throw new Exception("Fork branch does not start from current upstream");
            return Response(new { }, HttpStatusCode.Created);
        }
        if (path.Contains("/contents/assets/images/")) {
            using var payload = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellation));
            ImageBytes = Convert.FromBase64String(payload.RootElement.GetProperty("content").GetString()!);
            ImageBranch = payload.RootElement.GetProperty("branch").GetString()!;
            return Response(new { }, HttpStatusCode.Created);
        }
        if (path.Contains("/contents/data/")) {
            FileTarget = path;
            using var payload = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellation));
            ResourceBranch = payload.RootElement.GetProperty("branch").GetString()!;
            using var content = JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(payload.RootElement.GetProperty("content").GetString()!)));
            Resource = content.RootElement.Clone();
            return Response(new { }, HttpStatusCode.Created);
        }
        if (path == "/repos/example/catalog/pulls") {
            using var payload = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellation));
            PullHead = payload.RootElement.GetProperty("head").GetString()!;
            PullBase = payload.RootElement.GetProperty("base").GetString()!;
            return Response(new { html_url = "https://github.com/example/catalog/pull/10" }, HttpStatusCode.Created);
        }
        throw new Exception("Unexpected GitHub request: " + request.Method + " " + path);
    }
    static HttpResponseMessage Response(object body, HttpStatusCode status = HttpStatusCode.OK)
        => new(status) { Content = new StringContent(JsonSerializer.Serialize(body)) };
}

sealed class ImageEnvironment : Microsoft.AspNetCore.Hosting.IWebHostEnvironment
{
    public string ContentRootPath {get;set;} = "";
    public string WebRootPath {get;set;} = "";
    public string EnvironmentName {get;set;} = "Development";
    public string ApplicationName {get;set;} = "Test";
    public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider {get;set;} = new Microsoft.Extensions.FileProviders.NullFileProvider();
    public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider {get;set;} = new Microsoft.Extensions.FileProviders.NullFileProvider();
}
