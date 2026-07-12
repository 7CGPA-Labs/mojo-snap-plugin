using System;
using System.Collections.Generic;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace RetroConsolePlugin
{
    public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
    {
        public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
            : base(applicationPaths, xmlSerializer)
        {
            Instance = this;
        }

        public override string Name => "Retro Console";
        public override Guid Id => Guid.Parse("f6e520d2-9706-44e9-acb5-5fb82bf9c37c");

        public static Plugin Instance { get; private set; }

        public IEnumerable<PluginPageInfo> GetPages()
        {
            return new[]
            {
                new PluginPageInfo
                {
                    Name = "retroconsoleplay",
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
