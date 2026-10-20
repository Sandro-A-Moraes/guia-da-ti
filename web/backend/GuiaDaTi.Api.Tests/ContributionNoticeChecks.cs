public static class ContributionNoticeChecks
{
    public static void Run()
    {
        var clock = new NoticeClock();
        var notices = new ContributionNotifications(clock);
        var baseline = notices.Read(null, null);
        var draft = new ContributionDraft("universities", " Faculdade de teste ", "https://example.org", "Resumo de teste", "Descrição de teste", ["educacao"], [], ["pt-BR"], UniversityType: "public");
        var notice = notices.Publish("ana", draft, new("https://github.com/example/data/pull/12"));
        var page = notices.Read(baseline.Stream, baseline.Cursor);
        Check(page.Items.Length == 1 && page.Items[0] == notice, "Existing visitors receive the confirmed submission");
        Check(notice.Login == "ana" && notice.Name == "Faculdade de teste" && notice.Category == "universities" && notice.Url.EndsWith("/pull/12"), "Notice describes author, item, category and PR link");
        Check(notices.Read(page.Stream, page.Cursor).Items.Length == 0, "Cursor prevents repeated notices");
        Check(notices.Read(null, null).Items.Length == 0, "New visitors do not replay old submissions");
        clock.Now = clock.Now.AddMinutes(3);
        Check(notices.Read(baseline.Stream, 0).Items.Length == 0, "Inactive visitors do not replay stale notices");
        for (var i = 0; i < 120; i++) notices.Publish("ana", draft, new("https://github.com/example/data/pull/12"));
        Check(notices.Read(baseline.Stream, 0).Items.Length == 100, "Live history is bounded");
        Check(new ContributionNotifications(clock).Read(baseline.Stream, page.Cursor).Items.Length == 0, "Server restart establishes a new baseline");
        Console.WriteLine("Contribution notices OK: confirmed submissions, review links, cursors, fresh visitors, expiry and bounded history.");
    }
    private static void Check(bool condition, string name) { if (!condition) throw new Exception(name); }
    private sealed class NoticeClock : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = new(2026, 10, 7, 12, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Now;
    }
}
