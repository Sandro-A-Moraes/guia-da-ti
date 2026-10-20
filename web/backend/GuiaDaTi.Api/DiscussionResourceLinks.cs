using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Antiforgery;

public record DiscussionResourceLink(string Type, string Slug);

public static class DiscussionResourceLinkEndpoints
{
    public static void MapDiscussionResourceLinks(this WebApplication app)
    {
        app.MapGet("/api/discussions/{number:int}/resource-link", async (int number, HttpContext context, DiscussionWriter writer, StudyEngagement activity) => {
            context.Response.Headers.CacheControl = "no-store";
            if (!Authenticated(context) || number < 1) return Results.Unauthorized();
            var token = await context.GetTokenAsync("access_token");
            if (string.IsNullOrEmpty(token)) return Results.Unauthorized();
            try {
                if (!await writer.CanManageAsync(token, number, context.RequestAborted)) return Results.Ok(new { allowed = false });
                var resource = await activity.LinkedResourceAsync(number, context.RequestAborted);
                return Results.Ok(new { allowed = true, resource = resource is null ? null : new { resource.Type, resource.Slug, resource.Name } });
            }
            catch (DiscussionWriteRejectedException) { return Results.Ok(new { allowed = false }); }
            catch (Exception error) when (Unavailable(error)) { return Results.Json(new { error = "Não foi possível verificar o vínculo." }, statusCode: 503); }
        });

        app.MapPost("/api/discussions/{number:int}/resource-link", async (int number, DiscussionResourceLink link, HttpContext context, IAntiforgery csrf, DiscussionWriter writer, StudyEngagement activity) => {
            context.Response.Headers.CacheControl = "no-store";
            if (!Authenticated(context)) return Results.Unauthorized();
            try { await csrf.ValidateRequestAsync(context); }
            catch (AntiforgeryValidationException) { return Results.BadRequest(new { error = "Atualize a página e tente novamente." }); }
            if (number < 1 || string.IsNullOrWhiteSpace(link.Type) || string.IsNullOrWhiteSpace(link.Slug) || link.Type.Length > 100 || link.Slug.Length > 200) return Results.BadRequest(new { error = "Escolha um recurso válido." });
            var token = await context.GetTokenAsync("access_token");
            if (string.IsNullOrEmpty(token)) return Results.Unauthorized();
            if (!await writer.CanManageAsync(token, number, context.RequestAborted)) return Results.Json(new { error = "Só mantenedores do repositório podem vincular tópicos." }, statusCode: 403);
            var resource = activity.Find(link.Type, link.Slug);
            if (resource is null) return Results.NotFound();
            try {
                await activity.LinkDiscussionAsync(resource, number, context.RequestAborted);
                return Results.Ok(new { linked = true });
            }
            catch (ArgumentException error) { return Results.Conflict(new { error = error.Message }); }
            catch (Exception error) when (Unavailable(error)) { return Results.Json(new { error = "Não foi possível salvar o vínculo." }, statusCode: 503); }
        }).WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(4096));

        app.MapDelete("/api/discussions/{number:int}/resource-link", async (int number, HttpContext context, IAntiforgery csrf, DiscussionWriter writer, StudyEngagement activity) => {
            context.Response.Headers.CacheControl = "no-store";
            if (!Authenticated(context) || number < 1) return Results.Unauthorized();
            try { await csrf.ValidateRequestAsync(context); }
            catch (AntiforgeryValidationException) { return Results.BadRequest(new { error = "Atualize a página e tente novamente." }); }
            var token = await context.GetTokenAsync("access_token");
            if (string.IsNullOrEmpty(token)) return Results.Unauthorized();
            if (!await writer.CanManageAsync(token, number, context.RequestAborted)) return Results.Json(new { error = "Só mantenedores do repositório podem remover vínculos." }, statusCode: 403);
            try { return await activity.UnlinkDiscussionAsync(number, context.RequestAborted) ? Results.NoContent() : Results.NotFound(); }
            catch (Exception error) when (Unavailable(error)) { return Results.Json(new { error = "Não foi possível remover o vínculo." }, statusCode: 503); }
        });
    }

    private static bool Authenticated(HttpContext context) => context.User.Identity?.IsAuthenticated == true
        && context.User.FindFirstValue(ClaimTypes.NameIdentifier) is not null;

    private static bool Unavailable(Exception error) => error is IOException or UnauthorizedAccessException
        or HttpRequestException or System.Text.Json.JsonException or DiscussionsUnavailableException
        or InvalidOperationException or KeyNotFoundException or OperationCanceledException;
}
