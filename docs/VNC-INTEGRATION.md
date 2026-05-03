# VNC Integration — RoyalVNCKit Setup

The Screen tab compiles and runs without RoyalVNCKit (shows a placeholder).
Add the package to get live VNC/ARD connectivity.

## 4-Step Xcode SPM Setup

**Step 1 — Open Package Dependencies**
In Xcode: File → Add Package Dependencies…

**Step 2 — Enter the repository URL**
```
https://github.com/royalapplications/royalvnc.git
```

**Step 3 — Choose version**
Select "Up to Next Major Version" starting from **1.1.0**
(or exact version `1.1.0` for a pinned build).

**Step 4 — Add to target**
When prompted, add **RoyalVNCKit** to the **MConnect** target.
Click Add Package.

That's it. Rebuild — the `#if canImport(RoyalVNCKit)` gates in `VNCBridge.swift`
activate automatically and the placeholder is replaced with a live framebuffer view.

## Mac Prerequisites

On the Mac you want to connect to:

- System Settings → General → Sharing → **Screen Sharing** ON
- For Apple Remote Desktop (ARD) auth (username + password):
  System Settings → General → Sharing → Screen Sharing → "Allow access for: All users"
  or add a specific VNC user via "Computer Settings…".
- Default port: **5900**

## Authentication Modes

| Username field | Auth used |
|----------------|-----------|
| empty          | VNC password-only (`VNCPasswordCredential`) |
| filled         | ARD username+password (`VNCUsernamePasswordCredential`, RFB type 30) |

## Known Gaps / TODOs

- **Framebuffer rendering**: `cgImage` conversion is used for simplicity. For
  higher frame rates, replace with `VNCFramebufferIOSurfaceAllocator` + direct
  `CALayer.contents = IOSurface` (avoids CPU-side pixel copy).
- **Mouse coordinate scaling**: pointer events are scaled by
  `framebuffer.width / view.bounds.width`. No DPI compensation yet — works on
  standard displays, may be off on HiDPI Macs.
- **Keyboard input**: not wired. Add `connection.sendKeyEvent(...)` + a
  `UITextField` overlay to capture keystrokes.
- **Cellular guard**: `VNCConnectionSettings.encodings` uses JPEG; consider
  disabling continuous updates on cellular via `NWPathMonitor`.
- **Background reconnect**: `ScreenView` re-calls `connect()` on
  `scenePhase == .active` when state is `.disconnected`. The VNCBridge VC is
  recreated by SwiftUI on state change — this triggers a fresh `startConnection()`.
