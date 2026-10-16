using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;

// The browser receives an opaque ID. Visitor credentials remain encrypted on the server.
// A single process owns this store. Deployments must preserve both sessions and the key ring.
public sealed class ServerTickets : ITicketStore
{
    private readonly string folder;
    private readonly IDataProtector protector;
    private readonly TimeProvider clock;
    private readonly object gate = new();

    public static string StoragePath(IConfiguration configuration, IHostEnvironment environment) =>
        Path.GetFullPath(configuration["AUTH_STORAGE_PATH"] ?? Path.Combine(environment.ContentRootPath, "App_Data", "auth"));

    private const UnixFileMode PrivateFile = UnixFileMode.UserRead | UnixFileMode.UserWrite;
    private const UnixFileMode PrivateFolder = PrivateFile | UnixFileMode.UserExecute;
    private static readonly TimeSpan SweepInterval = TimeSpan.FromDays(1);
    private DateTimeOffset lastSweep;

    // CreateDirectory only applies the mode to new folders. Folders from older versions are tightened too.
    internal static DirectoryInfo CreatePrivateDirectory(string path)
    {
        if (OperatingSystem.IsWindows()) return Directory.CreateDirectory(path);
        var folder = Directory.CreateDirectory(path, PrivateFolder);
        // A folder owned by another user cannot be changed. Start only if it is already closed to group and others.
        try { File.SetUnixFileMode(path, PrivateFolder); }
        catch (UnauthorizedAccessException) when ((File.GetUnixFileMode(path) & ~PrivateFolder) == 0) { }
        if ((File.GetUnixFileMode(path) & ~PrivateFolder) != 0)
            throw new InvalidOperationException($"A pasta {path} permite acesso de outros usuários. Ajuste o dono ou a permissão para 700.");
        return folder;
    }

    public ServerTickets(IConfiguration configuration, IHostEnvironment environment, IDataProtectionProvider protection, TimeProvider clock)
    {
        folder = Path.Combine(StoragePath(configuration, environment), "sessions");
        CreatePrivateDirectory(folder);
        protector = protection.CreateProtector("GuiaDaTi.ServerTickets.v1");
        this.clock = clock;
        // No other writer exists yet, so leftover temporary files come from interrupted writes.
        foreach (var temporary in Directory.EnumerateFiles(folder, "*.tmp")) File.Delete(temporary);
        lock (gate) Sweep();
    }

    private string? TicketPath(string key) => key.Length == 64 && key.All(Uri.IsHexDigit)
        ? Path.Combine(folder, key + ".ticket") : null;

    public Task<string> StoreAsync(AuthenticationTicket ticket)
    {
        var key = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        lock (gate) {
            if (clock.GetUtcNow() - lastSweep >= SweepInterval) Sweep();
            Write(TicketPath(key)!, ticket);
        }
        return Task.FromResult(key);
    }

    public Task RenewAsync(string key, AuthenticationTicket ticket)
    {
        lock (gate) {
            // A renewal already in flight must not restore a session removed by logout.
            if (TicketPath(key) is { } path && File.Exists(path)) Write(path, ticket);
        }
        return Task.CompletedTask;
    }

    public Task<AuthenticationTicket?> RetrieveAsync(string key)
    {
        lock (gate) {
            if (clock.GetUtcNow() - lastSweep >= SweepInterval) Sweep();
            var path = TicketPath(key);
            return Task.FromResult(path is null || !File.Exists(path) ? null : ReadValid(path));
        }
    }

    // Returns null and deletes the file when the session expired or cannot be decrypted.
    private AuthenticationTicket? ReadValid(string path)
    {
        AuthenticationTicket? ticket;
        try { ticket = TicketSerializer.Default.Deserialize(protector.Unprotect(File.ReadAllBytes(path))); }
        catch (CryptographicException) { ticket = null; }
        if (ticket?.Properties.ExpiresUtc is { } expires && expires > clock.GetUtcNow()) return ticket;
        File.Delete(path);
        return null;
    }

    // Abandoned sessions are never retrieved again. Removing them limits stored OAuth tokens to active sessions.
    private void Sweep()
    {
        foreach (var path in Directory.EnumerateFiles(folder, "*.ticket").ToArray()) {
            // One unreadable file must not block every other session.
            try { ReadValid(path); }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException) { }
        }
        lastSweep = clock.GetUtcNow();
    }

    public Task RemoveAsync(string key)
    {
        lock (gate) { if (TicketPath(key) is { } path) File.Delete(path); }
        return Task.CompletedTask;
    }

    private void Write(string path, AuthenticationTicket ticket)
    {
        ticket.Properties.ExpiresUtc ??= clock.GetUtcNow().AddDays(7);
        var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try {
            var bytes = protector.Protect(TicketSerializer.Default.Serialize(ticket));
            var options = new FileStreamOptions { Mode = FileMode.CreateNew, Access = FileAccess.Write };
            if (!OperatingSystem.IsWindows()) options.UnixCreateMode = PrivateFile;
            using (var stream = new FileStream(temporary, options)) stream.Write(bytes);
            File.Move(temporary, path, overwrite: true);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
}
