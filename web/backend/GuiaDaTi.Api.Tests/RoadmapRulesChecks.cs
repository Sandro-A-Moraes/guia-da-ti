using System.Text.Json;

static class RoadmapRulesChecks
{
    private static readonly string[] Types = ["courses", "books", "roadmaps"];

    public static void Run()
    {
        var catalog = new Catalog(1, new(["dados", "backend"], ["python"], ["pt-BR", "en"], Types), [
            new("curso-a", "courses", "Curso A", "Resumo do curso", "Descrição do curso", "https://example.org/a", ["dados"], [], ["pt-BR"], "2026-10-01", false),
            new("livro-b", "books", "Livro B", "Resumo do livro", "Descrição do livro", "https://example.org/b", ["dados"], [], ["pt-BR"], "2026-10-01", false)]);
        RoadmapRules.Validate(Valid(), catalog);
        RoadmapRules.Validate(Valid() with { Slug = "existente", BaseSha = "abc" }, catalog);

        Rejects("nome curto", Valid() with { Name = "a" }, catalog);
        Rejects("resumo curto", Valid() with { Summary = "curto" }, catalog);
        Rejects("descrição longa", Valid() with { Description = new string('x', 4001) }, catalog);
        Rejects("slug inválido na edição", Valid() with { Slug = "Slug Inválido" }, catalog);
        Rejects("nome sem letras", Valid() with { Name = "!!!" }, catalog);
        Rejects("assunto fora da taxonomia", Valid() with { Areas = ["nenhum"] }, catalog);
        Rejects("sem assunto", Valid() with { Areas = [] }, catalog);
        Rejects("tecnologia fora da taxonomia", Valid() with { Technologies = ["cobol"] }, catalog);
        Rejects("idioma fora da taxonomia", Valid() with { Languages = ["xx"] }, catalog);
        Rejects("imagem http", Valid() with { ImageUrl = "http://example.org/a.png" }, catalog);
        Rejects("imagem local", Valid() with { ImageUrl = "https://127.0.0.1/a.png" }, catalog);
        Rejects("imagem e arquivo", Valid() with { ImageUrl = "https://example.org/a.png", ImageUploadId = "x" }, catalog);
        Rejects("arquivo sem serviço de imagens", Valid() with { ImageUploadId = "0123456789abcdef0123456789abcdef.png" }, catalog);
        Rejects("nível inválido", With(r => r with { Level = "expert" }), catalog);
        Rejects("um bloco só", With(r => r with { Sections = r.Sections[..1] }), catalog);
        Rejects("21 blocos", With(r => r with { Sections = Enumerable.Range(0, 21).Select(i => Section($"b{i}", $"Bloco {i}", [Step($"e{i}")])).ToArray() }), catalog);
        Rejects("título de bloco curto", With(r => r with { Sections = [r.Sections[0] with { Title = "a" }, r.Sections[1]] }), catalog);
        Rejects("bloco sem etapas", With(r => r with { Sections = [r.Sections[0], Section("vazio", "Vazio", [])] }), catalog);
        Rejects("id repetido", With(r => r with { Sections = [r.Sections[0], r.Sections[1] with { Steps = [Step("e1")] }] }), catalog);
        Rejects("id com maiúscula", With(r => r with { Sections = [r.Sections[0] with { Id = "Bloco" }, r.Sections[1]] }), catalog);
        Rejects("menos de 5 nós", new RoadmapData(Valid().Roadmap.Level, [Section("a", "Bloco A", [Step("a1"), Step("a2")]), Section("b", "Bloco B", [Step("b1"), Step("b2")])]), catalog);
        Rejects("mais de 150 nós", new RoadmapData(Valid().Roadmap.Level, [Section("a", "Bloco A", Enumerable.Range(0, 76).Select(i => Step($"a{i}")).ToArray()), Section("b", "Bloco B", Enumerable.Range(0, 75).Select(i => Step($"b{i}")).ToArray())]), catalog);
        Check(Accepts(new RoadmapData(Valid().Roadmap.Level, [Section("a", "Bloco A", Enumerable.Range(0, 75).Select(i => Step($"a{i}")).ToArray()), Section("b", "Bloco B", Enumerable.Range(0, 75).Select(i => Step($"b{i}")).ToArray())]), catalog), "150 nós passam");
        Rejects("explicação longa", Step("x") with { Description = new string('x', 401) }, catalog);
        Rejects("explicação vazia", Step("x") with { Description = "  " }, catalog);
        Rejects("importância inválida", Step("x") with { Importance = "urgent" }, catalog);
        Rejects("título de etapa curto", Step("x") with { Title = "a" }, catalog);
        Rejects("recurso inexistente", Step("x") with { Resources = [new("courses", "nao-existe")] }, catalog);
        Rejects("recurso repetido", Step("x") with { Resources = [new("courses", "curso-a"), new("courses", "curso-a")] }, catalog);
        Rejects("9 recursos", Step("x") with { Resources = Enumerable.Range(0, 9).Select(i => new RoadmapResourceRef("courses", "curso-a" + i)).ToArray() }, catalog);
        Rejects("lista de recursos vazia", Step("x") with { Resources = [] }, catalog);
        Rejects("4 links", Step("x") with { Links = Enumerable.Range(0, 4).Select(i => new RoadmapLinkData("Link " + i, "https://example.org/" + i)).ToArray() }, catalog);
        Rejects("link http", Step("x") with { Links = [new("Link", "http://example.org/")] }, catalog);
        Rejects("link com senha", Step("x") with { Links = [new("Link", "https://user:pass@example.org/")] }, catalog);
        Rejects("link local", Step("x") with { Links = [new("Link", "https://localhost.internal/")] }, catalog);
        Rejects("título de link curto", Step("x") with { Links = [new("a", "https://example.org/")] }, catalog);
        Rejects("13 subetapas", Step("x") with { Children = Enumerable.Range(0, 13).Select(i => Sub($"s{i}")).ToArray() }, catalog);
        Rejects("lista de subetapas vazia", Step("x") with { Children = [] }, catalog);
        Rejects("subetapa com recurso inexistente", Step("x") with { Children = [Sub("s1") with { Resources = [new("books", "nada")] }] }, catalog);
        Rejects("escolha solta", Step("x") with { Choice = "framework" }, catalog);
        Rejects("escolha inválida", Step("x") with { Choice = "Framework" }, catalog);
        Rejects("escolha separada", Roadmap([Step("a") with { Choice = "x" }, Step("b") with { Choice = "x" }, Step("c"), Step("d") with { Choice = "x" }, Step("e") with { Choice = "x" }]), catalog);
        Check(Accepts(Roadmap([Step("a") with { Choice = "x" }, Step("b") with { Choice = "x" }, Step("c"), Step("d") with { Choice = "y" }, Step("e") with { Choice = "y" }]), catalog), "grupos vizinhos passam");

        // Null values at any depth are rejected with a user message, never a crash.
        foreach (var broken in new RoadmapDraft[] {
            Valid() with { Name = null! }, Valid() with { Areas = null! }, Valid() with { Technologies = null! }, Valid() with { Languages = null! },
            Valid() with { Roadmap = null! }, With(r => r with { Sections = null! }), With(r => r with { Level = null! }),
            With(r => r with { Sections = [null!, r.Sections[1]] }), With(r => r with { Sections = [r.Sections[0] with { Steps = null! }, r.Sections[1]] }),
            With(r => r with { Sections = [r.Sections[0] with { Steps = [null!] }, r.Sections[1]] }), With(r => r with { Sections = [r.Sections[0] with { Id = null!, Title = null! }, r.Sections[1]] }),
            Wrap(Roadmap([Step("x") with { Title = null! }])), Wrap(Roadmap([Step("x") with { Id = null! }])), Wrap(Roadmap([Step("x") with { Importance = null! }])),
            Wrap(Roadmap([Step("x") with { Resources = [null!] }])), Wrap(Roadmap([Step("x") with { Resources = [new(null!, null!)] }])),
            Wrap(Roadmap([Step("x") with { Links = [null!] }])), Wrap(Roadmap([Step("x") with { Links = [new(null!, null!)] }])),
            Wrap(Roadmap([Step("x") with { Children = [null!] }])) })
            Rejects("valores nulos", broken, catalog);

        Check(RoadmapRules.SlugFor("Caminho em Dados e Análise!") == "caminho-em-dados-e-analise", "Slug sem acentos");
        foreach (var bad in new[] { "", "!!!", new string('a', 81) }) {
            try { RoadmapRules.SlugFor(bad); throw new Exception("Accepted bad slug"); } catch (ContributionRejectedException) { }
        }

        var resource = RoadmapRules.ToResource(Valid() with { Name = "  Meu caminho  ", Areas = ["dados", "dados"] }, "meu-caminho", "2026-10-27");
        Check(resource.Type == "roadmaps" && resource.Url is null && resource.Name == "Meu caminho" && resource.Areas.Length == 1 && resource.Slug == "meu-caminho", "Resource from draft");
        var json = CatalogJson.Serialize(resource);
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        Check(!root.TryGetProperty("url", out _) && root.GetProperty("roadmap").GetProperty("sections").GetArrayLength() == 2, "Serialized roadmap has no url and keeps sections");
        Check(!json.Contains("\"description\": null") && !json.Contains("null"), "Null fields are not written");
        Check(json == CatalogJson.Serialize(resource) && json.EndsWith('\n'), "Stable output");
        var output = Environment.GetEnvironmentVariable("CATALOG_FORMAT_CHECK_OUTPUT");
        if (!string.IsNullOrEmpty(output)) { Directory.CreateDirectory(output); File.WriteAllText(Path.Combine(output, "roadmap.json"), json); }

        DiffChecks();
        Console.WriteLine("Roadmap rules OK: limits, ids, choices, references, links, nulls, resource JSON and PR summary verified.");
    }

