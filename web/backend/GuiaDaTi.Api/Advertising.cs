using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.DataProtection;

public static class AdvertisingAdmin
{
    public static bool Allowed(ClaimsPrincipal user, IConfiguration configuration) =>
        user.Identity?.IsAuthenticated == true
        && long.TryParse(configuration["ADS_ADMIN_GITHUB_ID"] ?? "147441250", out var owner)
        && owner > 0 && user.FindFirstValue(ClaimTypes.NameIdentifier) == owner.ToString(System.Globalization.CultureInfo.InvariantCulture);
}

public record AdPlacement(string Id, string Name, int Capacity);
public record AdSettings(int MaxCampaigns, int RotationSeconds, AdPlacement[] Placements)
{
    public static AdSettings Default => new(100, 45, [new("site-top-banner", "Banner no topo do site", 5), new("forum-feed", "Lista do fórum", 5), new("forum-topic", "Conversas do fórum", 5), new("study-topic", "Discussões de Estudar", 5)]);
}
public record AdDraft(string Company, string Title, string Description, string Url, string? ImageUrl,
    string[] Placements, int Weight, bool Enabled, DateTimeOffset StartsAt, DateTimeOffset? EndsAt);
public record AdCampaign(Guid Id, AdDraft Content, long Impressions = 0, long Clicks = 0);
public record AdStore(int Version, AdSettings Settings, List<AdCampaign> Campaigns, Dictionary<string, AdReceipt> Receipts, bool Enabled = true);
public record AdToggle(bool Enabled);
public record AdReceipt(DateTimeOffset ExpiresAt, bool Viewed, bool Clicked);
public record AdTicket(Guid CampaignId, string Placement, DateTimeOffset ExpiresAt, string Nonce);
public record AdCreative(Guid Id, string Company, string Title, string Description, string? ImageUrl, string ClickUrl, string Ticket);
public record AdSelection(int RotationSeconds, AdCreative? Ad, bool Enabled = true);
public record AdEvent(string Ticket);

