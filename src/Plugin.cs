using System;
using System.Collections.Generic;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using MediaBrowser.Model.Drawing;
using System.IO;

namespace MojoSnapPlugin
{
    public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages, IHasThumbImage
    {
        public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
            : base(applicationPaths, xmlSerializer)
        {
            Instance = this;
        }

        public override string Name => "Mojo Snap Console";
        public override Guid Id => Guid.Parse("f6e520d2-9706-44e9-acb5-5fb82bf9c37c");

        public static Plugin Instance { get; private set; }

        public ImageFormat ThumbImageFormat => ImageFormat.Png;

        public Stream GetThumbImage()
        {
            var type = GetType();
            return type.Assembly.GetManifestResourceStream(type.Namespace + ".logo96.png");
        }

        public IEnumerable<PluginPageInfo> GetPages()
        {
            return new[]
            {
                new PluginPageInfo
                {
                    Name = "mojosnapplay",
                    EmbeddedResourcePath = GetType().Namespace + ".Web.play.html",
                    EnableInMainMenu = false
                }
            };
        }
    }

    public class PluginConfiguration : BasePluginConfiguration
    {
        // Settings configuration class
    }
}
