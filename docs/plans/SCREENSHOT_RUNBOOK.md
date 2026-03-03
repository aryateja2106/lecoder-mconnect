# Screenshot Capture Runbook

> Reproducible step-by-step guide for capturing all required App Store screenshots for LeCoder MConnect iOS app.

---

## Available Simulators (iOS 26.2)

| Device | Display Size | Resolution | Use |
|--------|-------------|------------|-----|
| iPhone 17 Pro Max | 6.5" | 1284 × 2778 (or 1290 × 2796) | iPhone screenshots |
| iPad Pro 13-inch (M5) | 13" | 2048 × 2732 | iPad screenshots |

**Requirements:** Minimum 3, maximum 10 screenshots per device size.

---

## Pre-capture Checklist

- [ ] Xcode installed and simulators available (`xcrun simctl list devices`)
- [ ] Simulators booted and app installed
- [ ] CLI running locally for terminal screenshot (`npx lecoder-mconnect start`)
- [ ] Screenshot output directories created
- [ ] Simulator status bar set to default (9:41 AM)
- [ ] Dark mode confirmed (enforced by app)

---

## Screenshots to Capture

| # | Screen | State | Caption Suggestion |
|---|--------|-------|--------------------|
| 1 | Connect Screen (Home) | App launched, not connected | "Connect to your AI agents instantly" |
| 2 | QR Scanner / Manual Connect | QR scanner sheet open (or Manual Connect fallback on simulator) | "Scan QR code to pair" |
| 3 | Terminal Connected | Connected to a live terminal session with AI agent output | "Full terminal control from your phone" |
| 4 | Connection Error State | Connection failed (e.g., expired URL) | "Smart error handling with retry" |
| 5 | Manual Connect | "Connect to URL" sheet open with example URLs | "Connect via URL, Tailscale, or local network" |

### Screenshot Details

#### Screenshot 1: Connect Screen (Home)
- **State:** App launched, not connected, no recent connections shown (or with recent connections)
- **Shows:** Logo, "Scan QR Code", "Enter Pairing Code", "Connect to URL" options

#### Screenshot 2: QR Scanner
- **State:** QR scanner sheet open
- **Shows:** Camera viewfinder with scan reticle overlay
- **⚠️ Note:** Camera won't work on simulator. Use a physical device for this shot, or substitute with the Manual Connect sheet or Pairing Code entry screen instead.

#### Screenshot 3: Terminal Connected
- **State:** Connected to a live terminal session showing AI agent output
- **Shows:** Full-screen terminal with code/agent output visible
- **Prerequisite:** Requires a running CLI session — run `npx lecoder-mconnect start` first

#### Screenshot 4: Connection Error State
- **State:** Connection failed (e.g., connect to `https://expired.trycloudflare.com`)
- **Shows:** Error overlay with retry/disconnect buttons

#### Screenshot 5: Manual Connect
- **State:** "Connect to URL" sheet open with example URLs visible
- **Shows:** URL input field with Cloudflare/Tailscale/local IP examples

---

## Step-by-Step Commands

### Step 1: Set Up Status Bar (Clean Screenshots)

```bash
# Override status bar to show clean 9:41 AM, full battery, full signal
xcrun simctl status_bar "iPhone 17 Pro Max" override \
  --time "9:41" \
  --batteryState charged \
  --batteryLevel 100 \
  --cellularMode active \
  --cellularBars 4

xcrun simctl status_bar "iPad Pro 13-inch (M5)" override \
  --time "9:41" \
  --batteryState charged \
  --batteryLevel 100 \
  --wifiBars 3
```

### Step 2: Boot Simulators

```bash
xcrun simctl boot "iPhone 17 Pro Max"
xcrun simctl boot "iPad Pro 13-inch (M5)"
```

### Step 3: Build the App

```bash
# Build for iPhone
xcodebuild -project lecocer-mconnect-test1.xcodeproj \
  -scheme lecocer-mconnect-test1 \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' \
  -configuration Debug \
  build

# Build for iPad
xcodebuild -project lecocer-mconnect-test1.xcodeproj \
  -scheme lecocer-mconnect-test1 \
  -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M5)' \
  -configuration Debug \
  build
```

### Step 4: Install the App