// Operational data is server-side and independent from the public GitHub catalog.
public sealed class Advertising(IConfiguration config, IWebHostEnvironment environment, TimeProvider clock,
    IDataProtectionProvider protection, ContributionImages images)
{
    private readonly string path = Path.GetFullPath(config["ADS_STORAGE_PATH"] ?? Path.Combine(environment.ContentRootPath, "App_Data", "advertising.json"));
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly IDataProtector protector = protection.CreateProtector("GuiaDaTi.Advertising.v1");
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static readonly string[] PlacementIds = ["site-top-banner", "forum-feed", "forum-topic", "study-topic"];

    public async Task<AdStore> Snapshot(CancellationToken cancellation = default)
    {
        await gate.WaitAsync(cancellation);
        try { return await Read(cancellation); }
        finally { gate.Release(); }
    }

    public async Task<AdCampaign> Save(Guid? id, AdDraft draft, CancellationToken cancellation = default) =>
        (await SaveWithChange(id, draft, cancellation)).Campaign;

    public async Task<(AdCampaign Campaign, AdChange Change)> SaveWithChange(Guid? id, AdDraft draft, CancellationToken cancellation = default)
    {
        draft = Validate(draft);
        await gate.WaitAsync(cancellation);
        try {
            var store = await Read(cancellation);
            var previous = id is null ? null : store.Campaigns.FirstOrDefault(c => c.Id == id);
            if (id is not null && previous is null) throw new KeyNotFoundException();
            if (previous is null && store.Campaigns.Count >= store.Settings.MaxCampaigns) throw new ArgumentException("O limite de anúncios cadastrados foi atingido. Exclua um anúncio ou aumente o limite.");
            var campaign = new AdCampaign(previous?.Id ?? Guid.NewGuid(), draft, previous?.Impressions ?? 0, previous?.Clicks ?? 0);
            store.Campaigns.RemoveAll(c => c.Id == campaign.Id);
            store.Campaigns.Add(campaign);
            ValidateCapacity(store.Settings, store.Campaigns, clock.GetUtcNow());
            await Write(store, cancellation);
            var change = previous is null ? AdChange.Created
                : previous.Content.Enabled != draft.Enabled && SameExceptEnabled(previous.Content, draft) ? (draft.Enabled ? AdChange.Resumed : AdChange.Paused)
                : AdChange.Updated;
            return (campaign, change);
        }
        finally { gate.Release(); }
    }

    public async Task Delete(Guid id, CancellationToken cancellation = default)
    {
        await gate.WaitAsync(cancellation);
        try {
            var store = await Read(cancellation);
            if (store.Campaigns.RemoveAll(c => c.Id == id) == 0) throw new KeyNotFoundException();
            await Write(store, cancellation);
        }
        finally { gate.Release(); }
    }

    public async Task Configure(AdSettings settings, CancellationToken cancellation = default)
    {
        if (settings.MaxCampaigns is < 1 or > 500 || settings.RotationSeconds is < 15 or > 300
            || settings.Placements is null || settings.Placements.Length != PlacementIds.Length
            || !settings.Placements.Select(p => p.Id).Order().SequenceEqual(PlacementIds.Order())
            || settings.Placements.Any(p => p.Capacity is < 1 or > 20))
            throw new ArgumentException("Use 1 a 500 cadastros, 15 a 300 segundos de rotação e 1 a 20 vagas por espaço.");
        // Labels come from the server, not from a submitted payload.
        settings = settings with { Placements = AdSettings.Default.Placements.Select(p => p with { Capacity = settings.Placements.Single(s => s.Id == p.Id).Capacity }).ToArray() };
        await gate.WaitAsync(cancellation);
        try {
            var store = await Read(cancellation);
            if (store.Campaigns.Count > settings.MaxCampaigns) throw new ArgumentException("O limite precisa comportar os anúncios já cadastrados.");
            ValidateCapacity(settings, store.Campaigns, clock.GetUtcNow());
            await Write(store with { Settings = settings }, cancellation);
        }
        finally { gate.Release(); }
    }

    public async Task SetEnabled(bool enabled, CancellationToken cancellation = default)
    {
        await gate.WaitAsync(cancellation);
        try { await Write((await Read(cancellation)) with { Enabled = enabled }, cancellation); }
        finally { gate.Release(); }
    }

    public async Task<AdSelection> Select(string placement, Guid? previous, CancellationToken cancellation = default)
    {
        if (!PlacementIds.Contains(placement)) throw new ArgumentException("Espaço de publicidade inválido.");
        var store = await Snapshot(cancellation);
        if (!store.Enabled) return new(store.Settings.RotationSeconds, null, false);
        var now = clock.GetUtcNow();
        var eligible = store.Campaigns.Where(c => c.Content.Enabled && c.Content.StartsAt <= now
            && (c.Content.EndsAt is null || now < c.Content.EndsAt) && c.Content.Placements.Contains(placement)).ToArray();
        if (eligible.Length == 0) return new(store.Settings.RotationSeconds, null);
        if (eligible.Length > 1) eligible = eligible.Where(c => c.Id != previous).ToArray();
        var draw = RandomNumberGenerator.GetInt32(eligible.Sum(c => c.Content.Weight));
        var chosen = eligible[0];
        foreach (var candidate in eligible) { draw -= candidate.Content.Weight; if (draw < 0) { chosen = candidate; break; } }
        var ticket = protector.Protect(JsonSerializer.Serialize(new AdTicket(chosen.Id, placement, now.AddMinutes(10), Guid.NewGuid().ToString("N")), Json));
        return new(store.Settings.RotationSeconds, new(chosen.Id, chosen.Content.Company, chosen.Content.Title,
            chosen.Content.Description, chosen.Content.ImageUrl, "/api/ads/click?ticket=" + Uri.EscapeDataString(ticket), ticket));
    }

    public async Task<string> Record(string token, bool click, CancellationToken cancellation = default)
    {
        AdTicket ticket;
        try {
            if (string.IsNullOrEmpty(token) || token.Length > 2048) throw new ArgumentException();
            ticket = JsonSerializer.Deserialize<AdTicket>(protector.Unprotect(token), Json) ?? throw new ArgumentException();
        } catch (Exception e) when (e is CryptographicException or JsonException or ArgumentException) { throw new ArgumentException("Este anúncio expirou. Atualize a página."); }
        var now = clock.GetUtcNow();
        if (ticket.ExpiresAt <= now || ticket.ExpiresAt > now.AddMinutes(10) || !PlacementIds.Contains(ticket.Placement)) throw new ArgumentException("Este anúncio expirou. Atualize a página.");
        await gate.WaitAsync(cancellation);
        try {
            var store = await Read(cancellation);
            var index = store.Campaigns.FindIndex(c => c.Id == ticket.CampaignId);
            if (index < 0) throw new KeyNotFoundException();
            var campaign = store.Campaigns[index];
            if (!store.Enabled) return campaign.Content.Url;
            var receipt = store.Receipts.GetValueOrDefault(ticket.Nonce) ?? new(ticket.ExpiresAt, false, false);
            var changed = click ? !receipt.Clicked : !receipt.Viewed;
            if (changed) {
                store.Campaigns[index] = campaign with { Impressions = campaign.Impressions + (!click ? 1 : 0), Clicks = campaign.Clicks + (click ? 1 : 0) };
                foreach (var expired in store.Receipts.Where(p => p.Value.ExpiresAt <= now).Select(p => p.Key).ToArray()) store.Receipts.Remove(expired);
                if (store.Receipts.Count >= 20000) throw new ArgumentException("O registro de atividade está ocupado. Tente novamente em alguns minutos.");
                store.Receipts[ticket.Nonce] = receipt with { Viewed = receipt.Viewed || !click, Clicked = receipt.Clicked || click };
                await Write(store, cancellation);
            }
            return campaign.Content.Url;
        }
        finally { gate.Release(); }
    }

    private static bool SameExceptEnabled(AdDraft a, AdDraft b) =>
        a.Company == b.Company && a.Title == b.Title && a.Description == b.Description && a.Url == b.Url && a.ImageUrl == b.ImageUrl
        && a.Weight == b.Weight && a.StartsAt == b.StartsAt && a.EndsAt == b.EndsAt && a.Placements.Order().SequenceEqual(b.Placements.Order());

    private AdDraft Validate(AdDraft draft)
    {
        if (draft is null) throw new ArgumentException("Preencha o anúncio antes de salvar.");
        draft = draft with { Company = draft.Company?.Trim() ?? "", Title = draft.Title?.Trim() ?? "", Description = draft.Description?.Trim() ?? "" };
        var imageOnly = draft.Title.Length == 0 && draft.Description.Length == 0 && !string.IsNullOrWhiteSpace(draft.ImageUrl);
        if ((!imageOnly && (draft.Company.Length == 0 || draft.Title.Length == 0 || draft.Description.Length == 0)) || draft.Company.Length > 80
            || draft.Title.Length > 120 || draft.Description.Length > 500
            || draft.Placements is null || draft.Placements.Length == 0 || draft.Placements.Length > PlacementIds.Length
            || draft.Placements.Distinct().Count() != draft.Placements.Length || draft.Placements.Any(p => !PlacementIds.Contains(p))
            || draft.Weight is < 1 or > 10 || draft.StartsAt == default || draft.EndsAt <= draft.StartsAt)
            throw new ArgumentException("Informe imagem e link ou preencha empresa, título e descrição. Escolha os espaços, prioridade de 1 a 10 e término posterior ao início.");
        RequireUrl(draft.Url);
        var image = string.IsNullOrWhiteSpace(draft.ImageUrl) ? null : draft.ImageUrl.Trim();
        if (image is not null) {
            if (image.StartsWith("/api/contributions/images/", StringComparison.Ordinal)) images.Require(image["/api/contributions/images/".Length..]);
            else RequireUrl(image);
        }
        return draft with { Company = draft.Company.Length == 0 ? "Anunciante" : draft.Company, Url = draft.Url.Trim(), ImageUrl = image };
    }

    private static void RequireUrl(string? value)
    {
        if (value is null || value.Length > 1000 || !Uri.TryCreate(value, UriKind.Absolute, out var uri)
            || uri.Scheme != "https" || !string.IsNullOrEmpty(uri.UserInfo) || !uri.IsDefaultPort || !uri.Host.Contains('.')
            || uri.Host.EndsWith(".local", StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith(".internal", StringComparison.OrdinalIgnoreCase)
            || System.Net.IPAddress.TryParse(uri.Host, out _)) throw new ArgumentException("Informe um endereço público começando com https://.");
    }

    public static void ValidateCapacity(AdSettings settings, IEnumerable<AdCampaign> campaigns, DateTimeOffset? from = null)
    {
        foreach (var placement in settings.Placements) {
            var intervals = campaigns.Where(c => c.Content.Enabled && c.Content.Placements.Contains(placement.Id) && (from is null || c.Content.EndsAt is null || c.Content.EndsAt > from));
            var events = intervals.SelectMany(c => new[] { (Time: from is not null && c.Content.StartsAt < from.Value ? from.Value : c.Content.StartsAt, Change: 1), (Time: c.Content.EndsAt ?? DateTimeOffset.MaxValue, Change: -1) });
            var count = 0;
            foreach (var point in events.OrderBy(p => p.Time).ThenBy(p => p.Change)) {
                count += point.Change;
                if (count > placement.Capacity) throw new ArgumentException($"{placement.Name} tem limite de {placement.Capacity} anúncios simultâneos. Pause um anúncio ou ajuste as datas.");
            }
        }
    }

    private async Task<AdStore> Read(CancellationToken cancellation)
    {
        if (!File.Exists(path)) return new(1, AdSettings.Default, [], []);
        await using var input = File.OpenRead(path);
        var data = await JsonSerializer.DeserializeAsync<AdStore>(input, Json, cancellation);
        if (data is null || data.Version != 1 || data.Settings is null || data.Campaigns is null || data.Receipts is null) throw new InvalidDataException("Registro de anúncios inválido.");
        // Add newly introduced placements to stores created by older versions.
        var placements = AdSettings.Default.Placements.Select(placement => placement with
        {
            Capacity = data.Settings.Placements?.FirstOrDefault(saved => saved.Id == placement.Id)?.Capacity ?? placement.Capacity,
        }).ToArray();
        return data with { Settings = data.Settings with { Placements = placements } };
    }

    private async Task Write(AdStore store, CancellationToken cancellation)
    {
        var folder = Path.GetDirectoryName(path)!;
        Directory.CreateDirectory(folder);
        var temporary = Path.Combine(folder, ".ads-" + Guid.NewGuid().ToString("N") + ".tmp");
        try {
            await using (var output = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None)) {
                await JsonSerializer.SerializeAsync(output, store, Json, cancellation);
                await output.FlushAsync(cancellation);
                output.Flush(true);
            }
            File.Move(temporary, path, true);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
}

public sealed class AdvertisingEndpointFilter(bool admin) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext invocation, EndpointFilterDelegate next)
    {
        var context = invocation.HttpContext;
        context.Response.Headers.CacheControl = "no-store";
        var audited = admin && AdvertisingAudit.IsWrite(context.Request);
        // Lets the administrator quote the same ID that appears in the audit log.
        if (admin) context.Response.Headers["X-Request-Id"] = context.TraceIdentifier;
        object? Reject(string outcome, int status, object? response) { if (audited) AdvertisingAudit.Write(invocation, outcome, status); return response; }
        if (admin) {
            if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
            if (!AdvertisingAdmin.Allowed(context.User, context.RequestServices.GetRequiredService<IConfiguration>())) return Reject("forbidden", 403, Results.StatusCode(403));
            if (context.Request.Method != "GET") {
                try { await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context); }
                catch (AntiforgeryValidationException) { return Reject("csrf", 400, Results.BadRequest(new { error = "Atualize a página e tente novamente." })); }
            }
        }
        try {
            var result = await next(invocation);
            if (audited) AdvertisingAudit.Write(invocation, "success", result is IStatusCodeHttpResult { StatusCode: { } code } ? code : 200, result);
            return result;
        }
        catch (KeyNotFoundException) { return Reject("not_found", 404, Results.NotFound(new { error = "Este anúncio não foi encontrado. Atualize a lista." })); }
        catch (ArgumentException e) { return Reject("validation", 400, Results.BadRequest(new { error = e.Message })); }
        catch (ContributionRejectedException e) { return Reject("invalid_image", 400, Results.BadRequest(new { error = e.Message })); }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException or JsonException) {
            if (!audited) context.RequestServices.GetRequiredService<ILogger<Advertising>>().LogError("Falha no armazenamento de anúncios.");
            return Reject("storage", 503, Results.Json(new { error = "Não foi possível salvar ou consultar os anúncios. Tente novamente." }, statusCode: 503));
        }
        catch (OperationCanceledException) when (audited) { AdvertisingAudit.Write(invocation, "cancelled", 499); throw; }
        catch (Exception) when (audited) { AdvertisingAudit.Write(invocation, "error", 500); throw; }
    }
}

