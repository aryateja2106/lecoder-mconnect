# SwiftTerm Integration

Adds full VT100/xterm terminal emulation to the MConnect iOS app via [SwiftTerm](https://github.com/migueldeicaza/SwiftTerm).

The code is already wired (`SwiftTermBridge.swift`, `TerminalEmulatorView.swift`). You just need to add the SPM package.

## 4 Steps to Enable

**Step 1 — Open Add Package Dependencies**

In Xcode, with `MConnect.xcodeproj` open, go to:
`File` → `Add Package Dependencies…`

**Step 2 — Paste the repository URL**

In the search field at the top-right of the dialog, paste:
```
https://github.com/migueldeicaza/SwiftTerm.git
```
Hit Return. Xcode will resolve the package.

**Step 3 — Set the version rule**

Under "Dependency Rule", select:
- Rule: `Up to Next Major Version`
- From: `1.13.0`

Then click **Add Package**.

**Step 4 — Add to the MConnect target**

When prompted to choose package products, tick the checkbox next to **SwiftTerm** and make sure the "Add to Target" column shows **MConnect**. Click **Add Package**.

Build (`Cmd+B`). The `#if canImport(SwiftTerm)` branch in `TerminalEmulatorView` activates automatically — no code changes needed.

## How It Works

- `SwiftTermBridge` (`Views/Terminal/SwiftTermBridge.swift`) is a `UIViewRepresentable` that hosts SwiftTerm's `TerminalView`.
- On each SwiftUI update cycle it reads `TerminalBuffer.rawOutput(forAgent:)` and feeds only the new bytes to SwiftTerm via `feed(byteArray:)`, tracked by a `lastFedOutput` offset string in the coordinator.
- User keyboard input flows out through `TerminalViewDelegate.send(source:data:)` → `TerminalViewModel.sendInputBytes(_:)` → existing `sendInput(_:)` → WSClient.
- Terminal resize events go through the existing `handleTerminalSizeChange(cols:rows:)` path already wired to `wsClient.sendResize`.

## Fallback

If the package is not added, `#if canImport(SwiftTerm)` is false and the app builds normally using `TerminalTextView` (plain monospaced text scrollview).
