using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Antiforgery;

public sealed class DiscussionWriter(IHttpClientFactory clients, IConfiguration configuration, ILogger<DiscussionWriter>? logger = null)
{
    private readonly string repository = configuration["DISCUSSIONS_REPOSITORY"] ?? "guia-da-ti/guia-da-ti-dados";
    public async Task<bool> CanManageAsync(string token, int number, CancellationToken cancellation)
    {
        if (number < 1 || !Regex.IsMatch(repository, @"^[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+$")) return false;
        var data = await Query(token, """
            query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){isPrivate hasDiscussionsEnabled viewerPermission discussion(number:$number){id}}}
            """, new { owner = repository.Split('/')[0], name = repository.Split('/')[1], number }, cancellation);
        var repo = data.GetProperty("repository");
        if (repo.ValueKind != JsonValueKind.Object || repo.GetProperty("isPrivate").GetBoolean()
            || !repo.GetProperty("hasDiscussionsEnabled").GetBoolean() || repo.GetProperty("discussion").ValueKind != JsonValueKind.Object) return false;
        return new[] { "WRITE", "MAINTAIN", "ADMIN" }.Contains(repo.GetProperty("viewerPermission").GetString());
    }

    public async Task<int> PublishAsync(string token, DiscussionDraft draft, CancellationToken cancellation)
    {
        if (!Regex.IsMatch(repository, @"^[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+$")) throw new DiscussionsUnavailableException();
        var metadata = await Query(token, """
            query($owner:String!,$name:String!,$number:Int!,$existing:Boolean!){
              repository(owner:$owner,name:$name){ id isPrivate hasDiscussionsEnabled
                discussionCategories(first:100){nodes{id name}}
                discussion(number:$number) @include(if:$existing){id locked closed}
              }
            }
            """, new { owner = repository.Split('/')[0], name = repository.Split('/')[1], number = draft.Number ?? 0, existing = draft.Number is not null }, cancellation);
        var repo = metadata.GetProperty("repository");
        if (repo.ValueKind == JsonValueKind.Null || repo.GetProperty("isPrivate").GetBoolean()
            || !repo.GetProperty("hasDiscussionsEnabled").GetBoolean()) throw new DiscussionsUnavailableException();
        if (draft.Number is null) {
            var availableCategories = repo.GetProperty("discussionCategories").GetProperty("nodes").EnumerateArray();
            var selectedCategory = availableCategories.FirstOrDefault(c => draft.CategoryId is not null
                ? c.GetProperty("id").GetString() == draft.CategoryId
                : string.Equals(c.GetProperty("name").GetString(), draft.CategoryName, StringComparison.OrdinalIgnoreCase));
            if (selectedCategory.ValueKind == JsonValueKind.Undefined)
                throw new DiscussionWriteRejectedException("Escolha uma categoria válida.");
            var result = await Query(token, """
                mutation($input:CreateDiscussionInput!){createDiscussion(input:$input){discussion{number}}}
                """, new { input = new { repositoryId = repo.GetProperty("id").GetString(), categoryId = selectedCategory.GetProperty("id").GetString(), title = draft.Title!.Trim(), body = draft.Body.Trim() } }, cancellation);
            return result.GetProperty("createDiscussion").GetProperty("discussion").GetProperty("number").GetInt32();
        }
        var discussion = repo.GetProperty("discussion");
        if (discussion.ValueKind == JsonValueKind.Null) throw new DiscussionWriteRejectedException("O tópico não foi encontrado.");
        if (discussion.GetProperty("locked").GetBoolean() || discussion.GetProperty("closed").GetBoolean()) throw new DiscussionWriteRejectedException("Este tópico está encerrado para novas mensagens.");
        var id = discussion.GetProperty("id").GetString();
        if (draft.ReplyToId is not null) {
            var commentData = await Query(token, """
                query($id:ID!){node(id:$id){... on DiscussionComment { isMinimized deletedAt replyTo { id } discussion { id } }}}
                """, new { id = draft.ReplyToId }, cancellation);
            var comment = commentData.GetProperty("node");
            if (comment.ValueKind == JsonValueKind.Null || !comment.TryGetProperty("discussion", out var parent)
                || parent.GetProperty("id").GetString() != id || comment.GetProperty("isMinimized").GetBoolean()
                || comment.GetProperty("deletedAt").ValueKind != JsonValueKind.Null
                || comment.GetProperty("replyTo").ValueKind != JsonValueKind.Null)
                throw new DiscussionWriteRejectedException("Escolha um comentário válido deste tópico.");
        }
        await Query(token, """
            mutation($input:AddDiscussionCommentInput!){addDiscussionComment(input:$input){comment{id}}}
            """, new { input = new { discussionId = id, body = draft.Body.Trim(), replyToId = draft.ReplyToId } }, cancellation);
        return draft.Number.Value;
    }

