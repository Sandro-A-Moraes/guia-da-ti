using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

static class StudyChecks
{
    public static async Task Run()
    {
        var folder = Path.Combine(Path.GetTempPath(), "guia-study-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);
        try {
            var path = Path.Combine(folder,"activity.json");
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> {
                ["STUDY_ACTIVITY_PATH"]=path,["COMMUNITY_USERS_PATH"]=Path.Combine(folder,"users.json"),["DISCUSSIONS_TOKEN"]="read-only-test",["DISCUSSIONS_REPOSITORY"]="example/community"
            }).Build();
            var resource = new Resource("book","books","Livro","Resumo","Descrição","https://example.com/book",[],[],["pt-BR"],"2026-10-07",false);
            var otherResource = resource with {Slug="other"};
            var catalog = new Catalog(1,new([],[],[],["books"]),[resource,otherResource,resource with {Slug="demo",Demo=true}]);
            var environment = new StudyEnvironment { ContentRootPath=folder };
            var handler=new StudyGitHub(resource);var factory=new StudyFactory(handler);
            using var reader=new DiscussionsClient(factory,config);var writer=new DiscussionWriter(factory,config);
            var activity=new StudyEngagement(config,environment,catalog,reader,writer);
            Assert((await activity.ListAsync(null,default))[0] is {Ratings:0,Hypes:0,Average:null,Comments:0},"Empty data is not seeded with fictional votes");
            await activity.VoteAsync(resource,"1",new(Rating:5),default);
            await activity.VoteAsync(resource,"1",new(Rating:3,Hype:true),default);
            await activity.VoteAsync(resource,"2",new(Rating:5),default);
            var summary=(await activity.ListAsync("1",default))[0];
            Assert(summary is {Ratings:2,Average:4,Hypes:1,MyRating:3,MyHype:true},"One mutable vote per stable GitHub account");
            await Task.WhenAll(Enumerable.Range(3,20).Select(id=>activity.VoteAsync(resource,id.ToString(),new(Hype:true),default)));
            var restarted=new StudyEngagement(config,environment,catalog,reader,writer);
            Assert((await restarted.ListAsync("1",default))[0].Hypes==21,"Concurrent votes persist across restarts");
            await restarted.VoteAsync(resource,"1",new(Hype:false),default);
            Assert((await restarted.ListAsync("1",default))[0] is {Hypes:20,MyRating:3},"Removing hype preserves the rating");
            foreach(var vote in new[]{new StudyVote(Rating:0),new StudyVote(Rating:6),new StudyVote()}) {
                try {await restarted.VoteAsync(resource,"1",vote,default);throw new Exception("Invalid vote accepted");}catch(ArgumentException){}
            }
            var first=await activity.CommentAsync(resource,"visitor-token","Primeira experiência",default);
            Assert(handler.TopicBody.Contains(resource.Url) && handler.TopicBody.Contains(resource.Description) && !handler.TopicBody.Contains("Primeira experiência"),"Resource opens the topic and first visitor message stays a comment");
            var second=await restarted.CommentAsync(resource,"visitor-token","Outra experiência",default);
            Assert(first==7 && second==7 && handler.Topics==1 && handler.Comments==2 && handler.VisitorOnly,"Comments reuse one resource topic and visitor credentials");
            Assert((await activity.ListAsync("1",default))[0].Comments==2,"Only visitor comments count, not the resource presentation");
            handler.BlockMutations = true;
            var slowComment = activity.CommentAsync(resource, "visitor-token", "Comentário lento", default);
            try {
                await handler.MutationStarted.Task.WaitAsync(TimeSpan.FromSeconds(2));
                var otherVote = activity.VoteAsync(otherResource, "2", new(Rating: 5), default);
                var sameResourceVote = activity.VoteAsync(resource, "2", new(Hype: true), default);
                var activityRead = activity.ListAsync("1", default);
                Assert(await Task.WhenAny(otherVote, Task.Delay(TimeSpan.FromSeconds(2))) == otherVote,"A slow comment does not block another resource");
                Assert(await Task.WhenAny(sameResourceVote, Task.Delay(TimeSpan.FromSeconds(2))) == sameResourceVote,"A slow comment does not block a vote on the same resource");
                Assert(await Task.WhenAny(activityRead, Task.Delay(TimeSpan.FromSeconds(2))) == activityRead,"Activity reads do not wait for a slow comment");
                await otherVote;
                await sameResourceVote;
                await activityRead;
            }
            finally { handler.ReleaseMutations.TrySetResult(); }
            await slowComment;
            Assert((await activity.ListAsync("2",default))[0] is {Hypes:21,Ratings:2,MyHype:true},"A vote during a slow comment is preserved");
            handler.Unavailable=true;
            await reader.InvalidateAsync(default);
            Assert((await activity.ListAsync("1",default))[0] is {Comments:null,Hypes:21},"GitHub outages keep real votes and unknown comment counts");
            handler.Unavailable=false;
            // Lose only the mapping to reproduce a persistence failure after GitHub accepted a topic.
            await File.WriteAllTextAsync(path,"{\"version\":1,\"items\":{}}");
            await activity.CommentAsync(resource,"visitor-token","Recuperada",default);
            Assert(handler.Topics==1 && handler.Comments==4,"Recovery uses direct repository reads rather than delayed search indexing");
            await activity.VoteAsync(resource,"1",new(Rating:4,Hype:true),default);
            handler.Missing=true;
            await reader.InvalidateAsync(default);
            Assert((await activity.ListAsync("1",default))[0] is {Discussion:null,Comments:0,Ratings:1,Hypes:1},"Deleted discussions disappear without losing votes");
            await activity.CommentAsync(resource,"visitor-token","Nova conversa",default);
            Assert(handler.Topics==2 && (await activity.ListAsync("1",default))[0] is {Discussion:7,Ratings:1,Hypes:1},"Comment recreates a missing topic and preserves ratings");
            var valid=await File.ReadAllTextAsync(path);
            Assert(!valid.Contains("visitor-token") && !valid.Contains("Primeira experiência"),"Local activity excludes credentials and comment content");
            await File.WriteAllTextAsync(path,"broken");
            try {await activity.VoteAsync(resource,"3",new(Rating:4),default);throw new Exception("Corrupt store accepted");}catch(JsonException){}
            Assert(await File.ReadAllTextAsync(path)=="broken","Corrupt activity is never reset silently");
            await File.WriteAllTextAsync(path,valid);
            var linkedResource = resource with {Slug="approved-book", DiscussionNumber=7};
            var linkedCatalog = catalog with {Resources=[linkedResource]};
            var linkedHandler = new StudyGitHub(linkedResource) {Topics=1,OriginalSuggestion=true};
            var linkedFactory = new StudyFactory(linkedHandler);
            using var linkedReader = new DiscussionsClient(linkedFactory,config);
            var linkedActivity = new StudyEngagement(config,environment,linkedCatalog,linkedReader,new DiscussionWriter(linkedFactory,config));
            Assert((await linkedActivity.ListAsync(null,default))[0].Discussion==7,"Approved resource exposes original suggestion topic before comments");
            await linkedActivity.CommentAsync(linkedResource,"visitor-token","Comentário na sugestão",default);
            Assert(linkedHandler.Topics==1 && linkedHandler.Comments==1,"Approved resource comments use suggestion thread without creating another topic");
            Assert(await linkedActivity.UnlinkDiscussionAsync(7,default),"Moderators can remove a catalog discussion link without deleting its topic");
            Assert(await linkedActivity.LinkedResourceAsync(7,default) is null && (await linkedActivity.ListAsync(null,default))[0].Discussion is null,"An explicit unlink overrides a catalog discussion number");
            await linkedActivity.LinkDiscussionAsync(linkedResource,8,default);
            Assert((await linkedActivity.LinkedResourceAsync(8,default))?.Slug=="approved-book","A moderator can link an existing discussion to a resource");
            try { await linkedActivity.LinkDiscussionAsync(resource,8,default); throw new Exception("A discussion linked to two resources"); }
            catch (ArgumentException) { }
            Assert(await linkedActivity.UnlinkDiscussionAsync(8,default),"A moderator can remove a manually added link");
            var raceHandler = new StudyGitHub(resource) { BlockMutations=true };
            var raceFactory = new StudyFactory(raceHandler);
            var raceConfig = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> {
                ["STUDY_ACTIVITY_PATH"]=Path.Combine(folder,"race-activity.json"),["COMMUNITY_USERS_PATH"]=Path.Combine(folder,"race-users.json"),
                ["DISCUSSIONS_TOKEN"]="read-only-test",["DISCUSSIONS_REPOSITORY"]="example/community"
            }).Build();
            using var raceReader = new DiscussionsClient(raceFactory, raceConfig);
            var race = new StudyEngagement(raceConfig,environment,catalog,raceReader,new DiscussionWriter(raceFactory,raceConfig));
            var firstRace = race.CommentAsync(resource,"visitor-token","Corrida A",default);
            var secondRace = race.CommentAsync(resource,"visitor-token","Corrida B",default);
            try {
                await raceHandler.MutationStarted.Task.WaitAsync(TimeSpan.FromSeconds(2));
                await Task.Delay(300);
            }
            finally { raceHandler.ReleaseMutations.TrySetResult(); }
            await Task.WhenAll(firstRace,secondRace);
            Assert(raceHandler.Topics==1 && raceHandler.Comments==2,"Concurrent first comments on a new resource create a single topic");
            await EndpointChecks(config,catalog,activity,folder);
            Console.WriteLine("Study OK: persistent votes, deduplication, concurrency, topic reuse/recovery, visitor credentials, corruption, authentication and CSRF.");
        }
        finally {
            if(!Path.GetFullPath(folder).StartsWith(Path.GetFullPath(Path.GetTempPath()),StringComparison.OrdinalIgnoreCase))throw new Exception("Invalid test folder");
            Directory.Delete(folder,true);
        }
    }
    private static async Task EndpointChecks(IConfiguration configuration,Catalog catalog,StudyEngagement activity,string folder)
    {
        var builder=WebApplication.CreateBuilder(new WebApplicationOptions {EnvironmentName=Environments.Development});
        builder.Configuration.Sources.Clear();builder.Configuration.AddConfiguration(configuration);builder.Logging.ClearProviders();
        builder.Configuration["AUTH_STORAGE_PATH"] = Path.Combine(folder, "auth");
        builder.Services.AddSingleton(TimeProvider.System);builder.Services.AddSingleton(catalog);builder.Services.AddSingleton(activity);builder.Services.AddSingleton(new DiscussionWriter(new StudyFactory(new StudyGitHub(catalog.Resources[0]) {Topics=1}),configuration));
        builder.AddCommunityAuth();builder.WebHost.UseSetting("urls","http://127.0.0.1:0");
        await using var app=builder.Build();app.UseAuthentication();app.MapCommunityAuth();app.MapStudyEngagement();app.MapDiscussionResourceLinks();
        app.MapGet("/test/login",async (Microsoft.AspNetCore.Http.HttpContext context)=>{
            var properties=new AuthenticationProperties();
            properties.StoreTokens([new AuthenticationToken {Name="access_token",Value="visitor-token"}]);
            await context.SignInAsync(new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,"123"),new Claim(ClaimTypes.Name,"test")],CookieAuthenticationDefaults.AuthenticationScheme)),properties);
        });
        await app.StartAsync();
        try {
            using var http=new HttpClient {BaseAddress=new Uri(app.Urls.Single())};
            Assert((await http.PostAsJsonAsync("/api/study/books/book/vote",new {rating=5})).StatusCode==HttpStatusCode.Unauthorized,"Anonymous writes rejected");
            Assert((await http.PostAsJsonAsync("/api/study/books/book/comments",new {body="Texto"})).StatusCode==HttpStatusCode.Unauthorized,"Comments require visitor OAuth credential");
            Assert((await http.GetAsync("/api/discussions/7/resource-link")).StatusCode==HttpStatusCode.Unauthorized,"Resource link status requires sign-in");
            (await http.GetAsync("/test/login")).EnsureSuccessStatusCode();
            Assert((await http.PostAsJsonAsync("/api/study/books/book/vote",new {rating=5})).StatusCode==HttpStatusCode.BadRequest,"Missing CSRF rejected");
            using var session=JsonDocument.Parse(await http.GetStringAsync("/api/auth/session"));
            http.DefaultRequestHeaders.Add("X-CSRF-Token",session.RootElement.GetProperty("csrfToken").GetString());
            (await http.PostAsJsonAsync("/api/study/books/book/vote",new {rating=5})).EnsureSuccessStatusCode();
            Assert((await http.PostAsJsonAsync("/api/study/creators/book/vote",new {rating=5})).StatusCode==HttpStatusCode.NotFound,"Study endpoints exclude creators and communities");
            Assert((await http.PostAsJsonAsync("/api/study/books/demo/vote",new {rating=5})).StatusCode==HttpStatusCode.BadRequest,"Fictional catalog items reject real votes");
            var response=await http.GetAsync("/api/study/activity");Assert(response.Headers.CacheControl?.NoStore==true,"User-specific ratings are not cached");
            var text=await response.Content.ReadAsStringAsync();Assert(!text.Contains("votes")&&!text.Contains("123"),"Public response excludes account IDs and vote registry");
            var linkStatus=await http.GetFromJsonAsync<JsonElement>("/api/discussions/7/resource-link");Assert(linkStatus.GetProperty("allowed").GetBoolean(),"Only repository maintainers can manage resource links");
            var linked=await http.PostAsJsonAsync("/api/discussions/7/resource-link",new {type="books",slug="book"});linked.EnsureSuccessStatusCode();
            Assert((await http.GetFromJsonAsync<JsonElement>("/api/discussions/7/resource-link")).GetProperty("resource").GetProperty("slug").GetString()=="book","Moderator link is visible to review");
            Assert((await http.DeleteAsync("/api/discussions/7/resource-link")).StatusCode==HttpStatusCode.NoContent,"Moderator can remove a resource link without deleting the forum topic");
        }finally{await app.StopAsync();}
    }
    private static void Assert(bool ok,string message){if(!ok)throw new Exception(message);}
    private sealed class StudyEnvironment:IHostEnvironment {
        public string EnvironmentName {get;set;}=Environments.Development;public string ApplicationName {get;set;}="StudyChecks";public string ContentRootPath {get;set;}="";
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider {get;set;}=new Microsoft.Extensions.FileProviders.NullFileProvider();
    }
}
sealed class StudyFactory(StudyGitHub handler):IHttpClientFactory {public HttpClient CreateClient(string name)=>new(handler,false);}
sealed class StudyGitHub(Resource resource):HttpMessageHandler
{
    public int Topics;public int Comments;public bool VisitorOnly=true;public bool Unavailable;public bool Missing;
    public string TopicBody = "";
    public bool OriginalSuggestion;
    public bool BlockMutations;
    public TaskCompletionSource MutationStarted { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public TaskCompletionSource ReleaseMutations { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken cancellation)
    {
        if(Unavailable)return new(HttpStatusCode.ServiceUnavailable){Content=JsonContent.Create(new {})};
        using var payload=JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellation));var query=payload.RootElement.GetProperty("query").GetString()!;
        if(BlockMutations && query.Contains("mutation",StringComparison.Ordinal)) {
            MutationStarted.TrySetResult();
            await ReleaseMutations.Task.WaitAsync(cancellation);
        }
        object data;
        if(query.Contains("mutation")) {
            VisitorOnly&=request.Headers.Authorization?.Parameter=="visitor-token";
            if(query.Contains("createDiscussion")){Topics++;Missing=false;TopicBody=payload.RootElement.GetProperty("variables").GetProperty("input").GetProperty("body").GetString()!;data=new {createDiscussion=new {discussion=new {number=7}}};}
            else{Comments++;data=new {addDiscussionComment=new {comment=new {id="comment"}}};}
        }else{
            var category=new {id="general",name="Geral"};var pageInfo=new {hasNextPage=false,endCursor=(string?)null};
            var thread=new {number=7,id="topic-7",title=OriginalSuggestion?$"[Sugestão] {resource.Name}":StudyEngagement.TopicTitle(resource),bodyText=TopicBody,category,author=new {login="visitor"},updatedAt="2026-10-07T12:00:00Z",isAnswered=false,locked=false,closed=false,comments=new {totalCount=Comments,pageInfo,nodes=Array.Empty<object>()}};
            data=new {repository=new {id="repo",isPrivate=false,hasDiscussionsEnabled=true,viewerPermission="WRITE",discussionCategories=new {nodes=new[]{category}},discussions=new {pageInfo,nodes=Topics==0||Missing?[]:new[]{thread}},discussion=Missing?(object?)null:thread}};
        }
        return new(HttpStatusCode.OK){Content=JsonContent.Create(new {data})};
    }
}
