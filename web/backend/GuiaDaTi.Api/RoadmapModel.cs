using System.Text.Json.Serialization;

// Shape of the "roadmap" block in the catalog JSON (see tools/catalog/schemas/resource.schema.json).
public record RoadmapResourceRef(string Type, string Slug);
public record RoadmapLinkData(string Title, string Url);
public record RoadmapSubstepData(string Id, string Title,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Description,
    string Importance,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] RoadmapResourceRef[]? Resources = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] RoadmapLinkData[]? Links = null);
public record RoadmapStepData(string Id, string Title,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Description,
    string Importance,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Choice = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] RoadmapResourceRef[]? Resources = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] RoadmapLinkData[]? Links = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] RoadmapSubstepData[]? Children = null);
public record RoadmapSectionData(string Id, string Title, RoadmapStepData[] Steps);
public record RoadmapData(string Level, RoadmapSectionData[] Sections);

// Body of POST /api/roadmaps/proposals. Slug and BaseSha are set only when editing an existing roadmap.
public record RoadmapDraft(string? Slug, string? BaseSha, string Name, string Summary, string Description,
    string[] Areas, string[] Technologies, string[] Languages, RoadmapData Roadmap,
    string? ImageUrl = null, string? ImageUploadId = null);
