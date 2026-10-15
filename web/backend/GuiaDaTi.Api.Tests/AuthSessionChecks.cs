using System.Net;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

static class AuthSessionChecks
{
    public static async Task Run()
    {
        var folder = Path.Combine(Path.GetTempPath(), "guia-auth-tests-" + Guid.NewGuid().ToString("N"));
        var clock = new SessionClock();
        var cookies = new CookieContainer();
        using var handler = new HttpClientHandler { CookieContainer = cookies };
        var github = new RevocationHandler();
        var privateFolder = UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute;
        try {
            // Folders from older versions may have been created with broader permissions.
            if (!OperatingSystem.IsWindows()) Directory.CreateDirectory(Path.Combine(folder, "sessions"), privateFolder | UnixFileMode.GroupRead | UnixFileMode.GroupExecute | UnixFileMode.OtherRead | UnixFileMode.OtherExecute);
            await using (var app = CreateApp(folder, clock, github)) {
                await app.StartAsync();
                using var client = new HttpClient(handler, disposeHandler: false) { BaseAddress = new Uri(app.Urls.Single()) };
                using var login = await client.GetAsync("/test/login");
                login.EnsureSuccessStatusCode();
                var header = login.Headers.GetValues("Set-Cookie").Single(value => value.StartsWith("guia.session="));
                Assert(header.Contains("httponly", StringComparison.OrdinalIgnoreCase) && header.Contains("expires=", StringComparison.OrdinalIgnoreCase), "Persistent HttpOnly login cookie");
                Assert(!header.Contains("visitor-token"), "Browser never receives OAuth credential");
                Assert(await Login(client) == "member", "Authenticated session before restart");
                var data = await File.ReadAllBytesAsync(Directory.GetFiles(Path.Combine(folder, "sessions"), "*.ticket").Single());
                Assert(!System.Text.Encoding.UTF8.GetString(data).Contains("visitor-token"), "Server session encrypts visitor credential");
                if (!OperatingSystem.IsWindows()) {
                    foreach (var path in new[] { folder, Path.Combine(folder, "sessions"), Path.Combine(folder, "keys") })
                        Assert(File.GetUnixFileMode(path) == privateFolder, $"Private storage folder {Path.GetFileName(path)}, including existing folders");
                    Assert(File.GetUnixFileMode(Directory.GetFiles(Path.Combine(folder, "sessions"), "*.ticket").Single()) == (UnixFileMode.UserRead | UnixFileMode.UserWrite), "Session files are readable only by the server user");
                }
                await app.StopAsync();
            }
            await using (var app = CreateApp(folder, clock, github)) {
                await app.StartAsync();
                using var client = new HttpClient(handler, disposeHandler: false) { BaseAddress = new Uri(app.Urls.Single()) };
                Assert(await Login(client) == "member", "Same browser cookie survives server restart and key-ring reload");
                clock.Now = clock.Now.AddDays(4);
                using var renewed = await client.GetAsync("/api/auth/session");
                Assert(renewed.Headers.TryGetValues("Set-Cookie", out var headers) && headers.Any(value => value.StartsWith("guia.session=")), "Activity renews cookie after half the validity window");
                clock.Now = clock.Now.AddDays(4);
                Assert(await Login(client) == "member", "Renewed session survives original expiration");
                await Logout(client);
                Assert(await Login(client) is null, "Logout revokes session");
                Assert(github.Requests == 1 && github.Method == HttpMethod.Delete && github.Path == "/applications/test-client/token"
                    && github.Body.Contains("\"visitor-token\"") && github.Authorization == "Basic " + Convert.ToBase64String("test-client:test-secret"u8.ToArray()),
                    "Logout revokes the session token on GitHub with the app credentials");
                github.Status = HttpStatusCode.ServiceUnavailable;
                (await client.GetAsync("/test/login")).EnsureSuccessStatusCode();
                await Logout(client);
                Assert(await Login(client) is null && github.Requests == 2, "GitHub revocation failure does not keep the local session");

                var tickets = app.Services.GetRequiredService<ServerTickets>();
                var ticket = Ticket(clock.Now.AddMinutes(5));
                var key = await tickets.StoreAsync(ticket);
                Assert((await tickets.RetrieveAsync(key))?.Properties.GetTokenValue("access_token") == "visitor-token", "Server can recover protected OAuth credential");
                await tickets.RemoveAsync(key);
                await tickets.RenewAsync(key, ticket);
                Assert(await tickets.RetrieveAsync(key) is null, "In-flight renewal cannot restore logged-out session");
                key = await tickets.StoreAsync(ticket);
                clock.Now = clock.Now.AddMinutes(6);
                Assert(await tickets.RetrieveAsync(key) is null, "Expired session is rejected and removed");
                key = await tickets.StoreAsync(Ticket(clock.Now.AddMinutes(5)));
                await File.WriteAllBytesAsync(Path.Combine(folder, "sessions", key + ".ticket"), [1, 2, 3]);
                Assert(await tickets.RetrieveAsync(key) is null, "Tampered session is rejected");
                Assert(await tickets.RetrieveAsync("../../keys/key") is null, "Session IDs cannot escape storage folder");

                var sessions = Path.Combine(folder, "sessions");
                var abandoned = await tickets.StoreAsync(Ticket(clock.Now.AddMinutes(5)));
                var active = await tickets.StoreAsync(Ticket(clock.Now.AddDays(7)));
                clock.Now = clock.Now.AddDays(1);
                var next = await tickets.StoreAsync(Ticket(clock.Now.AddDays(7)));
                Assert(!File.Exists(Path.Combine(sessions, abandoned + ".ticket")), "Daily sweep removes expired sessions that were never retrieved");
                Assert(await tickets.RetrieveAsync(active) is not null && await tickets.RetrieveAsync(next) is not null, "Sweep keeps active sessions");
                var unreadable = Path.Combine(sessions, new string('a', 64) + ".ticket");
                var interrupted = Path.Combine(sessions, active + ".ticket.0123.tmp");
                await File.WriteAllBytesAsync(unreadable, [1, 2, 3]);
                await File.WriteAllBytesAsync(interrupted, [1, 2, 3]);
                var restarted = new ServerTickets(app.Configuration, app.Environment, app.Services.GetRequiredService<IDataProtectionProvider>(), clock);
                Assert(!File.Exists(unreadable) && !File.Exists(interrupted), "Startup removes unreadable sessions and interrupted writes");
                Assert(await restarted.RetrieveAsync(active) is not null, "Startup sweep keeps active sessions");
                await app.StopAsync();
            }
            Console.WriteLine("Auth sessions OK: restart persistence, encrypted tokens, private files, persistent cookies, sliding renewal, expiry, sweep, logout with GitHub revocation and tampering.");
        }
        finally {
            if (!Path.GetFullPath(folder).StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Invalid test cleanup path.");
            if (Directory.Exists(folder)) Directory.Delete(folder, recursive: true);
        }
    }

    static WebApplication CreateApp(string folder, SessionClock clock, RevocationHandler github)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Development" });
        builder.Configuration.Sources.Clear();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?> {
            ["AUTH_STORAGE_PATH"] = folder, ["COMMUNITY_USERS_PATH"] = Path.Combine(folder, "users.json"),
            ["GITHUB_CLIENT_ID"] = "test-client", ["GITHUB_CLIENT_SECRET"] = "test-secret"
        });
        builder.Logging.ClearProviders();
        builder.Services.AddSingleton<TimeProvider>(clock);
        builder.AddCommunityAuth();
        builder.Services.AddHttpClient("github-oauth").ConfigurePrimaryHttpMessageHandler(() => github);
        builder.Services.Configure<CookieAuthenticationOptions>(CookieAuthenticationDefaults.AuthenticationScheme, options => options.TimeProvider = clock);
        builder.WebHost.UseSetting("urls", "http://127.0.0.1:0");
        var app = builder.Build();
        app.UseAuthentication();
        app.MapCommunityAuth();
        // Test-only route. Production identities still come exclusively from GitHub OAuth.
        app.MapGet("/test/login", async (Microsoft.AspNetCore.Http.HttpContext context) => {
            var ticket = Ticket(clock.Now.AddDays(7));
            await context.SignInAsync(ticket.Principal, ticket.Properties);
        });
        return app;
    }

    static AuthenticationTicket Ticket(DateTimeOffset expires)
    {
        var properties = new AuthenticationProperties { IsPersistent = true, ExpiresUtc = expires };
        properties.StoreTokens([new AuthenticationToken { Name = "access_token", Value = "visitor-token" }]);
        return new(new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Name, "member")], CookieAuthenticationDefaults.AuthenticationScheme)), properties, CookieAuthenticationDefaults.AuthenticationScheme);
    }

    static async Task<string?> Login(HttpClient client)
    {
        using var session = JsonDocument.Parse(await client.GetStringAsync("/api/auth/session"));
        return session.RootElement.GetProperty("login").GetString();
    }
    static async Task Logout(HttpClient client)
    {
        using var session = JsonDocument.Parse(await client.GetStringAsync("/api/auth/session"));
        using var logout = new HttpRequestMessage(HttpMethod.Post, "/api/auth/logout");
        logout.Headers.Add("X-CSRF-Token", session.RootElement.GetProperty("csrfToken").GetString());
        (await client.SendAsync(logout)).EnsureSuccessStatusCode();
    }
    static void Assert(bool value, string message) { if (!value) throw new Exception(message); }
    // The handler outlives each test app, so the HTTP client factory must not dispose it.
    sealed class RevocationHandler : DelegatingHandler
    {
        public int Requests; public HttpMethod? Method; public string? Path; public string? Authorization; public string Body = "";
        public HttpStatusCode Status = HttpStatusCode.NoContent;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests++; Method = request.Method; Path = request.RequestUri!.AbsolutePath; Authorization = request.Headers.Authorization?.ToString();
            Body = await request.Content!.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(Status);
        }
        protected override void Dispose(bool disposing) { }
    }
    sealed class SessionClock : TimeProvider
    {
        public DateTimeOffset Now = DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow() => Now;
    }
}
