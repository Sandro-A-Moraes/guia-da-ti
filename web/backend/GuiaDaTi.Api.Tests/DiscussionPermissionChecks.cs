using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

static class DiscussionPermissionChecks
{
    public static async Task Run()
    {
        foreach (var mode in new[] { "forbidden", "scope", "http-forbidden", "http-unauthorized", "unknown" }) {
            foreach (var rejectMutation in new[] { false, true }) {
                var handler = new RejectedDiscussionGitHub(mode, rejectMutation);
                var logs = new DiscussionRejectionLog();
                var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
                    ["DISCUSSIONS_REPOSITORY"] = "example/community"
                }).Build();
                var writer = new DiscussionWriter(new RejectedDiscussionFactory(handler), config, logs);
                string message;
                try {
                    await writer.PublishAsync("visitor-secret", new("private draft body", Number: 7), default);
                    throw new Exception("GitHub rejection must not report publication success");
                } catch (DiscussionWriteRejectedException error) { message = error.Message; }
                Check(!message.Contains("acesso de escrita"), "Rejection does not prescribe repository write access");
                Check(handler.Calls == (rejectMutation ? 2 : 1), "No retries or fallback after rejection");
                Check(handler.VisitorTokenOnly, "Never replace visitor identity with server credential");
                if (mode == "scope") Check(message.Contains("revisar os acessos"), "Missing scopes suggest reviewing authorization");
                if (mode == "http-unauthorized") Check(message.Contains("expirou ou foi revogada"), "Expired authorization is identified");
                if (mode is "forbidden" or "http-forbidden") Check(message.Contains("restrição"), "Generic forbidden does not invent a cause");
                Check(logs.Lines.Count == 1, "One diagnostic per failed request");
                var logged = logs.Lines[0];
                Check(logged.Contains(rejectMutation ? "addDiscussionComment" : "metadata"), "Diagnostic identifies failing operation");
                Check(logged.Contains("ABCD:1234"), "Diagnostic includes safe GitHub request ID");
                foreach (var secret in new[] { "visitor-secret", "private draft body", "sensitive upstream detail" })
                    Check(!logged.Contains(secret) && !message.Contains(secret), "No secrets or upstream error text in logs or response");
            }
        }
        Console.WriteLine("Discussion permissions OK: metadata/mutation failures, scopes, HTTP 401/403, safe diagnostics and visitor identity.");
    }
    private static void Check(bool value, string name) { if (!value) throw new Exception(name); }
}

sealed class RejectedDiscussionFactory(RejectedDiscussionGitHub handler) : IHttpClientFactory
{
    public HttpClient CreateClient(string name) => new(handler, false);
}

sealed class RejectedDiscussionGitHub(string mode, bool rejectMutation) : HttpMessageHandler
{
    public int Calls;
    public bool VisitorTokenOnly = true;
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellation)
    {
        Calls++;
        VisitorTokenOnly &= request.Headers.Authorization?.Parameter == "visitor-secret";
        using var input = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellation));
        var mutation = input.RootElement.GetProperty("query").GetString()!.Contains("mutation(");
        var reject = !rejectMutation || mutation;
        var status = !reject ? HttpStatusCode.OK : mode switch {
            "http-forbidden" => HttpStatusCode.Forbidden,
            "http-unauthorized" => HttpStatusCode.Unauthorized,
            _ => HttpStatusCode.OK
        };
        var body = reject
            ? JsonSerializer.Serialize(new { errors = new[] { new { type = mode == "scope" ? "INSUFFICIENT_SCOPES" : mode == "forbidden" ? "FORBIDDEN" : "UNKNOWN", message = "sensitive upstream detail" } } })
            : JsonSerializer.Serialize(new { data = new { repository = new { id = "repo-1", isPrivate = false, hasDiscussionsEnabled = true,
                discussion = new { id = "thread-7", locked = false, closed = false } } } });
        var response = new HttpResponseMessage(status) { Content = new StringContent(body) };
        response.Headers.Add("X-GitHub-Request-Id", "ABCD:1234");
        return response;
    }
}

sealed class DiscussionRejectionLog : ILogger<DiscussionWriter>
{
    public List<string> Lines { get; } = [];
    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel level) => true;
    public void Log<TState>(LogLevel level, EventId id, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        => Lines.Add(formatter(state, exception));
}