    private async Task<JsonElement> Owned(string token, string userId, int number, string? commentId, CancellationToken cancellation)
    {
        if (!Regex.IsMatch(repository, @"^[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+$")) throw new DiscussionsUnavailableException();
        var metadata = await Query(token, """
            query($owner:String!,$name:String!,$number:Int!){
              repository(owner:$owner,name:$name){isPrivate hasDiscussionsEnabled
                discussion(number:$number){id title body viewerCanUpdate viewerCanDelete author{... on User{databaseId}}}
              }
            }
            """, new { owner = repository.Split('/')[0], name = repository.Split('/')[1], number }, cancellation);
        var repo = metadata.GetProperty("repository");
        if (repo.ValueKind == JsonValueKind.Null || repo.GetProperty("isPrivate").GetBoolean() || !repo.GetProperty("hasDiscussionsEnabled").GetBoolean()) throw new DiscussionsUnavailableException();
        var target = repo.GetProperty("discussion");
        if (target.ValueKind == JsonValueKind.Null) throw new DiscussionWriteRejectedException("O tópico não foi encontrado.");
        var discussionId = target.GetProperty("id").GetString();
        if (commentId is not null) {
            var node = await Query(token, """
                query($id:ID!){node(id:$id){... on DiscussionComment{id body isMinimized deletedAt viewerCanUpdate viewerCanDelete author{... on User{databaseId}} discussion{id}}}}
                """, new { id = commentId }, cancellation);
            target = node.GetProperty("node");
            if (target.ValueKind == JsonValueKind.Null || !target.TryGetProperty("discussion", out var parent)
                || parent.GetProperty("id").GetString() != discussionId || target.GetProperty("isMinimized").GetBoolean())
                throw new DiscussionWriteRejectedException("Escolha um comentário visível deste tópico.");
            if (target.GetProperty("deletedAt").ValueKind != JsonValueKind.Null)
                throw new DiscussionWriteRejectedException("Este comentário já foi excluído. As respostas continuam na conversa.");
        }
        if (!target.TryGetProperty("author", out var author) || author.ValueKind == JsonValueKind.Null
            || !author.TryGetProperty("databaseId", out var authorId) || authorId.ValueKind != JsonValueKind.Number
            || authorId.ToString() != userId) throw new DiscussionWriteRejectedException("Você só pode editar ou excluir suas próprias publicações.");
        return target;
    }

    public async Task<OwnedPublication> ReadOwnAsync(string token, string userId, int number, string? commentId, CancellationToken cancellation)
    {
        var target = await Owned(token, userId, number, commentId, cancellation);
        return new(target.GetProperty("body").GetString()!, commentId is null ? target.GetProperty("title").GetString() : null,
            target.GetProperty("viewerCanUpdate").GetBoolean(), target.GetProperty("viewerCanDelete").GetBoolean());
    }

    public async Task ChangeAsync(string token, string userId, int number, string? commentId, DiscussionEdit? edit, CancellationToken cancellation)
    {
        var target = await Owned(token, userId, number, commentId, cancellation);
        var allowed = target.GetProperty(edit is null ? "viewerCanDelete" : "viewerCanUpdate").GetBoolean();
        if (!allowed) throw new DiscussionWriteRejectedException(edit is null
            ? "Sua conta não tem permissão para excluir publicações neste repositório."
            : "Sua conta não tem permissão para editar publicações neste repositório.");
        var discussionId = target.GetProperty("id").GetString();
        if (commentId is not null) {
            if (edit is null) await Query(token, "mutation($input:DeleteDiscussionCommentInput!){deleteDiscussionComment(input:$input){clientMutationId}}", new { input = new { id = commentId } }, cancellation);
            else await Query(token, "mutation($input:UpdateDiscussionCommentInput!){updateDiscussionComment(input:$input){comment{id}}}", new { input = new { commentId, body = edit.Body.Trim() } }, cancellation);
        } else {
            if (edit is null) await Query(token, "mutation($input:DeleteDiscussionInput!){deleteDiscussion(input:$input){clientMutationId}}", new { input = new { id = discussionId } }, cancellation);
            else await Query(token, "mutation($input:UpdateDiscussionInput!){updateDiscussion(input:$input){discussion{number}}}", new { input = new { discussionId, title = edit.Title!.Trim(), body = edit.Body.Trim() } }, cancellation);
        }
    }

