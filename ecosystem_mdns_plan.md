# Cross-Platform mDNS Virtual Controller Ecosystem Plan

This document finalizes the networking architecture for allowing the **Android/iOS mobile app (retro-mesh-console)** to act as a seamless, zero-configuration virtual controller for any device in the ecosystem, including Desktop PCs and WebOS Smart TVs.

---

## 1. The Ecosystem Players

1.  **retro-mesh-console (Android/iOS)**: 
    *   **Role:** The universal Virtual Controller (Client) OR a mobile Host.
    *   **Responsibility:** Scans the local network for mDNS broadcasters. When a host is selected, it connects via WebSocket to send low-latency binary control signals.
2.  **mojo-snap-desktop (Windows/macOS/Linux)**:
    *   **Role:** Desktop Host Player.
    *   **Responsibility:** Broadcasts its presence over mDNS. Runs a local WebSocket server to receive inputs from the mobile controller.
3.  **webos-retro-console (LG WebOS / Emby C# Plugin)**:
    *   **Role:** TV Host Player.
    *   **Responsibility:** Broadcasts its presence via a zero-dependency C# mDNS responder. Runs a WebSocket server in the backend plugin to inject decoded inputs into the TV's browser context.

---

## 2. mDNS Discovery Protocol (Standardization)

To ensure the mobile app can discover *any* of the ecosystem hosts (Mobile, Desktop, or TV), all hosts must adhere to the exact same ZeroConf/mDNS specification.

*   **Service Type:** `_retroconsole._tcp`
*   **Domain:** `local.`
*   **TXT Records Required:**
    *   `port=[WebSocket Port]` (e.g., `port=8080`)
    *   `serverName=[Friendly Name]` (e.g., `serverName=Living Room TV` or `serverName=Gagan's PC`)
    *   `hostType=[mobile|desktop|webos]` (Helps the Flutter app show the correct icon)

### Mobile App (Client) Flow:
1. User opens the Flutter app and taps "Join Game".
2. The app uses the `nsd` (Network Service Discovery) Dart package to listen for `_retroconsole._tcp`.
3. Displays a list of available hosts (`serverName`).
4. User taps a host -> App connects via `ws://[Host_IP]:[port]/controller`.

---

## 3. Low-Latency Binary Protocol (Dual TCP/UDP)

Sending text-based JSON over WebSockets introduces unnecessary overhead and parsing latency. All 3 platforms will implement the following ultra-fast binary payload for input syncing, utilizing a dual TCP/UDP architecture (UDP for ultra-fast local LAN inputs, TCP WebSocket for WAN fallback):

### Packet Structure (3-5 Bytes per payload):
*   **Byte 0: Player Index**
    *   `1` = Player 1
    *   `2` = Player 2
*   **Byte 1: Action Phase**
    *   `1` = BUTTON_DOWN
    *   `2` = BUTTON_UP
    *   `3` = PHYSICAL_CONTROLLER_SYNC (Bluetooth/2.4G Controllers)
*   **Byte 2: Input ID**
    *   For Buttons: `1` to `15` (matching the standardized `RETRO_DEVICE_ID_JOYPAD_*` mapping).
    *   For Axis: `0` (Left X), `1` (Left Y), `2` (Right X), `3` (Right Y)
*   **Bytes 3-4 (Optional - Only for PHYSICAL_CONTROLLER_SYNC):**
    *   16-bit signed integer representing the Bluetooth/2.4G controller axis or trigger values.

---

## 4. Platform-Specific Implementation Tasks

### A. retro-mesh-console (Flutter)
*   **Task:** Upgrade the existing WebSocket client in `native_bridge.dart` to encode button presses into the 3-byte binary payload instead of JSON strings.
*   **Task:** Ensure the mDNS scanner correctly parses the new `hostType` TXT record for UI improvements.

### B. mojo-snap-desktop (Desktop)
*   **Task:** Implement `Bonjour/Avahi` mDNS broadcasting on app startup.
*   **Task:** Start a local WebSocket server (using a library like `ws` or `Flet/Python` depending on stack) that decodes the 3-byte binary payloads and maps them to the desktop emulator core.

### C. webos-retro-console (C# Media Server Plugin)
*   **Task:** Integrate a lightweight C# mDNS responder (e.g., `Makaretu.Dns`) in the Jellyfin/Emby backend plugin.
*   **Task:** Set up a `ClientWebSocket` listener on a dedicated port.
*   **Task:** Pass the decoded binary signals from the C# backend to the front-end JavaScript Emscripten loop via `window.Module.retroArchSend()`.

---

## 5. Security & Pairing
To prevent unauthorized users on a public Wi-Fi network from hijacking the TV or Desktop console:
*   Add a 4-digit PIN challenge in the WebSocket handshake.
*   The Host displays a 4-digit PIN on the screen.
*   The Mobile app prompts for the PIN before upgrading to the binary controller protocol.

