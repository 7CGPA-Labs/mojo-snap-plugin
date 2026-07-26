# Mojo Snap — Shared Input Protocol Definition
> **Single Source of Truth** for all button IDs, keyboard bindings, Bluetooth/2.4G mappings, and system hotkeys across:
> - `retro-mesh-console` (Flutter — Android/iOS Host & Client gamepad)
> - `mojo-snap-desktop` (C# — Windows/Linux Host)
> - `mojo-snap-plugin` (C# — Jellyfin Plugin Host)

---

## 1. RetroPad Button IDs (`RETRO_DEVICE_ID_JOYPAD_*`)

These are the **exact integer IDs** used in all WebSocket packets, native FFI calls, and input state arrays.
Every component MUST use these IDs. Do **NOT** use any other numbering scheme.

| ID | Macro Name                        | RetroPad Position        | Xbox Equivalent | PS Equivalent |
|----|-----------------------------------|--------------------------|-----------------|---------------|
|  0 | `RETRO_DEVICE_ID_JOYPAD_B`        | Bottom Face Button       | A               | Cross (✕)     |
|  1 | `RETRO_DEVICE_ID_JOYPAD_Y`        | Left Face Button         | X               | Square (□)    |
|  2 | `RETRO_DEVICE_ID_JOYPAD_SELECT`   | Select / Back / Share    | View            | Share         |
|  3 | `RETRO_DEVICE_ID_JOYPAD_START`    | Start / Options          | Menu            | Options       |
|  4 | `RETRO_DEVICE_ID_JOYPAD_UP`       | D-Pad Up                 | D-Pad Up        | D-Pad Up      |
|  5 | `RETRO_DEVICE_ID_JOYPAD_DOWN`     | D-Pad Down               | D-Pad Down      | D-Pad Down    |
|  6 | `RETRO_DEVICE_ID_JOYPAD_LEFT`     | D-Pad Left               | D-Pad Left      | D-Pad Left    |
|  7 | `RETRO_DEVICE_ID_JOYPAD_RIGHT`    | D-Pad Right              | D-Pad Right     | D-Pad Right   |
|  8 | `RETRO_DEVICE_ID_JOYPAD_A`        | Right Face Button        | B               | Circle (○)    |
|  9 | `RETRO_DEVICE_ID_JOYPAD_X`        | Top Face Button          | Y               | Triangle (△)  |
| 10 | `RETRO_DEVICE_ID_JOYPAD_L`        | Left Shoulder Bumper     | LB              | L1            |
| 11 | `RETRO_DEVICE_ID_JOYPAD_R`        | Right Shoulder Bumper    | RB              | R1            |
| 12 | `RETRO_DEVICE_ID_JOYPAD_L2`       | Left Trigger             | LT              | L2            |
| 13 | `RETRO_DEVICE_ID_JOYPAD_R2`       | Right Trigger            | RT              | R2            |
| 14 | `RETRO_DEVICE_ID_JOYPAD_L3`       | Left Stick Click         | LS              | L3            |
| 15 | `RETRO_DEVICE_ID_JOYPAD_R3`       | Right Stick Click        | RS              | R3            |
| 16 | *(ecosystem reserved)*            | MENU (in-app only)       | —               | —             |

> **ID 16 (MENU)** is a virtual button for the app's in-game overlay. It is NOT forwarded to the libretro core.

---

## 2. Analog Stick IDs (`RETRO_DEVICE_ANALOG_*`)

WebSocket analog packet: `{ "type": "analog", "index": <stickIndex>, "axisId": <axisId>, "value": <int16> }`

| Stick Index | Macro                              | Value |
|-------------|------------------------------------|-------|
| 0           | `RETRO_DEVICE_INDEX_ANALOG_LEFT`   | `0`   |
| 1           | `RETRO_DEVICE_INDEX_ANALOG_RIGHT`  | `1`   |

| Axis ID | Macro                     | Range                           |
|---------|---------------------------|---------------------------------|
| 0       | `RETRO_DEVICE_ID_ANALOG_X`| -32767 (Left)  → +32767 (Right) |
| 1       | `RETRO_DEVICE_ID_ANALOG_Y`| -32767 (Up)    → +32767 (Down)  |

---

## 3. Universal Keyboard Bindings (retroarch.cfg Standard)

Applies to the **Flutter app** (attached hardware keyboard), **desktop frontend** Player 1, and any keyboard-as-controller usage.

| RetroPad Button                  | ID | Default Key    |
|----------------------------------|----|----------------|
| Button B (Bottom / Primary)      |  0 | `Z`            |
| Button Y (Left)                  |  1 | `A`            |
| Select                           |  2 | `Right Shift`  |
| Start                            |  3 | `Enter`        |
| D-Pad Up                         |  4 | `Arrow Up`     |
| D-Pad Down                       |  5 | `Arrow Down`   |
| D-Pad Left                       |  6 | `Arrow Left`   |
| D-Pad Right                      |  7 | `Arrow Right`  |
| Button A (Right / Cancel)        |  8 | `X`            |
| Button X (Top)                   |  9 | `S`            |
| L Shoulder (L1)                  | 10 | `Q`            |
| R Shoulder (R1)                  | 11 | `W`            |
| L2 Trigger                       | 12 | `E`            |
| R2 Trigger                       | 13 | `R`            |
| L3 (Stick Click)                 | 14 | *(unassigned)* |
| R3 (Stick Click)                 | 15 | *(unassigned)* |

### Desktop Player 2 Keyboard Defaults (mojo-snap-desktop only)

| RetroPad Button | ID | Key     |
|-----------------|----|---------|
| B               |  0 | `C`     |
| Y               |  1 | `F`     |
| Select          |  2 | `Tab`   |
| Start           |  3 | `Space` |
| D-Pad Up        |  4 | `I`     |
| D-Pad Down      |  5 | `K`     |
| D-Pad Left      |  6 | `J`     |
| D-Pad Right     |  7 | `L`     |
| A               |  8 | `V`     |
| X               |  9 | `G`     |
| L1              | 10 | `U`     |
| R1              | 11 | `O`     |

---

## 4. System Hotkeys (Desktop Frontend — mojo-snap-desktop)

Handled by `PlayerOverlay.cs`. NOT forwarded to the libretro core.

| Action                       | Default Key      |
|------------------------------|------------------|
| Toggle Menu (RGUI)           | `F1`             |
| Quit / Close ROM             | `Escape`         |
| Save State                   | `F2`             |
| Load State                   | `F4`             |
| State Slot Decrease          | `F6`             |
| State Slot Increase          | `F7`             |
| Toggle Fullscreen            | `F`              |
| Pause / Unpause              | `P`              |
| Frame Advance (while paused) | `K`              |
| Fast Forward Toggle          | `Space`          |
| Rewind                       | `Backspace`      |
| Take Screenshot              | `F8`             |

---

## 5. WebSocket Packet Format (mojo-snap-plugin / NativeBridge)

```json
// Button event
{ "type": "btn", "id": 0, "pressed": true }

// Analog event
{ "type": "analog", "index": 0, "axisId": 0, "value": -16384 }
```

- `"type"`: `"btn"` or `"analog"`
- `"id"`: `RETRO_DEVICE_ID_JOYPAD_*` (0–15). ID 16 = MENU (app-internal, never sent over network)
- `"pressed"`: `true` / `false`
- `"index"`: stick index (0=left, 1=right)
- `"axisId"`: axis (0=X, 1=Y)
- `"value"`: Int16 range -32767 to +32767

---

## 6. Physical Bluetooth/2.4G Mapping (Positional, not by label)

All physical controllers are mapped **positionally**. The same libretro ID is assigned regardless of Xbox/PlayStation/Switch branding.

| Libretro ID | Physical Position    | XInput       | PS Button    | Raylib `GamepadButton` enum |
|-------------|----------------------|--------------|--------------|-----------------------------|
| 0  (B)      | Bottom face          | A            | Cross (✕)    | `RightFaceDown`             |
| 1  (Y)      | Left face            | X            | Square (□)   | `RightFaceLeft`             |
| 2  (Select) | Center-left          | View/Back    | Share        | `MiddleLeft`                |
| 3  (Start)  | Center-right         | Menu/Start   | Options      | `MiddleRight`               |
| 4  (Up)     | D-Pad Up             | D-Up         | D-Up         | `LeftFaceUp`                |
| 5  (Down)   | D-Pad Down           | D-Down       | D-Down       | `LeftFaceDown`              |
| 6  (Left)   | D-Pad Left           | D-Left       | D-Left       | `LeftFaceLeft`              |
| 7  (Right)  | D-Pad Right          | D-Right      | D-Right      | `LeftFaceRight`             |
| 8  (A)      | Right face           | B            | Circle (○)   | `RightFaceRight`            |
| 9  (X)      | Top face             | Y            | Triangle (△) | `RightFaceUp`               |
| 10 (L1)     | Left shoulder bump   | LB           | L1           | `LeftTrigger1`              |
| 11 (R1)     | Right shoulder bump  | RB           | R1           | `RightTrigger1`             |
| 12 (L2)     | Left trigger         | LT           | L2           | `LeftTrigger2`              |
| 13 (R2)     | Right trigger        | RT           | R2           | `RightTrigger2`             |
| 14 (L3)     | Left stick click     | LS           | L3           | `LeftThumb`                 |
| 15 (R3)     | Right stick click    | RS           | R3           | `RightThumb`                |

---

## 7. Console-Specific Virtual Button Layout

The button widgets in `gamepad_deck.dart` send the RetroPad IDs below directly.

### NES
| Visual Label | Libretro ID |
|--------------|-------------|
| B            | 0           |
| A            | 8           |

### SNES / GBA
| Visual Label | Libretro ID |
|--------------|-------------|
| B            | 0           |
| Y            | 1           |
| A            | 8           |
| X            | 9           |
| L            | 10          |
| R            | 11          |

### Genesis (6-button)
| Visual Label | Libretro ID | Notes                    |
|--------------|-------------|--------------------------|
| X (top-L)    | 10          | Maps to L1 on RetroPad   |
| Y (top-C)    | 9           | Maps to X on RetroPad    |
| Z (top-R)    | 11          | Maps to R1 on RetroPad   |
| A (bot-L)    | 1           | Maps to Y on RetroPad    |
| B (bot-C)    | 0           | Maps to B on RetroPad    |
| C (bot-R)    | 8           | Maps to A on RetroPad    |

### PS1 (DualShock)
| Visual Label | Libretro ID |
|--------------|-------------|
| ✕ Cross      | 0           |
| □ Square     | 1           |
| ○ Circle     | 8           |
| △ Triangle   | 9           |
| L1           | 10          |
| R1           | 11          |
| L2           | 12          |
| R2           | 13          |
