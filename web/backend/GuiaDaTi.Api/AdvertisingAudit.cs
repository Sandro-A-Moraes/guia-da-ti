using System.Globalization;
using System.Security.Claims;

public enum AdChange { Created, Updated, Paused, Resumed }

// One log line per administrative write. Only server-derived values are logged:
// never the form content, URLs, tokens or exception messages.
public static class AdvertisingAudit
{
    public const string Category = "GuiaDaTi.Audit.Advertising";
    public const string ChangeKey = "ads.audit.change";
    private static readonly EventId AdminEvent = new(6001, "AdminAudit");

    public static bool IsWrite(HttpRequest request) => !HttpMethods.IsGet(request.Method) && !HttpMethods.IsHead(request.Method);

    public static void Write(EndpointFilterInvocationContext invocation, string outcome, int status, object? result = null)
    {
        var context = invocation.HttpContext;
        var (action, target) = Describe(invocation, result);
        var level = outcome switch {
            "success" => LogLevel.Information,
            "storage" or "error" => LogLevel.Error,
            _ => LogLevel.Warning
        };
        context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger(Category).Log(level, AdminEvent,
            "AdminAudit action={Action} actor={Actor} target={Target} outcome={Outcome} status={Status} requestId={RequestId} at={At}",
            action, Actor(context.User), target, outcome, status, context.TraceIdentifier,
            context.RequestServices.GetRequiredService<TimeProvider>().GetUtcNow().ToString("O", CultureInfo.InvariantCulture));
    }

    private static string Actor(ClaimsPrincipal user) =>
        long.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), NumberStyles.None, CultureInfo.InvariantCulture, out var id) && id > 0
            ? id.ToString(CultureInfo.InvariantCulture) : "unknown";

    private static (string Action, string Target) Describe(EndpointFilterInvocationContext invocation, object? result)
    {
        var context = invocation.HttpContext;
        var path = context.Request.Path.Value?.TrimEnd('/') ?? "";
        var method = context.Request.Method;
        if (path.EndsWith("/settings", StringComparison.Ordinal)) return ("settings.update", "settings");
        if (path.EndsWith("/enabled", StringComparison.Ordinal)) {
            var toggle = invocation.Arguments.OfType<AdToggle>().FirstOrDefault();
            return (toggle is null ? "ads.toggle" : toggle.Enabled ? "ads.enable" : "ads.disable", "global");
        }
        var id = Guid.TryParse(context.Request.RouteValues["id"]?.ToString(), out var routeId) ? routeId.ToString() : null;
        if (HttpMethods.IsDelete(method)) return ("campaign.delete", id ?? "unknown");
        if (HttpMethods.IsPost(method)) {
            var created = result is IValueHttpResult { Value: AdCampaign campaign } ? campaign.Id.ToString() : "new";
            return ("campaign.create", created);
        }
        var action = context.Items[ChangeKey] switch {
            AdChange.Paused => "campaign.pause",
            AdChange.Resumed => "campaign.resume",
            _ => "campaign.update"
        };
        return (action, id ?? "unknown");
    }
}