    private async Task<JsonElement> Query(string token, string query, object variables, CancellationToken cancellation)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.github.com/graphql");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Headers.UserAgent.ParseAdd("GuiaDaTi/1.0");
        request.Content = JsonContent.Create(new { query, variables });
        using var client = clients.CreateClient("discussions");
        using var response = await client.SendAsync(request, cancellation);
        if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden) {
            var reason = response.StatusCode == System.Net.HttpStatusCode.Unauthorized ? "authentication" : "forbidden";
            LogRejection(response, query, reason);
            throw Rejected(reason);
        }
        response.EnsureSuccessStatusCode();
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellation));
        if (document.RootElement.TryGetProperty("errors", out var errors)) {
            // Do not infer repository roles from a generic FORBIDDEN response.
            var types = errors.EnumerateArray().Select(error => error.TryGetProperty("type", out var type) ? type.GetString() : null).ToArray();
            var reason = types.Contains("INSUFFICIENT_SCOPES") ? "scope"
                : types.Contains("FORBIDDEN") ? "forbidden" : "graphql";
            LogRejection(response, query, reason);
            throw Rejected(reason);
        }
        return document.RootElement.GetProperty("data").Clone();
    }

    private static DiscussionWriteRejectedException Rejected(string reason) => new(reason switch {
        "authentication" => "Sua autorização do GitHub expirou ou foi revogada. Saia e entre novamente. Seu texto continua no formulário.",
        "scope" => "A autorização do GitHub não inclui a permissão necessária. Saia e entre novamente para revisar os acessos. Seu texto continua no formulário.",
        "forbidden" => "O GitHub recusou esta ação. A autorização do aplicativo ou uma restrição da conta ou da comunidade pode impedir a publicação. Seu texto continua no formulário.",
        _ => "O GitHub recusou esta ação. Confira os dados e tente novamente."
    });

    private void LogRejection(HttpResponseMessage response, string query, string reason)
    {
        var operation = query.Contains("mutation(") ? query.Split('{', 2)[1].Split('(', 2)[0].Trim() : "metadata";
        var requestId = response.Headers.TryGetValues("X-GitHub-Request-Id", out var values) ? values.FirstOrDefault() : null;
        if (requestId is null || !Regex.IsMatch(requestId, @"\A[A-Za-z0-9:.-]{1,100}\z")) requestId = "unavailable";
        // Never log the token, variables, user content or upstream error messages.
        logger?.LogWarning("GitHub discussion request rejected. Operation {Operation}, reason {Reason}, HTTP {StatusCode}, GitHub request {GitHubRequestId}",
            operation, reason, (int)response.StatusCode, requestId);
    }
}

