using System.Text.RegularExpressions;

// Mirrors the roadmap rules of the catalog validator (tools/catalog/scripts/validate.mjs).
public static class RoadmapRules
{
    private static readonly string[] Levels = ["beginner", "intermediate", "advanced"];
    private static readonly string[] Importances = ["essential", "recommended", "optional"];
    private static readonly Regex Kebab = new(@"^[a-z0-9]+(?:-[a-z0-9]+)*$");

    public static void Validate(RoadmapDraft draft, Catalog catalog, ContributionImages? images = null)
    {
        if (draft is null || draft.Roadmap is null) throw Reject("Envie o roadmap com nível, blocos e etapas.");
        if (Length(draft.Name) is < 2 or > 100 || Length(draft.Summary) is < 10 or > 240 || Length(draft.Description) is < 10 or > 4000)
            throw Reject("Confira o nome, o resumo e a descrição do roadmap.");
        if (draft.Slug is not null && (draft.Slug.Length > 80 || !Kebab.IsMatch(draft.Slug))) throw Reject("O roadmap que você está editando não foi encontrado.");
        if (draft.Slug is null) SlugFor(draft.Name);
        if (draft.Areas is null || draft.Areas.Length is < 1 or > 15 || draft.Areas.Any(a => a is null || !catalog.Taxonomy.Areas.Contains(a))
            || draft.Technologies is null || draft.Technologies.Length > 20 || draft.Technologies.Any(t => t is null || !catalog.Taxonomy.Technologies.Contains(t))
            || draft.Languages is null || draft.Languages.Length is < 1 or > 15 || draft.Languages.Any(l => l is null || !catalog.Taxonomy.Languages.Contains(l)))
            throw Reject("Escolha assuntos, tecnologias e idiomas disponíveis no guia.");
        if (draft.ImageUrl is not null && draft.ImageUploadId is not null) throw Reject("Envie um arquivo ou um link de imagem.");
        if (draft.ImageUrl is not null && !ContributionService.TryPublicHttps(draft.ImageUrl, out _)) throw Reject("Informe um link público da imagem começando com https://.");
        if (draft.ImageUploadId is { } imageId) {
            if (images is null) throw Reject("Envie um arquivo ou um link de imagem.");
            images.Require(imageId);
        }
        ValidateRoadmap(draft.Roadmap, catalog);
    }

    public static string SlugFor(string name)
    {
        var slug = ContributionService.Slug(name ?? "");
        if (slug.Length is 0 or > 80) throw Reject("Use um nome com letras ou números e até 80 caracteres no endereço.");
        return slug;
    }

    public static ContributionResource ToResource(RoadmapDraft draft, string slug, string updatedAt) => new(slug, "roadmaps",
        draft.Name.Trim(), draft.Summary.Trim(), draft.Description.Trim(), null,
        draft.Areas.Distinct().ToArray(), draft.Technologies.Distinct().ToArray(), draft.Languages.Distinct().ToArray(), updatedAt,
        ImageUrl: draft.ImageUrl, ImageUploadId: draft.ImageUploadId, Roadmap: draft.Roadmap);

    private static void ValidateRoadmap(RoadmapData roadmap, Catalog catalog)
    {
        if (roadmap.Level is null || !Levels.Contains(roadmap.Level)) throw Reject("Escolha o nível do roadmap.");
        if (roadmap.Sections is null || roadmap.Sections.Length is < 2 or > 20 || roadmap.Sections.Any(s => s is null))
            throw Reject("O roadmap precisa de 2 a 20 blocos.");
        var known = catalog.Resources.Select(r => $"{r.Type}/{r.Slug}").ToHashSet();
        var ids = new HashSet<string>();
        var nodes = 0;
        foreach (var section in roadmap.Sections) {
            Id(section.Id, ids);
            Text(section.Title, 2, 80, "O título de cada bloco precisa ter de 2 a 80 caracteres.");
            if (section.Steps is null || section.Steps.Length < 1 || section.Steps.Length > 150 || section.Steps.Any(s => s is null))
                throw Reject($"O bloco “{Short(section.Title)}” precisa de pelo menos uma etapa.");
            foreach (var step in section.Steps) {
                nodes++;
                Id(step.Id, ids);
                Node(step.Title, step.Description, step.Importance, step.Resources, step.Links, known);
                if (step.Choice is not null && (step.Choice.Length > 40 || !Kebab.IsMatch(step.Choice))) throw Reject($"A escolha da etapa “{Short(step.Title)}” é inválida.");
                if (step.Children is null) continue;
                if (step.Children.Length is < 1 or > 12 || step.Children.Any(c => c is null)) throw Reject($"A etapa “{Short(step.Title)}” aceita de 1 a 12 subetapas.");
                foreach (var child in step.Children) {
                    nodes++;
                    Id(child.Id, ids);
                    Node(child.Title, child.Description, child.Importance, child.Resources, child.Links, known);
                }
            }
            Choices(section);
        }
        if (nodes is < 5 or > 150) throw Reject("O roadmap precisa ter de 5 a 150 etapas e subetapas.");
    }

