using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Text.RegularExpressions;
using Fleck;
using Makaretu.Dns;

namespace MojoSnapPlugin
{
    /// <summary>
    /// WebSocket relay + mDNS advertiser for the Jellyfin Plugin host.
    ///
    /// Binary payload protocol (SHARED_INPUT_PROTOCOL.md §5):
    ///   [0] playerIndex : 1 or 2
    ///   [1] actionPhase : 1=BUTTON_DOWN  2=BUTTON_UP  3=ANALOG
    ///   [2] inputId     : RETRO_DEVICE_ID_JOYPAD_* (0–15); 16=MOJO_VIRTUAL_MENU (blocked)
    ///
    /// Text (JSON) messages are relayed bidirectionally:
    ///   display  → controllers : {"event":"core_loaded","core":"..."}
    ///   controller → display   : {"event":"menu_toggle","player":N}
    ///
    /// WebSocket paths:
    ///   /display              — Jellyfin web player (retroarch WASM)
    ///   /controller?player=N  — mobile client (retro-mesh-console app)
    /// </summary>
    public class VirtualControllerService : IDisposable
    {
        // MOJO_VIRTUAL_MENU = 16 — app-internal, never forwarded to the emulator
        private const byte MOJO_VIRTUAL_MENU = 16;

        private WebSocketServer _server;
        private MulticastService _mdns;
        private ServiceDiscovery _discovery;

        private readonly object _socketsLock = new object();
        private readonly List<IWebSocketConnection> _displays      = new List<IWebSocketConnection>();
        private readonly List<IWebSocketConnection> _p1Controllers = new List<IWebSocketConnection>();
        private readonly List<IWebSocketConnection> _p2Controllers = new List<IWebSocketConnection>();
        private readonly Dictionary<IWebSocketConnection, bool> _socketAuthState = new Dictionary<IWebSocketConnection, bool>();

        private readonly string _pairingPin;

        public VirtualControllerService()
        {
            _pairingPin = new Random().Next(100000, 1000000).ToString("D6");
        }

        /// <summary>Name of the currently loaded core, advertised via mDNS.</summary>
        public string CurrentCore { get; set; } = "unknown";

        /// <summary>Server-side button state — indexed by RETRO_DEVICE_ID_JOYPAD_* (0–15).</summary>
        public bool[] VirtualP1Buttons { get; } = new bool[16];
        public bool[] VirtualP2Buttons { get; } = new bool[16];

        public void Start(int port = 55443)
        {
            // ── WebSocket Server ────────────────────────────────────────────────────
            _server = new WebSocketServer($"ws://0.0.0.0:{port}");
            _server.Start(socket =>
            {
                socket.OnOpen = () =>
                {
                    var path = socket.ConnectionInfo.Path;
                    lock (_socketsLock)
                    {
                        if (path.Contains("/display"))
                        {
                            _displays.Add(socket);
                            socket.Send($"{{\"event\":\"pairing_pin\",\"pin\":\"{_pairingPin}\"}}");
                        }
                        else if (path.Contains("/controller"))
                        {
                            _socketAuthState[socket] = false;
                            socket.Send("{\"event\":\"pin_challenge\"}");
                        }
                    }
                };

                socket.OnClose = () =>
                {
                    lock (_socketsLock)
                    {
                        _displays.Remove(socket);
                        _p1Controllers.Remove(socket);
                        _p2Controllers.Remove(socket);
                        _socketAuthState.Remove(socket);
                    }
                };

                // Binary: controller → display (button/analog inputs)
                socket.OnBinary = (data) =>
                {
                    if (data == null || data.Length < 3) return;

                    byte playerIdx   = data[0];
                    byte actionPhase = data[1];
                    byte inputId     = data[2];

                    // Block MOJO_VIRTUAL_MENU (ID 16) — never reaches the emulator
                    if (inputId == MOJO_VIRTUAL_MENU) return;

                    lock (_socketsLock)
                    {
                        if (!_socketAuthState.TryGetValue(socket, out bool authenticated) || !authenticated)
                            return;
                    }

                    // Update server-side state
                    if ((actionPhase == 1 || actionPhase == 2) && inputId < 16)
                    {
                        bool isDown = actionPhase == 1;
                        if (playerIdx == 1) VirtualP1Buttons[inputId] = isDown;
                        else if (playerIdx == 2) VirtualP2Buttons[inputId] = isDown;
                    }

                    // Relay to all display clients
                    lock (_socketsLock)
                    {
                        foreach (var display in _displays)
                            display.Send(data);
                    }
                };

                // Text (JSON): bidirectional relay
                socket.OnMessage = (message) =>
                {
                    lock (_socketsLock)
                    {
                        if (_displays.Contains(socket))
                        {
                            // Display → all controllers
                            foreach (var ctrl in _p1Controllers) ctrl.Send(message);
                            foreach (var ctrl in _p2Controllers) ctrl.Send(message);
                        }
                        else
                        {
                            // Controller message check PIN
                            if (message.Contains("\"event\":\"pin_auth\"") || message.Contains("\"event\": \"pin_auth\""))
                            {
                                var match = Regex.Match(message, "\"pin\"\\s*:\\s*\"([^\"]+)\"");
                                if (match.Success)
                                {
                                    string clientPin = match.Groups[1].Value;
                                    if (clientPin == _pairingPin)
                                    {
                                        _socketAuthState[socket] = true;
                                        socket.Send("{\"event\":\"pin_success\"}");

                                        // Parse ?player=1 or ?player=2
                                        var path = socket.ConnectionInfo.Path;
                                        int slot = 2;
                                        var qIdx = path.IndexOf("player=", StringComparison.OrdinalIgnoreCase);
                                        if (qIdx >= 0 && qIdx + 7 < path.Length)
                                        {
                                            _ = int.TryParse(path.Substring(qIdx + 7, 1), out slot);
                                            slot = Math.Clamp(slot, 1, 2);
                                        }

                                        if (slot == 1) _p1Controllers.Add(socket);
                                        else           _p2Controllers.Add(socket);

                                        // Immediately tell the joining client which core is running
                                        socket.Send($"{{\"event\":\"core_loaded\",\"core\":\"{CurrentCore}\"}}");
                                    }
                                    else
                                    {
                                        socket.Send("{\"event\":\"pin_fail\",\"reason\":\"Incorrect PIN\"}");
                                        socket.Close();
                                    }
                                }
                                return;
                            }

                            // Relay if authenticated
                            if (_socketAuthState.TryGetValue(socket, out bool auth) && auth)
                            {
                                foreach (var display in _displays)
                                    display.Send(message);
                            }
                        }
                    }
                };
            });

            // ── mDNS Responder ──────────────────────────────────────────────────────
            _mdns      = new MulticastService();
            _discovery = new ServiceDiscovery(_mdns);

            var profile = new ServiceProfile(Environment.MachineName, "_retroconsole._tcp", (ushort)port);
            profile.AddProperty("port",       port.ToString());
            profile.AddProperty("serverName", "Mojo Snap TV");
            profile.AddProperty("hostType",   "webos");
            profile.AddProperty("core",       CurrentCore);

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
