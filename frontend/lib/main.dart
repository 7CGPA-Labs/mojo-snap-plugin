import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'gamepad_engine.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Force landscape orientation locks
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  
  // Immersive full-screen mode (hides system/status bars)
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Retro Console Gamepad',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0B0E14),
        fontFamily: 'Courier',
      ),
      home: const GamepadScreen(),
    );
  }
}

class GamepadScreen extends StatefulWidget {
  const GamepadScreen({super.key});

  @override
  State<GamepadScreen> createState() => _GamepadScreenState();
}

class _GamepadScreenState extends State<GamepadScreen> {
  final GamepadEngine _engine = GamepadEngine();
  final TextEditingController _ipController = TextEditingController(text: '192.168.1.');
  final TextEditingController _portController = TextEditingController(text: '3000');
  
  bool _connecting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    // Enable wake lock to prevent device from dimming or sleeping
    WakelockPlus.enable();
  }

  @override
  void dispose() {
    _engine.disconnect();
    _ipController.dispose();
    _portController.dispose();
    super.dispose();
  }

  void _handleConnect() {
    setState(() {
      _connecting = true;
      _errorMessage = null;
    });

    final String ip = _ipController.text.trim();
    final int port = int.tryParse(_portController.text.trim()) ?? 3000;

    _engine.connect(
      ip,
      port,
      onConnect: () {
        setState(() {
          _connecting = false;
        });
      },
      onDisconnect: () {
        setState(() {
          _connecting = false;
        });
      },
      onError: (err) {
        setState(() {
          _connecting = false;
          _errorMessage = "Connection Failed. Check IP/Port.";
        });
      },
    );
  }

  void _handleDisconnect() {
    _engine.disconnect();
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    // If not connected, show the connection setup panel
    if (!_engine.isConnected) {
      return Scaffold(
        body: Center(
          child: Container(
            constraints: const BoxConstraints(maxWidth: 400),
            padding: const EdgeInsets.all(24.0),
            decoration: BoxDecoration(
              color: const Color(0xFF161A22),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF00A8E1), width: 2),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'ARCADE TERMINAL LINK',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Color(0xFF00A8E1),
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 20),
                TextField(
                  controller: _ipController,
                  decoration: const InputDecoration(
                    labelText: 'HOST TV IP ADDRESS',
                    labelStyle: TextStyle(color: Color(0xFF8197A4), fontSize: 11),
                    enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF8197A4))),
                    focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF00A8E1))),
                  ),
                  keyboardType: TextInputType.values[0], // Default text input
                  style: const TextStyle(color: Colors.white, fontSize: 16),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _portController,
                  decoration: const InputDecoration(
                    labelText: 'WEBSOCKET PORT',
                    labelStyle: TextStyle(color: Color(0xFF8197A4), fontSize: 11),
                    enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF8197A4))),
                    focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF00A8E1))),
                  ),
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: Colors.white, fontSize: 16),
                ),
                const SizedBox(height: 24),
                if (_errorMessage != null) ...[
                  Text(
                    _errorMessage!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Color(0xFFFF4A5A), fontSize: 11),
                  ),
                  const SizedBox(height: 12),
                ],
                ElevatedButton(
                  onPressed: _connecting ? null : _handleConnect,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF00A8E1),
                    foregroundColor: const Color(0xFF0B0E14),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                  child: _connecting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0B0E14)),
                        )
                      : const Text('LINK STATION', style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1.5)),
                ),
              ],
            ),
          ),
        ),
      );
    }

    // Main low-latency controller interface
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                // 1. Top Row: Smaller Utility Nodes (MENU, PAUSE, SELECT, START)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 40.0, vertical: 10.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Disconnect helper
                      IconButton(
                        icon: const Icon(Icons.exit_to_app, color: Color(0xFFFF4A5A)),
                        onPressed: _handleDisconnect,
                        tooltip: 'Disconnect Link',
                      ),
                      
                      Row(
                        children: [
                          _buildUtilityButton('MENU', 11, const Color(0xFF00F2FE)),
                          const SizedBox(width: 20),
                          _buildUtilityButton('PAUSE', 12, const Color(0xFFFF4A5A)),
                          const SizedBox(width: 20),
                          _buildUtilityButton('SELECT', 10, const Color(0xFF8197A4)),
                          const SizedBox(width: 20),
                          _buildUtilityButton('START', 9, const Color(0xFF8197A4)),
                        ],
                      ),
                      
                      const SizedBox(width: 48), // Spacer opposite to exit button
                    ],
                  ),
                ),

                Expanded(
                  child: Row(
                    children: [
                      // 2. Left Zone: 4-Way Direction Pad Cross
                      Expanded(
                        child: Center(
                          child: _buildDPadCross(),
                        ),
                      ),

                      // 3. Right Zone: Classic Diamond Face Cluster
                      Expanded(
                        child: Center(
                          child: _buildActionDiamond(),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            
            // Subtle watermark
            Positioned(
              bottom: 8,
              left: 0,
              right: 0,
              child: const Text(
                'MATRIX LINK SYSTEM',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Color(0x1F8197A4),
                  fontSize: 8,
                  letterSpacing: 2,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Raw low-level tactile Listener utility button
  Widget _buildUtilityButton(String label, int code, Color color) {
    return Listener(
      onPointerDown: (_) {
        HapticFeedback.lightImpact();
        _engine.sendButtonAction(code, 1); // 1 = PRESS
      },
      onPointerUp: (_) {
        _engine.sendButtonAction(code, 2); // 2 = RELEASE
      },
      child: Container(
        width: 65,
        height: 36,
        decoration: BoxDecoration(
          color: const Color(0xFF161A22),
          border: Border.all(color: color, width: 1.5),
          borderRadius: BorderRadius.circular(18),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 8,
            fontWeight: FontWeight.bold,
            letterSpacing: 1,
          ),
        ),
      ),
    );
  }

  // D-Pad Cross Layout
  Widget _buildDPadCross() {
    const double size = 65.0;
    return SizedBox(
      width: size * 3,
      height: size * 3,
      child: Stack(
        children: [
          // Center core block
          Align(
            alignment: Alignment.center,
            child: Container(
              width: size,
              height: size,
              color: const Color(0xFF161A22),
            ),
          ),
          // UP Button
          Align(
            alignment: const Alignment(0, -1.0),
            child: _buildDPadButton('▲', 1, const BorderRadius.vertical(top: Radius.circular(8))),
          ),
          // DOWN Button
          Align(
            alignment: const Alignment(0, 1.0),
            child: _buildDPadButton('▼', 2, const BorderRadius.vertical(bottom: Radius.circular(8))),
          ),
          // LEFT Button
          Align(
            alignment: const Alignment(-1.0, 0),
            child: _buildDPadButton('◀', 3, const BorderRadius.horizontal(left: Radius.circular(8))),
          ),
          // RIGHT Button
          Align(
            alignment: const Alignment(1.0, 0),
            child: _buildDPadButton('▶', 4, const BorderRadius.horizontal(right: Radius.circular(8))),
          ),
        ],
      ),
    );
  }

  Widget _buildDPadButton(String label, int code, BorderRadius radius) {
    const double size = 65.0;
    return Listener(
      onPointerDown: (_) {
        HapticFeedback.lightImpact();
        _engine.sendButtonAction(code, 1);
      },
      onPointerUp: (_) {
        _engine.sendButtonAction(code, 2);
      },
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: const Color(0xFF1C222E),
          borderRadius: radius,
          border: Border.all(color: const Color(0xFF2E384D), width: 1),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: const TextStyle(color: Color(0xFF8197A4), fontSize: 18, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  // Diamond Cluster Face Buttons Layout
  Widget _buildActionDiamond() {
    const double spacing = 80.0;
    return SizedBox(
      width: spacing * 2.5,
      height: spacing * 2.5,
      child: Stack(
        children: [
          // Y Button (Top)
          Align(
            alignment: const Alignment(0, -0.95),
            child: _buildActionButton('Y', 8, const Color(0xFF00A8E1)),
          ),
          // X Button (Left)
          Align(
            alignment: const Alignment(-0.95, 0),
            child: _buildActionButton('X', 7, const Color(0xFF00A8E1)),
          ),
          // B Button (Right)
          Align(
            alignment: const Alignment(0.95, 0),
            child: _buildActionButton('B', 6, const Color(0xFFFF4A5A)),
          ),
          // A Button (Bottom)
          Align(
            alignment: const Alignment(0, 0.95),
            child: _buildActionButton('A', 5, const Color(0xFFFF4A5A)),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton(String label, int code, Color color) {
    return Listener(
      onPointerDown: (_) {
        HapticFeedback.lightImpact();
        _engine.sendButtonAction(code, 1);
      },
      onPointerUp: (_) {
        _engine.sendButtonAction(code, 2);
      },
      child: Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: const Color(0xFF161A22),
          border: Border.all(color: color, width: 2),
          boxShadow: [
            BoxShadow(
              color: color.withOpacity(0.15),
              blurRadius: 8,
              spreadRadius: 2,
            )
          ],
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}