    private static void Node(string? title, string? description, string? importance, RoadmapResourceRef[]? resources, RoadmapLinkData[]? links, HashSet<string> known)
    {
        Text(title, 2, 80, "O título de cada etapa precisa ter de 2 a 80 caracteres.");
        if (description is not null && (description.Length is 0 or > 400 || description.Trim().Length == 0)) throw Reject($"A explicação da etapa “{Short(title)}” precisa ter até 400 caracteres.");
        if (importance is null || !Importances.Contains(importance)) throw Reject($"Escolha a importância da etapa “{Short(title)}”.");
        if (resources is not null) {
            if (resources.Length is < 1 or > 8 || resources.Any(r => r is null || r.Type is null || r.Slug is null)
                || resources.Select(r => $"{r.Type}/{r.Slug}").Distinct().Count() != resources.Length)
                throw Reject($"A etapa “{Short(title)}” aceita de 1 a 8 recursos, sem repetir.");
            foreach (var resource in resources)
                if (!known.Contains($"{resource.Type}/{resource.Slug}"))
                    throw Reject($"O recurso “{Short(resource.Slug)}” da etapa “{Short(title)}” ainda não está no catálogo. Ele pode estar em revisão. O site leva até 1 hora para enxergar recursos novos.");
        }
        if (links is null) return;
        if (links.Length is < 1 or > 3 || links.Any(l => l is null)) throw Reject($"A etapa “{Short(title)}” aceita de 1 a 3 links externos.");
        foreach (var link in links) {
            if (Length(link.Title) < 2 || link.Title.Length > 80) throw Reject("O título de cada link externo precisa ter de 2 a 80 caracteres.");
            if (!ContributionService.TryPublicHttps(link.Url, out _)) throw Reject($"O link “{Short(link.Title)}” precisa ser público e começar com https://.");
        }
    }

    // Steps sharing a choice must be neighbours, in groups of two or more, and not come back later.
    private static void Choices(RoadmapSectionData section)
    {
        var closed = new HashSet<string>();
        string? previous = null;
        var run = 0;
        void Finish() { if (previous is not null && run < 2) throw Reject($"A escolha “{previous}” precisa de pelo menos duas etapas vizinhas."); }
        foreach (var step in section.Steps) {
            if (step.Choice == previous && previous is not null) { run++; continue; }
            Finish();
            if (step.Choice is not null && closed.Contains(step.Choice)) throw Reject($"As etapas da escolha “{step.Choice}” precisam ficar juntas.");
            if (previous is not null) closed.Add(previous);
            previous = step.Choice;
            run = 1;
        }
        Finish();
    }

    private static void Id(string? id, HashSet<string> ids)
    {
        if (id is null || id.Length > 40 || !Kebab.IsMatch(id)) throw Reject("Cada bloco e etapa precisa de um identificador com letras minúsculas, números e hifens.");
        if (!ids.Add(id)) throw Reject($"O identificador “{id}” aparece mais de uma vez no roadmap.");
    }

    private static void Text(string? value, int min, int max, string message)
    {
        if (Length(value) < min || value!.Length > max) throw Reject(message);
    }

    private static int Length(string? value) => value is null ? 0 : value.Trim().Length;
    private static string Short(string? value) => value is null ? "" : value.Length > 40 ? value[..40] + "…" : value;
    private static ContributionRejectedException Reject(string message) => new(message);
}
