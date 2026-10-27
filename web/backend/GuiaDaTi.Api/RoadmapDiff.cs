// Plain-language summary of a roadmap change for the PR description.
public static class RoadmapDiff
{
    private const int MaximumLines = 50;
    private static readonly Dictionary<string, string> Levels = new() { ["beginner"] = "iniciante", ["intermediate"] = "intermediário", ["advanced"] = "avançado" };
    private static readonly Dictionary<string, string> Importances = new() { ["essential"] = "essencial", ["recommended"] = "recomendada", ["optional"] = "opcional" };

    private record Located(string Id, string Title, string? Description, string Importance, string? Choice, string Section, string? Parent, int Position, string[] Resources, string[] Links);

    public static string[] Summarize(RoadmapData? before, RoadmapData after)
    {
        var lines = new List<string>();
        if (before is null) {
            var count = Flatten(after).Count;
            lines.Add($"Roadmap novo, nível {Level(after.Level)}, com {Plural(after.Sections.Length, "bloco", "blocos")} e {Plural(count, "etapa", "etapas")}.");
            foreach (var section in after.Sections) lines.Add($"Bloco {Text(section.Title)}: {Plural(section.Steps.Length, "etapa", "etapas")}.");
            return Limit(lines);
        }
        if (before.Level != after.Level) lines.Add($"Nível mudou de {Level(before.Level)} para {Level(after.Level)}.");
        Sections(before, after, lines);
        var oldNodes = Flatten(before);
        var newNodes = Flatten(after);
        foreach (var node in newNodes.Values.Where(n => !oldNodes.ContainsKey(n.Id))) lines.Add($"Etapa incluída: {Text(node.Title)} (bloco {SectionTitle(after, node.Section)}).");
        foreach (var node in oldNodes.Values.Where(n => !newNodes.ContainsKey(n.Id))) lines.Add($"Etapa removida: {Text(node.Title)}.");
        foreach (var node in newNodes.Values.Where(n => oldNodes.ContainsKey(n.Id))) {
            var old = oldNodes[node.Id];
            var name = Text(node.Title);
            if (old.Title != node.Title) lines.Add($"Etapa renomeada: {Text(old.Title)} agora é {name}.");
            if (old.Section != node.Section || old.Parent != node.Parent) lines.Add($"Etapa movida: {name} foi para {Where(after, node)}.");
            else if (old.Position != node.Position) lines.Add($"Etapa movida: {name} mudou de posição.");
            if (old.Importance != node.Importance) lines.Add($"Importância de {name} mudou de {Importance(old.Importance)} para {Importance(node.Importance)}.");
            if (old.Description != node.Description) lines.Add($"Explicação de {name} foi alterada.");
            if (old.Choice != node.Choice) lines.Add($"Escolha de {name} foi alterada.");
            foreach (var added in node.Resources.Except(old.Resources)) lines.Add($"Recurso incluído em {name}: {Text(added)}.");
            foreach (var removed in old.Resources.Except(node.Resources)) lines.Add($"Recurso removido de {name}: {Text(removed)}.");
            foreach (var added in node.Links.Except(old.Links)) lines.Add($"Link externo incluído em {name}: {Text(added)}.");
            foreach (var removed in old.Links.Except(node.Links)) lines.Add($"Link externo removido de {name}: {Text(removed)}.");
        }
        return lines.Count == 0 ? ["Nenhuma mudança nas etapas."] : Limit(lines);
    }

    private static void Sections(RoadmapData before, RoadmapData after, List<string> lines)
    {
        var old = before.Sections.Select((s, i) => (s, i)).ToDictionary(x => x.s.Id);
        var current = after.Sections.Select((s, i) => (s, i)).ToDictionary(x => x.s.Id);
        foreach (var (section, _) in current.Values.Where(x => !old.ContainsKey(x.s.Id))) lines.Add($"Bloco incluído: {Text(section.Title)}.");
        foreach (var (section, _) in old.Values.Where(x => !current.ContainsKey(x.s.Id))) lines.Add($"Bloco removido: {Text(section.Title)}.");
        // Compare order among the blocks present in both versions, so adding one block does not look like a move.
        var shared = before.Sections.Where(s => current.ContainsKey(s.Id)).Select(s => s.Id).ToArray();
        var sharedNow = after.Sections.Where(s => old.ContainsKey(s.Id)).Select(s => s.Id).ToArray();
        foreach (var (section, _) in current.Values.Where(x => old.ContainsKey(x.s.Id))) {
            var previous = old[section.Id].s;
            if (previous.Title != section.Title) lines.Add($"Bloco renomeado: {Text(previous.Title)} agora é {Text(section.Title)}.");
            if (Array.IndexOf(shared, section.Id) != Array.IndexOf(sharedNow, section.Id)) lines.Add($"Bloco movido: {Text(section.Title)} mudou de posição.");
        }
    }

    private static Dictionary<string, Located> Flatten(RoadmapData roadmap)
    {
        var nodes = new Dictionary<string, Located>();
        foreach (var section in roadmap.Sections) {
            for (var i = 0; i < section.Steps.Length; i++) {
                var step = section.Steps[i];
                nodes[step.Id] = new(step.Id, step.Title, step.Description, step.Importance, step.Choice, section.Id, null, i, Refs(step.Resources), Urls(step.Links));
                for (var j = 0; j < (step.Children?.Length ?? 0); j++) {
                    var child = step.Children![j];
                    nodes[child.Id] = new(child.Id, child.Title, child.Description, child.Importance, null, section.Id, step.Id, j, Refs(child.Resources), Urls(child.Links));
                }
            }
        }
        return nodes;
    }

    private static string[] Refs(RoadmapResourceRef[]? resources) => resources?.Select(r => $"{r.Type}/{r.Slug}").ToArray() ?? [];
    private static string[] Urls(RoadmapLinkData[]? links) => links?.Select(l => l.Url).ToArray() ?? [];
    private static string SectionTitle(RoadmapData roadmap, string id) => Text(roadmap.Sections.First(s => s.Id == id).Title);
    private static string Where(RoadmapData roadmap, Located node) => node.Parent is null
        ? $"o bloco {SectionTitle(roadmap, node.Section)}"
        : $"as subetapas de {Text(roadmap.Sections.SelectMany(s => s.Steps).First(s => s.Id == node.Parent).Title)}";
    private static string Level(string level) => Levels.GetValueOrDefault(level, level);
    private static string Importance(string value) => Importances.GetValueOrDefault(value, value);
    private static string Plural(int count, string one, string many) => $"{count} {(count == 1 ? one : many)}";

    // User text goes inside backticks on one line so it cannot break the PR Markdown.
    private static string Text(string value)
    {
        var flat = string.Join(' ', value.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries)).Replace('`', '\'').Trim();
        return $"`{(flat.Length > 80 ? flat[..80] + "…" : flat)}`";
    }

    private static string[] Limit(List<string> lines)
    {
        if (lines.Count <= MaximumLines) return lines.ToArray();
        var rest = lines.Count - (MaximumLines - 1);
        return [.. lines.Take(MaximumLines - 1), $"…e mais {rest} mudanças."];
    }
}
