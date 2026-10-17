using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

static class AdvertisingChecks
{
    public static async Task Run()
    {
        var folder = Path.Combine(Path.GetTempPath(), "guia-ads-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);
        var clock = new AdClock();
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Development", ContentRootPath = folder });
        builder.Configuration.Sources.Clear();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?> {
            ["AUTH_STORAGE_PATH"] = Path.Combine(folder, "auth"), ["COMMUNITY_USERS_PATH"] = Path.Combine(folder, "users.json"),
            ["ADS_STORAGE_PATH"] = Path.Combine(folder, "ads.json")
        });
        builder.Logging.ClearProviders();
        var audit = new AuditCapture();
        builder.Logging.AddProvider(audit);
        builder.Services.AddSingleton<TimeProvider>(clock);
        builder.AddCommunityAuth();
        builder.Services.Configure<CookieAuthenticationOptions>(CookieAuthenticationDefaults.AuthenticationScheme, options => options.TimeProvider = clock);
        builder.Services.AddSingleton<ContributionImages>();
        builder.Services.AddSingleton<Advertising>();
        builder.WebHost.UseSetting("urls", "http://127.0.0.1:0");
        await using var app = builder.Build();
        app.UseAuthentication(); app.MapCommunityAuth(); app.MapAdvertising();
        // Test-only identities. These routes do not exist in the real application.
        app.MapGet("/test/login/{id}", async (string id, HttpContext context) => {
            await context.SignInAsync(new ClaimsPrincipal(new ClaimsIdentity([
                new Claim(ClaimTypes.NameIdentifier, id), new Claim(ClaimTypes.Name, "LucasPedruo")
            ], CookieAuthenticationDefaults.AuthenticationScheme)));
        });
        await app.StartAsync();
        try {
            using var handler = new HttpClientHandler { CookieContainer = new CookieContainer(), AllowAutoRedirect = false };
            using var client = new HttpClient(handler) { BaseAddress = new Uri(app.Urls.Single()) };
            Check((await client.GetAsync("/api/admin/ads")).StatusCode == HttpStatusCode.Unauthorized, "Anonymous admin read rejected");
            (await client.GetAsync("/test/login/999")).EnsureSuccessStatusCode();
            Check((await client.GetAsync("/api/admin/ads")).StatusCode == HttpStatusCode.Forbidden, "Matching login name with a different ID rejected");
            Check(audit.Events.Count == 0, "Reads and anonymous attempts are not audited");
            var denied = await client.PutAsJsonAsync("/api/admin/ads/enabled", new AdToggle(false));
            Check(denied.StatusCode == HttpStatusCode.Forbidden, "Non-admin write rejected");
            var deniedEvent = audit.Last("ads.disable");
            Check(deniedEvent["Actor"] == "999" && deniedEvent["Outcome"] == "forbidden" && deniedEvent["Status"] == "403" && deniedEvent["Target"] == "global", "Rejected admin write records who tried it");
            (await client.GetAsync("/test/login/147441250")).EnsureSuccessStatusCode();
            using var session = JsonDocument.Parse(await client.GetStringAsync("/api/auth/session"));
            Check(session.RootElement.GetProperty("canManageAds").GetBoolean(), "Owner receives admin capability");
            (await client.GetAsync("/api/admin/ads")).EnsureSuccessStatusCode();
            var draft = new AdDraft("Example", "Campaign", "Description", "https://example.com", null, ["forum-feed"], 1, true, clock.Now, clock.Now.AddHours(2));
            var noCsrf = await client.PostAsJsonAsync("/api/admin/ads/campaigns", draft);
            Check(noCsrf.StatusCode == HttpStatusCode.BadRequest, "CSRF required for owner writes");
            var csrfEvent = audit.Last("campaign.create");
            Check(csrfEvent["Actor"] == "147441250" && csrfEvent["Outcome"] == "csrf" && csrfEvent["Target"] == "new", "CSRF failure is audited");
            Check(csrfEvent["RequestId"] == noCsrf.Headers.GetValues("X-Request-Id").Single(), "Audit event matches the response request ID");
            client.DefaultRequestHeaders.Add("X-CSRF-Token", session.RootElement.GetProperty("csrfToken").GetString());
            var settings = AdSettings.Default with { MaxCampaigns = 2, Placements = AdSettings.Default.Placements.Select(p => p with { Capacity = 1 }).ToArray() };
            (await client.PutAsJsonAsync("/api/admin/ads/settings", settings)).EnsureSuccessStatusCode();
            var created = await client.PostAsJsonAsync("/api/admin/ads/campaigns", draft);
            created.EnsureSuccessStatusCode();
            var first = (await created.Content.ReadFromJsonAsync<AdCampaign>())!;
            var createEvent = audit.Last("campaign.create");
            Check(createEvent["Outcome"] == "success" && createEvent["Target"] == first.Id.ToString() && createEvent["Status"] == "200"
                && createEvent["RequestId"] == created.Headers.GetValues("X-Request-Id").Single() && DateTimeOffset.TryParse(createEvent["At"], out _), "Creation records actor, campaign, result, request and time");
            Check(audit.Last("settings.update")["Outcome"] == "success", "Settings change is audited");
            Check((await client.PostAsJsonAsync("/api/admin/ads/campaigns", draft with { StartsAt = clock.Now.AddHours(1), EndsAt = clock.Now.AddHours(3) })).StatusCode == HttpStatusCode.BadRequest, "Future overlap exceeds capacity even before it begins");
            var adjacent = await client.PostAsJsonAsync("/api/admin/ads/campaigns", draft with { StartsAt = clock.Now.AddHours(2), EndsAt = clock.Now.AddHours(3) });
            adjacent.EnsureSuccessStatusCode();
            var second = (await adjacent.Content.ReadFromJsonAsync<AdCampaign>())!;
            Check((await client.PostAsJsonAsync("/api/admin/ads/campaigns", draft with { Enabled = false })).StatusCode == HttpStatusCode.BadRequest, "Paused campaigns still count toward registration limit");
            Check((await client.PutAsJsonAsync($"/api/admin/ads/campaigns/{first.Id}", draft with { Url = "javascript:alert(1)" })).StatusCode == HttpStatusCode.BadRequest, "Unsafe destination rejected");
            var rejected = audit.Last("campaign.update");
            Check(rejected["Outcome"] == "validation" && rejected["Status"] == "400" && rejected["Target"] == first.Id.ToString(), "Validation failure is audited");
            var missing = Guid.NewGuid();
            Check((await client.PutAsJsonAsync($"/api/admin/ads/campaigns/{missing}", draft)).StatusCode == HttpStatusCode.NotFound, "Unknown campaign reports not found");
            Check(audit.Last("campaign.update")["Outcome"] == "not_found" && audit.Last("campaign.update")["Target"] == missing.ToString(), "Missing campaign is audited");
            Check((await client.PutAsJsonAsync($"/api/admin/ads/campaigns/{first.Id}", draft with { ImageUrl = "/api/contributions/images/../../keys" })).StatusCode == HttpStatusCode.BadRequest, "Image traversal rejected");
            settings = settings with { Placements = settings.Placements.Select(p => p with { Capacity = 2 }).ToArray() };
            (await client.PutAsJsonAsync("/api/admin/ads/settings", settings)).EnsureSuccessStatusCode();
            (await client.PutAsJsonAsync($"/api/admin/ads/campaigns/{second.Id}", draft with { Title = "Second", Weight = 10 })).EnsureSuccessStatusCode();
            Check(audit.Last("campaign.update")["Outcome"] == "success", "Edit is audited");
            (await client.PutAsJsonAsync($"/api/admin/ads/campaigns/{first.Id}", draft with { Enabled = false })).EnsureSuccessStatusCode();
            Check(audit.Last("campaign.pause")["Target"] == first.Id.ToString(), "Pause is audited as its own action");
            (await client.PutAsJsonAsync($"/api/admin/ads/campaigns/{first.Id}", draft)).EnsureSuccessStatusCode();
            Check(audit.Last("campaign.resume")["Outcome"] == "success", "Resume is audited as its own action");
            var selection = (await client.GetFromJsonAsync<AdSelection>("/api/ads/select?placement=forum-feed"))!;
            Check(selection.Ad is not null, "Active campaign selected");
            var alternate = (await client.GetFromJsonAsync<AdSelection>($"/api/ads/select?placement=forum-feed&previous={selection.Ad!.Id}"))!;
            Check(alternate.Ad?.Id != selection.Ad.Id && alternate.Ad is not null, "Rotation avoids immediately repeating a creative");
            (await client.PostAsJsonAsync("/api/ads/impression", new AdEvent(selection.Ad.Ticket))).EnsureSuccessStatusCode();
            (await client.PostAsJsonAsync("/api/ads/impression", new AdEvent(selection.Ad.Ticket))).EnsureSuccessStatusCode();
            var click = await client.GetAsync(selection.Ad.ClickUrl);
            Check(click.StatusCode == HttpStatusCode.Redirect && click.Headers.Location?.AbsoluteUri == new Uri(draft.Url).AbsoluteUri, "Signed click goes to configured destination");
            (await client.GetAsync(selection.Ad.ClickUrl)).EnsureSuccessStatusCodeOrRedirect();
            Check((await client.PostAsJsonAsync("/api/ads/impression", new AdEvent("forged-ticket"))).StatusCode == HttpStatusCode.BadRequest, "Unsigned tracking rejected");
            var service = app.Services.GetRequiredService<Advertising>();
            var snapshot = await service.Snapshot();
            var counted = snapshot.Campaigns.Single(c => c.Id == selection.Ad.Id);
            Check(counted.Impressions == 1 && counted.Clicks == 1, "Repeated tracking ticket counts once per event");
            (await client.PutAsJsonAsync("/api/admin/ads/enabled", new AdToggle(false))).EnsureSuccessStatusCode();
            Check(audit.Last("ads.disable")["Outcome"] == "success", "Global switch is audited");
            Check((await client.GetFromJsonAsync<AdSelection>("/api/ads/select?placement=forum-feed"))!.Ad is null, "Global switch suppresses eligible advertisements");
            Check(!(await client.GetFromJsonAsync<AdSelection>("/api/ads/select?placement=forum-feed"))!.Enabled, "Global disable signals frontend to hide the entire reserved space");
            var disabledRestart = new Advertising(builder.Configuration, app.Environment, clock, app.Services.GetRequiredService<IDataProtectionProvider>(), app.Services.GetRequiredService<ContributionImages>());
            Check(!(await disabledRestart.Snapshot()).Enabled && (await disabledRestart.Select("forum-feed", null)).Ad is null, "Global disable survives restart");
            Check((await service.Snapshot()).Campaigns.All(c => c.Content.Enabled), "Global switch preserves campaign enablement");
            (await client.PostAsJsonAsync("/api/ads/impression", new AdEvent(alternate.Ad!.Ticket))).EnsureSuccessStatusCode();
            Check((await service.Snapshot()).Campaigns.Single(c => c.Id == alternate.Ad.Id).Impressions == 0, "Previously issued impressions do not count while globally disabled");
            (await client.PutAsJsonAsync("/api/admin/ads/enabled", new AdToggle(true))).EnsureSuccessStatusCode();
            Check((await client.GetFromJsonAsync<AdSelection>("/api/ads/select?placement=forum-feed"))!.Ad is not null, "Global switch resumes scheduled advertisements");
            var restarted = new Advertising(builder.Configuration, app.Environment, clock, app.Services.GetRequiredService<IDataProtectionProvider>(), app.Services.GetRequiredService<ContributionImages>());
            Check(JsonSerializer.Serialize((await restarted.Snapshot()).Campaigns.Single(c => c.Id == counted.Id)) == JsonSerializer.Serialize(counted), "Campaigns and counters survive a service restart");
            clock.Now = clock.Now.AddDays(1);
            Check((await client.GetFromJsonAsync<AdSelection>("/api/ads/select?placement=forum-feed"))!.Ad is null, "Ended campaigns are not served");
            Check((await client.GetAsync(selection.Ad.ClickUrl)).StatusCode == HttpStatusCode.BadRequest, "Expired click ticket rejected");
            (await client.DeleteAsync($"/api/admin/ads/campaigns/{first.Id}")).EnsureSuccessStatusCode();
            (await client.DeleteAsync($"/api/admin/ads/campaigns/{second.Id}")).EnsureSuccessStatusCode();
            var deleted = audit.Last("campaign.delete");
            Check(deleted["Outcome"] == "success" && deleted["Target"] == second.Id.ToString() && deleted["Status"] == "204", "Deletion is audited");
            settings = settings with { MaxCampaigns = 100, Placements = settings.Placements.Select(p => p with { Capacity = 1 }).ToArray() };
            (await client.PutAsJsonAsync("/api/admin/ads/settings", settings)).EnsureSuccessStatusCode();
            var competing = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => client.PostAsJsonAsync("/api/admin/ads/campaigns", draft with { StartsAt = clock.Now, EndsAt = clock.Now.AddHours(1) })));
            Check(competing.Count(r => r.IsSuccessStatusCode) == 1 && competing.Count(r => r.StatusCode == HttpStatusCode.BadRequest) == 1, "Concurrent reservations cannot overbook capacity");
            var banner = await client.PostAsJsonAsync("/api/admin/ads/campaigns", draft with { Company = "", Title = "", Description = "", ImageUrl = "https://example.com/banner.png", Enabled = false });
            banner.EnsureSuccessStatusCode();
            var savedBanner = (await banner.Content.ReadFromJsonAsync<AdCampaign>())!;
            Check(savedBanner.Content.Title == "" && savedBanner.Content.Description == "" && savedBanner.Content.Company == "Anunciante", "Image-and-link campaign does not require text or company");
            Check((await client.PostAsJsonAsync("/api/admin/ads/campaigns", draft with { Title = "", Description = "", ImageUrl = null, Enabled = false })).StatusCode == HttpStatusCode.BadRequest, "An empty creative without text or image is rejected");
            await File.WriteAllTextAsync(Path.Combine(folder, "ads.json"), "broken-store");
            Check((await client.GetAsync("/api/admin/ads")).StatusCode == HttpStatusCode.ServiceUnavailable, "Corrupt storage reports failure");
            Check(await File.ReadAllTextAsync(Path.Combine(folder, "ads.json")) == "broken-store", "Corrupt storage is preserved for recovery");
            Check((await client.PutAsJsonAsync("/api/admin/ads/enabled", new AdToggle(true))).StatusCode == HttpStatusCode.ServiceUnavailable, "Write on corrupt storage reports failure");
            var storage = audit.Last("ads.enable");
            Check(storage["Outcome"] == "storage" && storage["Status"] == "503", "Storage failure is audited");
            var logged = string.Join("\n", audit.Events.Select(e => string.Join(' ', e.Values)));
            foreach (var secret in new[] { "Campaign", "Description", "example.com", "banner.png", "javascript", session.RootElement.GetProperty("csrfToken").GetString()!, "LucasPedruo", "broken-store" })
                Check(!logged.Contains(secret, StringComparison.Ordinal), $"Audit log omits {secret}");
            Console.WriteLine("Advertising OK: owner ID, audit trail, CSRF, schedule capacity, rotation, signed metrics, deduplication, restart persistence, concurrency and storage recovery.");
        }
        finally {
            await app.StopAsync();
            if (!Path.GetFullPath(folder).StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Invalid test cleanup path.");
            Directory.Delete(folder, true);
        }
    }
    static void Check(bool value, string message) { if (!value) throw new Exception(message); }
    static void EnsureSuccessStatusCodeOrRedirect(this HttpResponseMessage response) { Check(response.StatusCode == HttpStatusCode.Redirect, "Repeated click remains a redirect"); }
    sealed class AuditCapture : ILoggerProvider
    {
        public List<Dictionary<string, string>> Events { get; } = [];
        public Dictionary<string, string> Last(string action) { lock (Events) return Events.Last(e => e["Action"] == action); }
        public ILogger CreateLogger(string categoryName) => categoryName == AdvertisingAudit.Category ? new Sink(this) : NullLogger.Instance;
        public void Dispose() { }
        sealed class Sink(AuditCapture owner) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
            public bool IsEnabled(LogLevel level) => true;
            public void Log<TState>(LogLevel level, EventId id, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            {
                if (state is not IReadOnlyList<KeyValuePair<string, object?>> fields) return;
                lock (owner.Events) owner.Events.Add(fields.Where(f => f.Key != "{OriginalFormat}").ToDictionary(f => f.Key, f => Convert.ToString(f.Value, System.Globalization.CultureInfo.InvariantCulture) ?? ""));
            }
        }
    }
    sealed class AdClock : TimeProvider { public DateTimeOffset Now = DateTimeOffset.UtcNow; public override DateTimeOffset GetUtcNow() => Now; }
}