    private static void DiffChecks()
    {
        var before = Valid().Roadmap;
        var created = RoadmapDiff.Summarize(null, before);
        Check(created[0].Contains("Roadmap novo") && created[0].Contains("2 blocos") && created.Length == 3, "New roadmap summary");
        Check(RoadmapDiff.Summarize(before, before).SequenceEqual(["Nenhuma mudança nas etapas."]), "No change");

        var addedStep = before with { Sections = [before.Sections[0] with { Steps = [.. before.Sections[0].Steps, Step("nova")] }, before.Sections[1]] };
        Check(RoadmapDiff.Summarize(before, addedStep).Any(l => l.StartsWith("Etapa incluída") && l.Contains("`Etapa nova`")), "Added step");
        Check(RoadmapDiff.Summarize(addedStep, before).Any(l => l.StartsWith("Etapa removida")), "Removed step");

        var renamed = before with { Sections = [before.Sections[0] with { Steps = [before.Sections[0].Steps[0] with { Title = "Outro nome" }, .. before.Sections[0].Steps.Skip(1)] }, before.Sections[1]] };
        Check(RoadmapDiff.Summarize(before, renamed).Single().StartsWith("Etapa renomeada"), "Renamed step");

        var first = before.Sections[0].Steps;
        var reordered = before with { Sections = [before.Sections[0] with { Steps = [first[1], first[0], .. first.Skip(2)] }, before.Sections[1]] };
        Check(RoadmapDiff.Summarize(before, reordered).Any(l => l.Contains("mudou de posição")), "Moved within block");

        var moved = before with { Sections = [before.Sections[0] with { Steps = first[1..] }, before.Sections[1] with { Steps = [.. before.Sections[1].Steps, first[0]] }] };
        Check(RoadmapDiff.Summarize(before, moved).Any(l => l.StartsWith("Etapa movida") && l.Contains("`Prática`")), "Moved to another block");

        var changed = before with { Level = "advanced", Sections = [before.Sections[0] with { Steps = [first[0], first[1] with { Importance = "optional", Description = "Nova explicação", Resources = [new("books", "livro-b")], Links = [new("Novo", "https://example.org/n")] }, .. first.Skip(2)] }, before.Sections[1]] };
        var lines = RoadmapDiff.Summarize(before, changed);
        Check(lines.Any(l => l.StartsWith("Nível mudou")) && lines.Any(l => l.Contains("Importância")) && lines.Any(l => l.Contains("Explicação"))
            && lines.Any(l => l.StartsWith("Recurso removido")) && lines.Any(l => l.StartsWith("Recurso incluído")) && lines.Any(l => l.StartsWith("Link externo incluído")), "Attribute changes");

        var newSection = before with { Sections = [.. before.Sections, Section("extra", "Bloco extra", [Step("x1")])] };
        Check(RoadmapDiff.Summarize(before, newSection).Any(l => l.StartsWith("Bloco incluído")) && !RoadmapDiff.Summarize(before, newSection).Any(l => l.Contains("Bloco movido")), "Added block is not a move");
        var swapped = before with { Sections = [before.Sections[1], before.Sections[0]] };
        Check(RoadmapDiff.Summarize(before, swapped).Any(l => l.StartsWith("Bloco movido")), "Moved block");
        var renamedBlock = before with { Sections = [before.Sections[0] with { Title = "Novo título" }, before.Sections[1]] };
        Check(RoadmapDiff.Summarize(before, renamedBlock).Single().StartsWith("Bloco renomeado"), "Renamed block");

        var hostile = before with { Sections = [before.Sections[0] with { Steps = [Step("h") with { Title = "Linha 1\nLinha `2`" }] }, before.Sections[1]] };
        var hostileLines = RoadmapDiff.Summarize(before, hostile);
        Check(hostileLines.All(l => !l.Contains('\n')) && hostileLines.Any(l => l.Contains("`Linha 1 Linha '2'`")), "User text stays on one line inside backticks");

        var big = before with { Sections = [before.Sections[0] with { Steps = Enumerable.Range(0, 80).Select(i => Step($"g{i}")).ToArray() }, before.Sections[1]] };
        var many = RoadmapDiff.Summarize(before, big);
        Check(many.Length == 50 && many[^1].StartsWith("…e mais ") && many[^1].EndsWith(" mudanças."), "Summary is limited to 50 lines");
    }