public static class AdvertisingEndpoints
{
    public static void MapAdvertising(this WebApplication app)
    {
        var admin = app.MapGroup("/api/admin/ads").AddEndpointFilter(new AdvertisingEndpointFilter(true));
        admin.MapGet("/", async (Advertising ads, HttpContext context) => {
            var store = await ads.Snapshot(context.RequestAborted);
            return Results.Ok(new { store.Settings, store.Campaigns, store.Enabled });
        });
        admin.MapPost("/campaigns", async (AdDraft draft, Advertising ads, HttpContext context) => Results.Ok((await ads.SaveWithChange(null, draft, context.RequestAborted)).Campaign));
        admin.MapPut("/campaigns/{id:guid}", async (Guid id, AdDraft draft, Advertising ads, HttpContext context) => {
            var (campaign, change) = await ads.SaveWithChange(id, draft, context.RequestAborted);
            context.Items[AdvertisingAudit.ChangeKey] = change;
            return Results.Ok(campaign);
        });
        admin.MapDelete("/campaigns/{id:guid}", async (Guid id, Advertising ads, HttpContext context) => { await ads.Delete(id, context.RequestAborted); return Results.NoContent(); });
        admin.MapPut("/settings", async (AdSettings settings, Advertising ads, HttpContext context) => { await ads.Configure(settings, context.RequestAborted); return Results.NoContent(); });
        admin.MapPut("/enabled", async (AdToggle toggle, Advertising ads, HttpContext context) => { await ads.SetEnabled(toggle.Enabled, context.RequestAborted); return Results.NoContent(); });
        var publicAds = app.MapGroup("/api/ads").AddEndpointFilter(new AdvertisingEndpointFilter(false));
        publicAds.MapGet("/select", async (string placement, Guid? previous, Advertising ads, HttpContext context) => Results.Ok(await ads.Select(placement, previous, context.RequestAborted)));
        publicAds.MapPost("/impression", async (AdEvent message, Advertising ads, HttpContext context) => { await ads.Record(message.Ticket, false, context.RequestAborted); return Results.NoContent(); });
        publicAds.MapGet("/click", async (string ticket, Advertising ads, HttpContext context) => Results.Redirect(await ads.Record(ticket, true, context.RequestAborted)));
    }
}
