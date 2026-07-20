using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Fleck;
using Makaretu.Dns;

namespace MojoSnapPlugin
{
    public class VirtualControllerService : IDisposable
    {
        private WebSocketServer _server;
        private MulticastService _mdns;
        private ServiceDiscovery _discovery;
        private List<IWebSocketConnection> _displays = new List<IWebSocketConnection>();
        private List<IWebSocketConnection> _controllers = new List<IWebSocketConnection>();

        public void Start(int port = 55443)
        {
            // Start WebSocket Server
            _server = new WebSocketServer($"ws://0.0.0.0:{port}");
            _server.Start(socket =>
            {
                socket.OnOpen = () =>
                {
                    if (socket.ConnectionInfo.Path.Contains("/display"))
                        _displays.Add(socket);
                    else if (socket.ConnectionInfo.Path.Contains("/controller"))
                        _controllers.Add(socket);
                };

                socket.OnClose = () =>
                {
                    _displays.Remove(socket);
                    _controllers.Remove(socket);
                };

                socket.OnBinary = (data) =>
                {
                    if (_controllers.Contains(socket))
                    {
                        foreach (var display in _displays)
                        {
                            display.Send(data);
                        }
                    }
                };
            });

            // Start mDNS Responder
            _mdns = new MulticastService();
            _discovery = new ServiceDiscovery(_mdns);
            
            var profile = new ServiceProfile(Environment.MachineName, "_retroconsole._tcp", (ushort)port);
            profile.AddProperty("serverName", "Mojo Snap TV");
            profile.AddProperty("hostType", "webos");
            
            _discovery.Advertise(profile);
            _mdns.Start();
        }

        public void Dispose()
        {
            _mdns?.Stop();
            _mdns?.Dispose();
            _server?.Dispose();
        }
    }
}
