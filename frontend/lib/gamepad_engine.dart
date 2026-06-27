import 'dart:typed_data';
import 'package:web_socket_channel/web_socket_channel.dart';

class GamepadEngine {
  WebSocketChannel? _channel;
  bool _isConnected = false;
  
  // Localized map to track button pressed states and filter duplicates
  final Map<int, bool> _buttonStates = {};

  bool get isConnected => _isConnected;

  // Establishes a persistent connection to the TV proxy server over Wi-Fi
  void connect(String ipAddress, int port, {Function? onConnect, Function? onDisconnect, Function? onError}) {
    disconnect();
    
    final String wsUrl = "ws://$ipAddress:$port";
    print("🔌 Connecting to WebSocket: $wsUrl");
    
    try {
      _channel = WebSocketChannel.connect(Uri.parse(wsUrl));
      _isConnected = true;
      
      if (onConnect != null) onConnect();

      _channel!.stream.listen(
        (message) {
          // TV display only sends configuration states down the line, we can log them
          print("📥 Received from TV: $message");
        },
        onDone: () {
          print("🔌 WebSocket stream closed");
          _isConnected = false;
          if (onDisconnect != null) onDisconnect();
        },
        onError: (error) {
          print("❌ WebSocket Error: $error");
          _isConnected = false;
          if (onError != null) onError(error);
        },
      );
    } catch (e) {
      print("❌ WebSocket connection failed: $e");
      _isConnected = false;
      if (onError != null) onError(e);
    }
  }

  // Closes the active WebSocket channel
  void disconnect() {
    if (_channel != null) {
      _channel!.sink.close();
      _channel = null;
    }
    _isConnected = false;
    _buttonStates.clear();
  }

  // Compresses the input change and transmits a raw 2-Byte binary buffer
  // Byte 0: Action Phase (1 = Down, 2 = Up)
  // Byte 1: Button Code (1-12)
  void sendButtonAction(int buttonCode, int actionPhase) {
    if (!_isConnected || _channel == null) return;
    
    final bool isDown = actionPhase == 1;
    
    // Deduplication check: only transmit if the state has changed
    if (_buttonStates[buttonCode] != isDown) {
      _buttonStates[buttonCode] = isDown;
      
      final Uint8List payload = Uint8List(2);
      payload[0] = actionPhase;
      payload[1] = buttonCode;
      
      _channel!.sink.add(payload);
    }
  }
}
