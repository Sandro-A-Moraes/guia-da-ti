// Presence is scoped to this application instance; anonymous browser IDs expire from memory.
public sealed class CommunityActivity(TimeProvider clock)
{
    private readonly object gate = new();
    private readonly Dictionary<string, DateTimeOffset> seen = new();
    public int Count(string? userId = null)
    {
        lock (gate)
        {
            var now = clock.GetUtcNow();
            foreach (var key in seen.Where(item => item.Value <= now.AddMinutes(-5)).Select(item => item.Key).ToArray())
                seen.Remove(key);
            if (!string.IsNullOrEmpty(userId)) seen[userId] = now;
            return seen.Count;
        }
    }

}

public static class CommunityActivityEndpoints
{
    public static void MapCommunityActivity(this WebApplication app)
    {
        app.MapGet("/api/community/activity", (HttpContext context, CommunityActivity activity) => {
            context.Response.Headers.CacheControl = "no-store";
            const string cookieName = "guia.visitor";
            var visitor = context.Request.Cookies[cookieName];
            if (!Guid.TryParseExact(visitor, "N", out _)) {
                visitor = Guid.NewGuid().ToString("N");
                context.Response.Cookies.Append(cookieName, visitor, new CookieOptions {
                    HttpOnly = true, Secure = context.Request.IsHttps, SameSite = SameSiteMode.Strict,
                    Path = "/api/community"
                });
            }
            var activeUsers = activity.Count(visitor);
            return Results.Ok(new { activeUsers, windowMinutes = 5 });
        });
    }
}
