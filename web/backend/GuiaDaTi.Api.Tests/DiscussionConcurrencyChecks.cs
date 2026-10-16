using System.Collections.Concurrent;
using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

static class DiscussionConcurrencyChecks
{
    public static async Task Run()
    {
        var github = new SlowGitHub();
        var settings = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["DISCUSSIONS_REPOSITORY"] = "example/community", ["DISCUSSIONS_TOKEN"] = "test-only-token"
        }).Build();
        using var client = new DiscussionsClient(new FakeFactory(github), settings);

        var slow = client.ThreadAsync(1, null, default);
        await github.Started(1);
        await Within(client.ThreadAsync(2, null, default), "A slow query must not block a different key");

        var duplicate = client.ThreadAsync(1, null, default);
        await Task.Delay(100);
        github.Release(1);
        await Within(Task.WhenAll(slow, duplicate), "Slow query finishes after release");
        Check(github.CallsFor(1) == 1, "Concurrent queries for the same key share one GitHub call");

        var stale = client.ThreadAsync(3, null, default);
        await github.Started(3);
        await Within(client.InvalidateAsync(default), "Invalidation does not wait for queries in flight");
        github.Release(3);
        await Within(stale, "Query in flight still answers its caller");
        await Within(client.ThreadAsync(3, null, default), "Query after invalidation");
        Check(github.CallsFor(3) == 2, "Results fetched before invalidation are not cached");

        var burst = Enumerable.Range(100, 20).Select(number => client.ThreadAsync(number, null, default)).ToArray();
        await Task.Delay(300);
        Check(github.MaxInFlight is > 1 and <= 6, $"Different keys run in parallel within the limit (max {github.MaxInFlight})");
        foreach (var number in Enumerable.Range(100, 20)) github.Release(number);
        await Within(Task.WhenAll(burst), "Burst completes after release");
        Check(github.MaxInFlight <= 6, "Concurrency stays limited");

        // Callers that saw an empty cache must not start a new call after another caller completed and cached it.
        var instant = new SlowGitHub();
        using var racing = new DiscussionsClient(new FakeFactory(instant), settings);
        const int rounds = 2000, callers = 32;
        using var barrier = new Barrier(callers, _ => racing.InvalidateAsync(default).GetAwaiter().GetResult());
        var threads = Enumerable.Range(0, callers).Select(_ => new Thread(() => {
            for (var round = 0; round < rounds; round++)
            {
                barrier.SignalAndWait();
                racing.ThreadAsync(2, null, default).GetAwaiter().GetResult();
            }
        })).ToArray();
        foreach (var thread in threads) thread.Start();
        foreach (var thread in threads) thread.Join();
        Check(instant.CallsFor(2) == rounds, $"One GitHub call per round under contention ({instant.CallsFor(2)} calls in {rounds} rounds)");
    }

    static async Task Within(Task task, string name)
    {
        if (await Task.WhenAny(task, Task.Delay(TimeSpan.FromSeconds(3))) != task) throw new Exception(name);
        await task;
    }

    static void Check(bool condition, string name) { if (!condition) throw new Exception(name); }
}

// Holds each discussion request, except number 2, until the test releases that number.
sealed class SlowGitHub : HttpMessageHandler
{
    private readonly ConcurrentDictionary<int, TaskCompletionSource> released = new();
    private readonly ConcurrentDictionary<int, TaskCompletionSource> started = new();
    private readonly ConcurrentDictionary<int, int> calls = new();
    private int inFlight;
    public int MaxInFlight { get; private set; }
    public int CallsFor(int number) => calls.GetValueOrDefault(number);
    public Task Started(int number) => started.GetOrAdd(number, _ => new(TaskCreationOptions.RunContinuationsAsynchronously)).Task;
    public void Release(int number) => released.GetOrAdd(number, _ => new(TaskCreationOptions.RunContinuationsAsynchronously)).TrySetResult();

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        using var payload = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellationToken));
        var number = payload.RootElement.GetProperty("variables").GetProperty("number").GetInt32();
        calls.AddOrUpdate(number, 1, (_, count) => count + 1);
        var current = Interlocked.Increment(ref inFlight);
        lock (calls) MaxInFlight = Math.Max(MaxInFlight, current);
        try
        {
            started.GetOrAdd(number, _ => new(TaskCreationOptions.RunContinuationsAsynchronously)).TrySetResult();
            if (number != 2) await released.GetOrAdd(number, _ => new(TaskCreationOptions.RunContinuationsAsynchronously)).Task.WaitAsync(cancellationToken);
            var body = JsonSerializer.Serialize(new { data = new { repository = new { isPrivate = false, hasDiscussionsEnabled = true, discussion = (object?)null } } });
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body) };
        }
        finally { Interlocked.Decrement(ref inFlight); }
    }
}