public record DiscussionDraft(string Body, string? Title = null, string? CategoryId = null, int? Number = null, string? ReplyToId = null, string? CategoryName = null);
public record DiscussionEdit(string Body, string? Title = null);
public record OwnedPublication(string Body, string? Title, bool CanUpdate, bool CanDelete);
public sealed class DiscussionWriteRejectedException(string message) : Exception(message);
public static class DiscussionWriteEndpoints
{
    public static void MapDiscussionWrites(this WebApplication app)
    {
        app.MapGet("/api/discussions/{number:int}/editable", async (int number, string? commentId, HttpContext context, DiscussionWriter writer) => {
            context.Response.Headers.CacheControl = "no-store";
            if (context.User.Identity?.IsAuthenticated != true || context.User.FindFirstValue(ClaimTypes.NameIdentifier) is not { } userId) return Results.Unauthorized();
            if (number < 1 || commentId?.Length is > 200 or 0) return Results.BadRequest();
            var token = await context.GetTokenAsync("access_token");
            if (string.IsNullOrEmpty(token)) return Results.Unauthorized();
            try { return Results.Ok(await writer.ReadOwnAsync(token, userId, number, commentId, context.RequestAborted)); }
            catch (DiscussionWriteRejectedException error) { return Results.Json(new { error = error.Message }, statusCode: 403); }
            catch (Exception error) when (error is HttpRequestException or JsonException or DiscussionsUnavailableException or InvalidOperationException or KeyNotFoundException or OperationCanceledException) {
                return Results.Json(new { error = "Não foi possível carregar o texto original. Tente novamente." }, statusCode: 503);
            }
        });
        app.MapPut("/api/discussions/{number:int}", (int number, DiscussionEdit edit, HttpContext context, IAntiforgery csrf, DiscussionWriter writer, DiscussionsClient reader) => Change(number, null, edit, context, csrf, writer, reader));
        app.MapDelete("/api/discussions/{number:int}", (int number, HttpContext context, IAntiforgery csrf, DiscussionWriter writer, DiscussionsClient reader) => Change(number, null, null, context, csrf, writer, reader));
        app.MapPut("/api/discussions/{number:int}/comments/{id}", (int number, string id, DiscussionEdit edit, HttpContext context, IAntiforgery csrf, DiscussionWriter writer, DiscussionsClient reader) => Change(number, id, edit, context, csrf, writer, reader));
        app.MapDelete("/api/discussions/{number:int}/comments/{id}", (int number, string id, HttpContext context, IAntiforgery csrf, DiscussionWriter writer, DiscussionsClient reader) => Change(number, id, null, context, csrf, writer, reader));
        app.MapPost("/api/discussions/publish", async (DiscussionDraft draft, HttpContext context, IAntiforgery csrf, DiscussionWriter writer, DiscussionsClient reader) => {
            context.Response.Headers.CacheControl = "no-store";
            if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
            try { await csrf.ValidateRequestAsync(context); }
            catch (AntiforgeryValidationException) { return Results.BadRequest(new { error = "Atualize a página e tente novamente." }); }
            if (string.IsNullOrWhiteSpace(draft.Body) || draft.Body.Length > 10000 || draft.Number is <= 0
                || draft.CategoryId?.Length > 200 || draft.ReplyToId?.Length > 200
                || (draft.Number is null && (string.IsNullOrWhiteSpace(draft.Title) || draft.Title.Length > 256 || string.IsNullOrWhiteSpace(draft.CategoryId) || draft.ReplyToId is not null)))
                return Results.BadRequest(new { error = "Preencha o texto e, para um novo tópico, o título e a categoria." });
            var token = await context.GetTokenAsync("access_token");
            if (string.IsNullOrEmpty(token)) return Results.Unauthorized();
            try {
                var number = await writer.PublishAsync(token, draft, context.RequestAborted);
                await reader.InvalidateAsync(context.RequestAborted);
                return Results.Ok(new { number });
            }
            catch (DiscussionWriteRejectedException error) { return Results.Json(new { error = error.Message }, statusCode: 403); }
            catch (Exception error) when (error is HttpRequestException or JsonException or DiscussionsUnavailableException or InvalidOperationException or KeyNotFoundException or OperationCanceledException) {
                return Results.Json(new { error = "Não foi possível confirmar a publicação. Confira o tópico no GitHub antes de tentar novamente." }, statusCode: 503);
            }
        }).WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(65536));
    }

    private static async Task<IResult> Change(int number, string? commentId, DiscussionEdit? edit, HttpContext context, IAntiforgery csrf, DiscussionWriter writer, DiscussionsClient reader)
    {
        context.Response.Headers.CacheControl = "no-store";
        if (context.User.Identity?.IsAuthenticated != true || context.User.FindFirstValue(ClaimTypes.NameIdentifier) is not { } userId) return Results.Unauthorized();
        try { await csrf.ValidateRequestAsync(context); }
        catch (AntiforgeryValidationException) { return Results.BadRequest(new { error = "Atualize a página e tente novamente." }); }
        if (number < 1 || commentId?.Length is > 200 or 0 || (edit is not null && (string.IsNullOrWhiteSpace(edit.Body) || edit.Body.Length > 10000
            || (commentId is null && (string.IsNullOrWhiteSpace(edit.Title) || edit.Title.Length > 256))))) return Results.BadRequest(new { error = "Preencha o texto e o título do tópico antes de salvar." });
        var token = await context.GetTokenAsync("access_token");
        if (string.IsNullOrEmpty(token)) return Results.Unauthorized();
        try {
            await writer.ChangeAsync(token, userId, number, commentId, edit, context.RequestAborted);
            await reader.InvalidateAsync(CancellationToken.None);
            return Results.NoContent();
        }
        catch (DiscussionWriteRejectedException error) { return Results.Json(new { error = error.Message }, statusCode: 403); }
        catch (Exception error) when (error is HttpRequestException or JsonException or DiscussionsUnavailableException or InvalidOperationException or KeyNotFoundException or OperationCanceledException) {
            return Results.Json(new { error = "Não foi possível confirmar a alteração. Confira sua publicação no GitHub antes de tentar novamente." }, statusCode: 503);
        }
    }
}
