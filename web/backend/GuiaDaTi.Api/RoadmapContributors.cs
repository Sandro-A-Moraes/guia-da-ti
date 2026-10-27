using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;

public record RoadmapPerson(string Login, string Url, string AvatarUrl);
public record RoadmapContributor(string Login, string Url, string AvatarUrl, int Contributions);
public record RoadmapAuthorship(RoadmapPerson? Creator, RoadmapContributor[] Contributors);

// Who created and who changed a community roadmap, read from the commit history of its catalog file.
public sealed class RoadmapContributors(IHttpClientFactory clients, IConfiguration configuration, TimeProvider clock) : IDisposable
{
    private const int MaximumCached = 64, MaximumPages = 10;
    private readonly SemaphoreSlim gate = new(1, 1);
    private long stored;
    private readonly Dictionary<string, (RoadmapAuthorship Value, DateTimeOffset Expires, long Order)> cache = [];
    private readonly string repository = configuration["DISCUSSIONS_REPOSITORY"] ?? "guia-da-ti/guia-da-ti-dados";

    public async Task<RoadmapAuthorship> GetAsync(string slug, CancellationToken cancellation)
    {
        if (!Regex.IsMatch(slug, @"^[a-z0-9]+(?:-[a-z0-9]+)*$") || slug.Length > 80) throw new KeyNotFoundException();
        await gate.WaitAsync(cancellation);
        try {
            var now = clock.GetUtcNow();
            if (cache.TryGetValue(slug, out var hit) && hit.Expires > now) return hit.Value;
            var value = await Load(slug, cancellation);
            foreach (var key in cache.Where(item => item.Value.Expires <= now).Select(item => item.Key).ToArray()) cache.Remove(key);
            if (cache.Count >= MaximumCached) cache.Remove(cache.OrderBy(item => item.Value.Order).First().Key);
            cache[slug] = (value, now.AddHours(1), ++stored);
            return value;
        }
        finally { gate.Release(); }
    }

    private async Task<RoadmapAuthorship> Load(string slug, CancellationToken cancellation)
    {
        if (!Regex.IsMatch(repository, @"^[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+$")) throw new DiscussionsUnavailableException();
        // A server credential must never make a private repository's history public.
        using (var metadata = JsonDocument.Parse(await Fetch($"repos/{repository}", cancellation)))
            if (metadata.RootElement.GetProperty("private").GetBoolean()) throw new DiscussionsUnavailableException();
        var counts = new Dictionary<string, (long Id, int Count)>(StringComparer.OrdinalIgnoreCase);
        JsonElement? oldest = null;
        var next = $"repos/{repository}/commits?path={Uri.EscapeDataString($"data/roadmaps/{slug}.json")}&per_page=100";
        string? last = null;
        for (var page = 0; next is not null && page < MaximumPages; page++) {
            var (body, links) = await FetchPage(next, cancellation);
            using var document = JsonDocument.Parse(body);
            foreach (var commit in document.RootElement.EnumerateArray()) {
                oldest = commit.Clone();
                if (Author(commit) is not { } author) continue;
                counts[author.Login] = (author.Id, counts.GetValueOrDefault(author.Login).Count + 1);
            }
            links.TryGetValue("next", out next);
            links.TryGetValue("last", out last);
        }
        if (next is not null && last is not null) {
            // Long history: the creator is on the last page, even though counting stopped earlier.
            var (body, _) = await FetchPage(last, cancellation);
            using var document = JsonDocument.Parse(body);
            foreach (var commit in document.RootElement.EnumerateArray()) oldest = commit.Clone();
        }
        var creator = oldest is { } first && Author(first) is { } person ? new RoadmapPerson(person.Login, Profile(person.Login), Avatar(person.Id)) : null;
        var contributors = counts.Select(item => new RoadmapContributor(item.Key, Profile(item.Key), Avatar(item.Value.Id), item.Value.Count))
            .OrderByDescending(item => item.Contributions).ThenBy(item => item.Login, StringComparer.OrdinalIgnoreCase).ToArray();
        return new(creator, contributors);
    }

    private static (string Login, long Id)? Author(JsonElement commit)
    {
        if (!commit.TryGetProperty("author", out var author) || author.ValueKind != JsonValueKind.Object) return null;
        if (!author.TryGetProperty("type", out var type) || type.GetString() != "User") return null;
        if (!author.TryGetProperty("login", out var login) || login.GetString() is not { } name || !Regex.IsMatch(name, @"^[A-Za-z0-9][A-Za-z0-9-]*$")) return null;
        return (name, author.GetProperty("id").GetInt64());
    }

    private static string Profile(string login) => $"https://github.com/{login}";
    private static string Avatar(long id) => $"https://avatars.githubusercontent.com/u/{id}?s=80";

    private async Task<string> Fetch(string path, CancellationToken cancellation)
    {
        var (body, _) = await FetchPage(path, cancellation);
        return body;
    }

    private async Task<(string Body, Dictionary<string, string> Links)> FetchPage(string path, CancellationToken cancellation)
    {
        // Pagination links come from GitHub; only follow them inside the API host.
        var url = path.StartsWith("https://", StringComparison.Ordinal) ? path : $"https://api.github.com/{path}";
        if (!url.StartsWith("https://api.github.com/", StringComparison.Ordinal)) throw new DiscussionsUnavailableException();
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.UserAgent.ParseAdd("GuiaDaTi/1.0");
        request.Headers.Accept.ParseAdd("application/vnd.github+json");
        var token = configuration["DISCUSSIONS_TOKEN"];
        if (!string.IsNullOrWhiteSpace(token)) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var client = clients.CreateClient("discussions");
        using var response = await client.SendAsync(request, cancellation);
        if (!response.IsSuccessStatusCode) throw new DiscussionsUnavailableException();
        var links = new Dictionary<string, string>();
        if (response.Headers.TryGetValues("Link", out var header))
            foreach (Match match in Regex.Matches(string.Join(",", header), "<([^>]+)>;\\s*rel=\"(\\w+)\"")) links[match.Groups[2].Value] = match.Groups[1].Value;
        return (await response.Content.ReadAsStringAsync(cancellation), links);
    }

    public void Dispose() => gate.Dispose();
}
