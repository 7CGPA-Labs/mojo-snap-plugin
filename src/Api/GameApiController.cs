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

            var fileStream = new FileStream(item.Path, FileMode.Open, FileAccess.Read, FileShare.Read);
            return File(fileStream, "application/octet-stream", Path.GetFileName(item.Path));
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
