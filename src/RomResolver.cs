using System;
using System.IO;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Resolvers;

namespace MojoSnapPlugin
{
    public class RomResolver : IItemResolver
    {
        // High priority so it catches the files before default resolvers ignore them
        public ResolverPriority Priority => ResolverPriority.First;

        public BaseItem ResolvePath(ItemResolveArgs args)
        {
            if (args.IsDirectory)
            {
                return null;
            }

            var extension = Path.GetExtension(args.Path)?.ToLowerInvariant();

            if (extension == ".nes" || 
                extension == ".sfc" || 
                extension == ".smc" || 
                extension == ".md" || 
                extension == ".sms" || 
                extension == ".gg" || 
                extension == ".bin" || 
                extension == ".gb" || 
                extension == ".gbc" || 
                extension == ".gba")
            {
                return new Video
                {
                    Path = args.Path,
                    Name = Path.GetFileNameWithoutExtension(args.Path)
                };
            }

            return null;
        }
    }
}
