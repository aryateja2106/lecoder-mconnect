# VNC Integration

The iOS app now includes a Screen tab and a VNC connection form. The app builds
and runs without RoyalVNCKit; until the adapter is updated against RoyalVNCKit's
current public API, the tab shows a placeholder after Connect.

## Package Setup

When the bridge is ready to re-enable, add the package in Xcode:

```text
https://github.com/royalapplications/royalvnc.git
```

Recommended initial version selection:

```text
Up to Next Major Version, starting from 1.1.0
```

Add `RoyalVNCKit` to the `MConnect` target.

## Mac Prerequisites

On the Mac you want to control:

- Open System Settings -> General -> Sharing.
- Turn Screen Sharing or Remote Management on.
- Use port `5900` unless the host is configured differently.
- For ARD-style authentication, provide both username and password.
- For password-only VNC authentication, leave the username field empty.

## Bridge Work Remaining

- Replace the inactive RoyalVNCKit block in `VNCBridge.swift` with code that
  matches the package's current API.
- Render framebuffer updates efficiently, ideally avoiding CPU-side image copies
  for sustained frame rate.
- Map touch, drag, and long-press gestures to remote pointer events with proper
  aspect-fit coordinate mapping.
- Add keyboard passthrough for hardware and software keyboards.
- Add a simulator-friendly smoke path that verifies the Screen tab renders even
  without a live VNC server.