    private static RoadmapDraft Valid() => new(null, null, "Caminho em dados", "Uma trilha para começar em dados", "Uma descrição do caminho de estudo em dados.",
        ["dados"], ["python"], ["pt-BR"], new("beginner", [
            Section("fundamentos", "Fundamentos", [Step("logica"), Step("python") with { Resources = [new("courses", "curso-a")] }, Step("sql") with { Links = [new("Guia de SQL", "https://example.org/sql")] }]),
            Section("pratica", "Prática", [Step("projeto") with { Children = [Sub("coleta"), Sub("limpeza") with { Resources = [new("books", "livro-b")] }] }, Step("portfolio")])]));

    private static RoadmapDraft With(Func<RoadmapData, RoadmapData> change) => Valid() with { Roadmap = change(Valid().Roadmap) };
    private static RoadmapDraft Wrap(RoadmapData roadmap) => Valid() with { Roadmap = roadmap };
    private static RoadmapData Roadmap(RoadmapStepData[] steps) => new("beginner", [Section("bloco-a", "Bloco A", steps), Section("bloco-b", "Bloco B", [Step("b1"), Step("b2"), Step("b3")])]);
    private static RoadmapSectionData Section(string id, string title, RoadmapStepData[] steps) => new(id, title, steps);
    private static RoadmapStepData Step(string id) => new(id, "Etapa " + id, null, "recommended");
    private static RoadmapSubstepData Sub(string id) => new(id, "Subetapa " + id, null, "optional");

    private static void Rejects(string name, RoadmapStepData step, Catalog catalog) => Rejects(name, Roadmap([step]), catalog);
    private static void Rejects(string name, RoadmapData roadmap, Catalog catalog) => Rejects(name, Valid() with { Roadmap = roadmap }, catalog);
    private static void Rejects(string name, RoadmapDraft draft, Catalog catalog)
    {
        try { RoadmapRules.Validate(draft, catalog); }
        catch (ContributionRejectedException error) { Check(!string.IsNullOrWhiteSpace(error.Message), $"Message for {name}"); return; }
        throw new Exception($"Accepted: {name}");
    }
    private static bool Accepts(RoadmapData roadmap, Catalog catalog)
    {
        try { RoadmapRules.Validate(Valid() with { Roadmap = roadmap }, catalog); return true; }
        catch (ContributionRejectedException) { return false; }
    }
    private static void Check(bool passed, string message) { if (!passed) throw new Exception(message); }
}
