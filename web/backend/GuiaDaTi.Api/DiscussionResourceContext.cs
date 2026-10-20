public static class DiscussionResourceContextEndpoints
{
    public static void MapDiscussionResourceContext(this WebApplication app)
    {
        app.MapGet("/api/discussions/{number:int}/resource-context", async (int number, HttpContext context, StudyEngagement activity) => {
            context.Response.Headers.CacheControl = "no-store";
            if (number < 1) return Results.BadRequest();
            try {
                var resource = await activity.LinkedResourceAsync(number, context.RequestAborted);
                return Results.Ok(new { resource });
            }
            catch (Exception error) when (Unavailable(error)) { return Results.Json(new { error = "N\u00e3o foi poss\u00edvel carregar o recurso vinculado." }, statusCode: 503); }
        });
    }

    private static bool Unavailable(Exception error) => error is IOException or UnauthorizedAccessException
        or HttpRequestException or System.Text.Json.JsonException or DiscussionsUnavailableException
        or InvalidOperationException or KeyNotFoundException or OperationCanceledException;
}