```bash
xcrun simctl install "iPhone 17 Pro Max" \
  ~/Library/Developer/Xcode/DerivedData/lecocer-mconnect-test1-*/Build/Products/Debug-iphonesimulator/lecocer-mconnect-test1.app

xcrun simctl install "iPad Pro 13-inch (M5)" \
  ~/Library/Developer/Xcode/DerivedData/lecocer-mconnect-test1-*/Build/Products/Debug-iphonesimulator/lecocer-mconnect-test1.app
```

### Step 5: Launch the App

```bash
# Replace [bundle-id] with the actual bundle identifier (e.g., com.lecoder.mconnect)
xcrun simctl launch "iPhone 17 Pro Max" [bundle-id]
xcrun simctl launch "iPad Pro 13-inch (M5)" [bundle-id]
```

### Step 6: Create Output Directories

```bash
mkdir -p docs/screenshots/iphone docs/screenshots/ipad
```

### Step 7: Capture Screenshots

Capture each screenshot after navigating to the correct state in Simulator.app.

```bash
# --- Screenshot 1: Connect Screen ---
# Capture immediately after launch (home screen)
xcrun simctl io "iPhone 17 Pro Max" screenshot docs/screenshots/iphone/01-connect.png
xcrun simctl io "iPad Pro 13-inch (M5)" screenshot docs/screenshots/ipad/01-connect.png

# --- Screenshot 2: QR Scanner / Manual Connect ---
# Tap "Scan QR Code" in Simulator.app (or use Manual Connect as fallback)
xcrun simctl io "iPhone 17 Pro Max" screenshot docs/screenshots/iphone/02-scanner.png
xcrun simctl io "iPad Pro 13-inch (M5)" screenshot docs/screenshots/ipad/02-scanner.png

# --- Screenshot 3: Terminal Connected ---
# Prerequisites: Run `npx lecoder-mconnect start` in a separate terminal
# Connect to the running session, then capture
xcrun simctl io "iPhone 17 Pro Max" screenshot docs/screenshots/iphone/03-terminal.png
xcrun simctl io "iPad Pro 13-inch (M5)" screenshot docs/screenshots/ipad/03-terminal.png

# --- Screenshot 4: Connection Error ---
# Try connecting to https://expired.trycloudflare.com to trigger error state
xcrun simctl io "iPhone 17 Pro Max" screenshot docs/screenshots/iphone/04-error.png
xcrun simctl io "iPad Pro 13-inch (M5)" screenshot docs/screenshots/ipad/04-error.png

# --- Screenshot 5: Manual Connect ---
# Tap "Connect to URL" to open the manual connect sheet
xcrun simctl io "iPhone 17 Pro Max" screenshot docs/screenshots/iphone/05-manual-connect.png
xcrun simctl io "iPad Pro 13-inch (M5)" screenshot docs/screenshots/ipad/05-manual-connect.png
```

### Step 8: Cleanup

```bash
# Clear status bar overrides
xcrun simctl status_bar "iPhone 17 Pro Max" clear
xcrun simctl status_bar "iPad Pro 13-inch (M5)" clear

# Optionally shut down simulators
xcrun simctl shutdown "iPhone 17 Pro Max"
xcrun simctl shutdown "iPad Pro 13-inch (M5)"
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| QR scanner blank on simulator | Camera is unavailable in simulator — use Manual Connect or Pairing Code screen instead |
| Terminal screenshot shows blank | Ensure `npx lecoder-mconnect start` is running and the app is connected before capturing |
| Wrong resolution | Verify you're using the correct simulator device; check with `xcrun simctl list devices booted` |
| Status bar shows wrong time | Re-run the `status_bar override` command from Step 1 |
| App not found after install | Check DerivedData path; run `find ~/Library/Developer/Xcode/DerivedData -name "lecocer-mconnect-test1.app" -type d` |
| Build fails for iPad | Ensure the scheme supports iPad; check project settings for supported device families |

---

## Output File Summary

```
docs/screenshots/
├── iphone/
│   ├── 01-connect.png
│   ├── 02-scanner.png
│   ├── 03-terminal.png
│   ├── 04-error.png
│   └── 05-manual-connect.png
└── ipad/
    ├── 01-connect.png
    ├── 02-scanner.png
    ├── 03-terminal.png
    ├── 04-error.png
    └── 05-manual-connect.png
```
