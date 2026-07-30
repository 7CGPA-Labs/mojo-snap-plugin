using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using MediaBrowser.Controller.Library;

namespace MojoSnapPlugin.Api
{
    [ApiController]
    [Route("MojoSnap")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public class GameApiController : ControllerBase
    {
        private readonly ILibraryManager _libraryManager;

        public GameApiController(ILibraryManager libraryManager)
        {
            _libraryManager = libraryManager;
        }

        [HttpGet("Rom/{id}")]
        public IActionResult GetRomStream(Guid id)
        {
            var item = _libraryManager.GetItemById(id);
            if (item == null || string.IsNullOrEmpty(item.Path))
            {
                return NotFound("Game ROM not found in media library.");
            }

            // Update the running VirtualControllerService so the mDNS 'core' field
            // and the core_loaded message sent to joining controllers stays current.
            var coreService = Plugin.Instance?.ControllerService;
            if (coreService != null)
            {
                coreService.CurrentCore = ExtensionToCore(item.Path);
            }

            var fileStream = new FileStream(item.Path, FileMode.Open, FileAccess.Read, FileShare.Read);
            return File(fileStream, "application/octet-stream", Path.GetFileName(item.Path));
        }

        /// <summary>
        /// Maps a ROM file extension to a libretro core name (same mapping used by the Desktop CoreManager).
        /// Falls back to "unknown" for unrecognised extensions.
        /// </summary>
        private static string ExtensionToCore(string filePath)
        {
            string ext = Path.GetExtension(filePath).ToLowerInvariant();
            return ext switch
            {
                ".nes"                          => "fceumm",
                ".smc" or ".sfc"               => "snes9x",
                ".md"  or ".sms" or ".gg"      => "genesis_plus_gx",
                ".gb"  or ".gbc"               => "gambatte",
                ".gba"                          => "mgba",
                ".cue" or ".iso" or ".img"     => "pcsx_rearmed",
                ".jar" or ".jad"               => "freej2me",
                _                              => "unknown"
            };
        }

        [HttpGet("Save/{id}")]
        public IActionResult GetSaveState(Guid id)
        {
            var pluginDir = Path.GetDirectoryName(Plugin.Instance.ConfigurationFilePath);
            var savePath = Path.Combine(pluginDir, $"{id}.srm");
            
            if (!System.IO.File.Exists(savePath))
            {
                return Ok(Array.Empty<byte>());
            }

            var data = System.IO.File.ReadAllBytes(savePath);
            return File(data, "application/octet-stream");
        }

        [HttpPost("Save/{id}")]
        [RequestSizeLimit(10_485_760)] // 10 MB limit for save states
        public async Task<IActionResult> PostSaveState(Guid id)
        {
            var pluginDir = Path.GetDirectoryName(Plugin.Instance.ConfigurationFilePath);
            var savePath = Path.Combine(pluginDir, $"{id}.srm");

            using (var fs = new FileStream(savePath, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                await Request.Body.CopyToAsync(fs);
            }

            return Ok();
        }
    }
}
