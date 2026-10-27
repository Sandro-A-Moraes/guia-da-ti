using System.Text.Json;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;

public static class RoadmapEndpoints
{
    public static void MapRoadmaps(this WebApplication app)
    {
        app.MapPost("/api/roadmaps/proposals", async (RoadmapDraft draft, HttpContext context, IAntiforgery csrf, RoadmapProposals service, Catalog catalog, ContributionNotifications notices) => {
            if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
            try { await csrf.ValidateRequestAsync(context); } catch (AntiforgeryValidationException) { return Results.BadRequest(new { error = "Atualize a página e tente novamente." }); }
            var token = await context.GetTokenAsync("access_token"); if (string.IsNullOrEmpty(token)) return Results.Unauthorized();
            var login = context.User.Identity!.Name!;
            try { var result = await service.Submit(token, login, draft, catalog, context.RequestAborted); return Results.Ok(result with { Notice = notices.Publish(login, draft.Name, "roadmaps", result) }); }
            catch (ContributionRejectedException error) { return Results.BadRequest(new { error = error.Message }); }
            catch (Exception error) when (error is HttpRequestException or JsonException or DiscussionsUnavailableException or InvalidOperationException or KeyNotFoundException or OperationCanceledException) { return Results.Json(new { error = "Não foi possível enviar o roadmap. Os dados continuam no editor; tente novamente." }, statusCode: 503); }
        }).WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(262144));
        app.MapGet("/api/roadmaps/{slug}/source", async (string slug, HttpContext context, RoadmapProposals service, Catalog catalog) => {
            context.Response.Headers.CacheControl = "no-store";
            if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
            var token = await context.GetTokenAsync("access_token"); if (string.IsNullOrEmpty(token)) return Results.Unauthorized();
            if (!RoadmapProposals.IsCommunityRoadmap(catalog, slug)) return Results.NotFound();
            try {
                var source = await service.Read(token, slug, context.RequestAborted);
                return source is null ? Results.NotFound() : Results.Ok(new { sha = source.Sha, roadmap = source.Roadmap });
            }
            catch (Exception error) when (error is HttpRequestException or JsonException or FormatException or DiscussionsUnavailableException or InvalidOperationException or KeyNotFoundException or OperationCanceledException) {
                return Results.Json(new { error = "Não foi possível abrir o roadmap para edição. Tente novamente." }, statusCode: 503);
            }
        });
        app.MapGet("/api/roadmaps/{slug}/contributors", async (string slug, RoadmapContributors client, Catalog catalog, CancellationToken cancellation) => {
            if (!RoadmapProposals.IsCommunityRoadmap(catalog, slug)) return Results.NotFound();
            try { var authorship = await client.GetAsync(slug, cancellation); return Results.Ok(new { creator = authorship.Creator, contributors = authorship.Contributors }); }
            catch (Exception error) when (error is HttpRequestException or JsonException or DiscussionsUnavailableException or InvalidOperationException or KeyNotFoundException or OperationCanceledException) {
                return Results.Json(new { error = "Não foi possível carregar a autoria do roadmap. Tente novamente." }, statusCode: 503);
            }
        });
    }
}
