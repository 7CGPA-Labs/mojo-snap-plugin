using System;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using MediaBrowser.Controller.Library;

namespace MojoSnapPlugin.Api
{
    /// <summary>
    /// Provides backend API endpoints for Java ME game content:
    ///  - GET  /MojoSnap/J2me/Meta/{id}  → JSON metadata + resolved JAR info
    ///  - GET  /MojoSnap/J2me/Rom/{id}   → raw JAR/JAD bytes
    ///  - GET  /MojoSnap/J2me/Save/{id}  → per-game save blob
    ///  - POST /MojoSnap/J2me/Save/{id}  → persist save blob to server
    /// </summary>
    [ApiController]
    [Route("MojoSnap/J2me")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public class J2meApiController : ControllerBase
    {
        // ─── Supported Java ME extensions ────────────────────────────────────
        private static readonly string[] JavaExtensions =
            { ".jar", ".jad", ".zip" };

        private readonly ILibraryManager _libraryManager;

        public J2meApiController(ILibraryManager libraryManager)
        {
            _libraryManager = libraryManager;
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET /MojoSnap/J2me/Meta/{id}
        // Returns JSON with the game name, file extension, and JAR stream URL.
        // When the item is a .jad file, the manifest is parsed to resolve the
        // correct MIDlet-Jar-URL and MIDlet-Name entries automatically.
        // ─────────────────────────────────────────────────────────────────────
        [HttpGet("Meta/{id}")]
        public async Task<IActionResult> GetMeta(Guid id)
        {
            var item = _libraryManager.GetItemById(id);
            if (item == null || string.IsNullOrEmpty(item.Path))
                return NotFound(new { error = "Item not found in library." });

            var ext = Path.GetExtension(item.Path).ToLowerInvariant();
            var name = item.Name ?? Path.GetFileNameWithoutExtension(item.Path);

            // Default metadata — always return the ROM stream URL
            var meta = new
            {
                id         = id.ToString(),
                name,
                extension  = ext,
                jarUrl     = $"/MojoSnap/J2me/Rom/{id}",
                isJad      = ext == ".jad",
                midletName = (string?)null,
                midletVendor = (string?)null
            };

            // If it's a .jad manifest, parse it for richer display info
            if (ext == ".jad")
            {
                try
                {
                    var jadText = await System.IO.File.ReadAllTextAsync(item.Path).ConfigureAwait(false);
                    var parsed  = ParseJadManifest(jadText);

                    meta = new
                    {
                        id            = id.ToString(),
                        name          = parsed.TryGetValue("MIDlet-Name", out var mn) ? mn : name,
                        extension     = ext,
                        jarUrl        = $"/MojoSnap/J2me/Rom/{id}",
                        isJad         = true,
                        midletName    = parsed.TryGetValue("MIDlet-Name", out var mn2) ? mn2 : (string?)null,
                        midletVendor  = parsed.TryGetValue("MIDlet-Vendor", out var mv) ? mv : (string?)null
                    };
                }
                catch (Exception ex)
                {
                    // Non-fatal — return defaults
                    Console.Error.WriteLine($"[MojoSnap J2ME] JAD parse error for {id}: {ex.Message}");
                }
            }

            return new JsonResult(meta, new JsonSerializerOptions { WriteIndented = false });
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET /MojoSnap/J2me/Rom/{id}
        // Streams the raw JAR bytes (or the JAR resolved from a .jad manifest).
        // For .jad items the associated .jar is located next to the .jad file.
        // For .zip items the archive is sent as-is (FreeJ2ME supports zip JARs).
        // ─────────────────────────────────────────────────────────────────────
        [HttpGet("Rom/{id}")]
        public async Task<IActionResult> GetRom(Guid id)
        {
            var item = _libraryManager.GetItemById(id);
            if (item == null || string.IsNullOrEmpty(item.Path))
                return NotFound(new { error = "ROM not found in media library." });

            var filePath = item.Path;
            var ext      = Path.GetExtension(filePath).ToLowerInvariant();

            // .jad → resolve the companion .jar next to it
            if (ext == ".jad")
            {
                var resolvedJar = await ResolveJarFromJad(filePath).ConfigureAwait(false);
                if (resolvedJar != null)
                    filePath = resolvedJar;
                // else fall through and stream the .jad itself (CheerpJ can handle it)
            }

            if (!System.IO.File.Exists(filePath))
                return NotFound(new { error = $"File not found on disk: {Path.GetFileName(filePath)}" });

            var mimeType = ext == ".jar" || ext == ".jad" || ext == ".zip"
                ? "application/java-archive"
                : "application/octet-stream";

            var stream   = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, useAsync: true);
            return File(stream, mimeType, Path.GetFileName(filePath));
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET /MojoSnap/J2me/Save/{id}
        // Returns the persisted RMS save blob for the given item.
        // Returns an empty 200 response if no save exists yet.
        // ─────────────────────────────────────────────────────────────────────
        [HttpGet("Save/{id}")]
        public IActionResult GetSave(Guid id)
        {
            var savePath = GetSavePath(id);

            if (!System.IO.File.Exists(savePath))
                return Ok(Array.Empty<byte>());

            var data = System.IO.File.ReadAllBytes(savePath);
            return File(data, "application/octet-stream");
        }

        // ─────────────────────────────────────────────────────────────────────
        // POST /MojoSnap/J2me/Save/{id}
        // Accepts raw binary save data and persists it to the plugin data dir.
        // Limited to 4 MB per upload to prevent abuse.
        // ─────────────────────────────────────────────────────────────────────
        [HttpPost("Save/{id}")]
        [RequestSizeLimit(4_194_304)] // 4 MB
        public async Task<IActionResult> PostSave(Guid id)
        {
            var savePath = GetSavePath(id);

            // Ensure the save directory exists
            var saveDir = Path.GetDirectoryName(savePath)!;
            if (!Directory.Exists(saveDir))
                Directory.CreateDirectory(saveDir);

            using var fs = new FileStream(savePath, FileMode.Create, FileAccess.Write, FileShare.None, 4096, useAsync: true);
            await Request.Body.CopyToAsync(fs).ConfigureAwait(false);

            return Ok(new { saved = true, id = id.ToString() });
        }

        // ─────────────────────────────────────────────────────────────────────
        // PRIVATE HELPERS
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Resolves the companion .jar path for a .jad manifest.
        /// Checks:
        ///   1. MIDlet-Jar-URL value relative to the .jad's directory
        ///   2. Same filename with .jar extension
        /// </summary>
        private static async Task<string?> ResolveJarFromJad(string jadPath)
        {
            try
            {
                var jadDir  = Path.GetDirectoryName(jadPath) ?? string.Empty;
                var jadText = await System.IO.File.ReadAllTextAsync(jadPath).ConfigureAwait(false);
                var props   = ParseJadManifest(jadText);

                // 1. MIDlet-Jar-URL attribute (may be relative or absolute)
                if (props.TryGetValue("MIDlet-Jar-URL", out var jarUrl) && !string.IsNullOrWhiteSpace(jarUrl))
                {
                    // Only handle local relative references (ignore http:// URLs)
                    if (!jarUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                    {
                        var resolved = Path.GetFullPath(Path.Combine(jadDir, jarUrl));
                        if (System.IO.File.Exists(resolved))
                            return resolved;
                    }
                }

                // 2. Sibling .jar with the same name
                var siblingJar = Path.ChangeExtension(jadPath, ".jar");
                if (System.IO.File.Exists(siblingJar))
                    return siblingJar;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[MojoSnap J2ME] ResolveJarFromJad failed: {ex.Message}");
            }

            return null;
        }

        /// <summary>
        /// Parses a simple key: value JAD/MANIFEST.MF style property file.
        /// </summary>
        private static System.Collections.Generic.Dictionary<string, string> ParseJadManifest(string text)
        {
            var result = new System.Collections.Generic.Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            // JAD files use CRLF or LF line endings; fold continuation lines (starting with space)
            var lines = text.Replace("\r\n", "\n").Replace("\r", "\n").Split('\n');

            string? currentKey   = null;
            var     currentValue = new StringBuilder();

            void flush()
            {
                if (currentKey != null)
                    result[currentKey] = currentValue.ToString().Trim();
            }

            foreach (var raw in lines)
            {
                if (string.IsNullOrEmpty(raw))
                {
                    flush();
                    currentKey = null;
                    currentValue.Clear();
                    continue;
                }

                // Continuation line (RFC 2822 folding)
                if (raw[0] == ' ' || raw[0] == '\t')
                {
                    currentValue.Append(raw.TrimStart());
                    continue;
                }

                flush();
                currentKey = null;
                currentValue.Clear();

                var colonIdx = raw.IndexOf(':');
                if (colonIdx > 0)
                {
                    currentKey = raw[..colonIdx].Trim();
                    currentValue.Append(raw[(colonIdx + 1)..].TrimStart());
                }
            }

            flush();
            return result;
        }

        /// <summary>Returns the filesystem path for the save blob of the given item ID.</summary>
        private static string GetSavePath(Guid id)
        {
            var configPath = Plugin.Instance?.ConfigurationFilePath;
            var pluginDir = !string.IsNullOrEmpty(configPath) ? Path.GetDirectoryName(configPath) : null;
            if (string.IsNullOrEmpty(pluginDir))
            {
                pluginDir = Directory.GetCurrentDirectory();
            }
            var saveDir   = Path.Combine(pluginDir, "j2me-saves");
            return Path.Combine(saveDir, $"{id}.rms");
        }
    }
}
