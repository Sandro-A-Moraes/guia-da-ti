// Live notices for the current server instance. The suggestions themselves remain in GitHub.
public sealed class ContributionNotifications(TimeProvider clock)
{
    private readonly object gate = new();
    private readonly string stream = Guid.NewGuid().ToString("N");
    private readonly Queue<(long Cursor, DateTimeOffset At, ContributionNotice Notice)> events = new();
    private long cursor;

    public ContributionNotice Publish(string login, ContributionDraft draft, ContributionResult result)
    {
        lock (gate) {
            var notice = new ContributionNotice($"{stream}:{++cursor}", login, draft.Name.Trim(), draft.Type,
                result.Url);
            events.Enqueue((cursor, clock.GetUtcNow(), notice));
            while (events.Count > 100) events.Dequeue();
            return notice;
        }
    }

    public ContributionNoticePage Read(string? previousStream, long? after)
    {
        lock (gate) {
            var items = previousStream == stream && after is >= 0
                ? events.Where(e => e.Cursor > after && e.At > clock.GetUtcNow().AddMinutes(-2)).Select(e => e.Notice).ToArray()
                : [];
            return new(stream, cursor, items);
        }
    }
}

public record ContributionNotice(string Id, string Login, string Name, string Category, string Url);
public record ContributionNoticePage(string Stream, long Cursor, ContributionNotice[] Items);

public static class ContributionNotificationEndpoints
{
    public static void MapContributionNotifications(this WebApplication app) => app.MapGet("/api/contributions/notices", (
        string? stream, long? after, HttpContext context, ContributionNotifications notices) => {
        context.Response.Headers.CacheControl = "no-store";
        return after is < 0 ? Results.BadRequest() : Results.Ok(notices.Read(stream, after));
    });
}
