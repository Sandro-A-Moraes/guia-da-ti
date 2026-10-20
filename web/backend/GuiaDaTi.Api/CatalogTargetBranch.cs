public static class CatalogTargetBranch
{
    public const string Default = "main";

    public static string ApiRef(string branch) => Uri.EscapeDataString(branch).Replace("%2F", "/", StringComparison.OrdinalIgnoreCase);
}
