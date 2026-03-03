# App Store Connect Submission Checklist

> **Single source of truth** for LeCoder MConnect Phase 1 TestFlight submission.
> Copy-paste these values directly into App Store Connect.

---

## Status Tracker

| Section                    | Status    | Notes                              |
|----------------------------|-----------|------------------------------------|
| 1. App Information         | ⬜ Pending | Ready to fill                      |
| 2. Pricing & Availability  | ⬜ Pending |                                    |
| 3. App Privacy             | ⬜ Pending |                                    |
| 4. Export Compliance        | ⬜ Pending |                                    |
| 5. Content Rights          | ⬜ Pending |                                    |
| 6. App Review Information  | ⬜ Pending | Email & phone needed               |
| 7. Version Information     | ⬜ Pending |                                    |
| 8. App Store Description   | ⬜ Pending |                                    |
| 9. Keywords                | ⬜ Pending |                                    |
| 10. Screenshots            | ⬜ Pending | Need to capture & size             |
| 11. Build Upload           | ⬜ Pending | Archive → Xcode Cloud / Organizer  |

---

## 1. App Information

| Field                | Value                                                              |
|----------------------|--------------------------------------------------------------------|
| **Name**             | `LeCoder MConnect`                                                 |
| **Subtitle**         | `AI Agent Terminal Control`                                        |
| **Bundle ID**        | `com.lecoder.mconnect`                                             |
| **SKU**              | `lecoder-mconnect`                                                 |
| **Primary Language** | `English (U.S.)`                                                   |
| **Category**         | `Developer Tools`                                                  |
| **Secondary Category** | `Utilities`                                                      |
| **Content Rights**   | `This app does not contain, show, or access third-party content`   |

---

## 2. Pricing and Availability

| Field            | Value              |
|------------------|--------------------|
| **Price**        | `Free`             |
| **Availability** | `All territories`  |
| **Pre-Orders**   | `No`               |

---

## 3. App Privacy

### Privacy Policy URL

```
https://github.com/aryateja2106/lecoder-mconnect/blob/main/PRIVACY.md
```

> ⚠️ A privacy policy URL is **required** before submission. Create `PRIVACY.md` in the repo if it doesn't exist.

### App Store Connect Privacy Questionnaire

**Q: Do you or your third-party partners collect data from this app?**
```
No
```

**Q: Does your app track users?**
```
No
```

### Data Types Breakdown

| Data Type          | Collected? | Used For                        | Linked to Identity? | Tracking? |
|--------------------|------------|---------------------------------|----------------------|-----------|
| Camera             | No         | QR code scanning (on-device only) | No                 | No        |
| Network Connection | No         | Connecting to user's own servers | No                  | No        |
| Device ID          | No         | Not accessed                    | No                   | No        |
| Usage Data         | No         | Not collected                   | No                   | No        |

### Camera Usage Justification

```
Camera access is used only for QR code scanning to pair with terminal sessions.
No photos or video are captured, stored, or transmitted.
```

### Info.plist Keys Required

| Key                           | Value                                                         |
|-------------------------------|---------------------------------------------------------------|
| `NSCameraUsageDescription`    | `LeCoder MConnect uses the camera to scan QR codes for pairing with your terminal sessions.` |
| `NSLocalNetworkUsageDescription` | `LeCoder MConnect connects to terminal sessions running on your local network.` |

---

## 4. Export Compliance

**Q: Does your app use encryption?**
```
No
```

**Rationale:**
```
The app uses only standard HTTPS/WSS via iOS system frameworks (URLSession, WKWebView).
No custom encryption algorithms are implemented.
```

**Q: If asked about exempt encryption:**
```
Yes, qualifies for exemption.
Exemption type: Uses only standard system-provided encryption (URLSession, WKWebView).
```

> 💡 To skip this question on every build, add to `Info.plist`:
> ```xml
> <key>ITSAppUsesNonExemptEncryption</key>
> <false/>
> ```

---

## 5. Content Rights

**Q: Does your app contain, show, or access third-party content?**
```
No
```

---

## 6. App Review Information

| Field              | Value                                              |
|--------------------|----------------------------------------------------|
| **Contact Name**   | `Arya Teja Rudraraju`                              |
| **Email**          | `[TO BE FILLED]`                                   |
| **Phone**          | `[TO BE FILLED]`                                   |
| **Demo Account**   | Not required (app connects to user's own servers)  |

### Notes for Reviewer

```
LeCoder MConnect connects to the user's own terminal sessions running on their
computers. The app requires the user to have the LeCoder MConnect CLI running
on their computer (available at https://github.com/aryateja2106/lecoder-mconnect).

To test:
1) Install CLI with 'npm install -g lecoder-mconnect'
2) Run 'lecoder-mconnect start'
3) Scan the QR code or enter the URL shown in the terminal

The app acts as a remote terminal viewer/controller. It does not host any
content itself — it connects over WebSocket to the user's own machines.
If you are unable to set up the CLI, the app will show the connection screen
with QR scanner, pairing code entry, and direct URL input options.
```

---

## 7. Version Information

| Field          | Value              |
|----------------|--------------------|
| **Version**    | `1.0.0`            |
| **Build**      | `1`                |
| **What's New** | `Initial release`  |
| **Copyright**  | `© 2026 Arya Teja Rudraraju` |

---

## 8. App Store Description

```
LeCoder MConnect - AI Agent Terminal Control

Monitor and control your AI coding agents from anywhere. Connect to Claude Code, Gemini CLI, Codex, and any CLI-based AI tool running on your computer.

Features:
• QR Code Connect - Scan to pair instantly
• Pairing Code - Enter a 6-character code
• Direct URL - Connect via Cloudflare tunnel or local IP
• Tailscale Support - Connect via mesh network IPs
• Real-time Terminal - Full terminal view in your pocket
• Connection History - Quick reconnect to recent sessions

How it works:
1. Install the CLI: npm install -g lecoder-mconnect
2. Start a session: lecoder-mconnect start
3. Scan the QR code with this app
4. Control your AI agents from your phone

Built for developers who run AI coding agents and want mobile oversight.
```

### Promotional Text (optional, can be changed without a new build)

```
Connect to your AI coding agents from anywhere. Mobile control for Claude Code, Gemini CLI, and more.
```

---

## 9. Keywords

```
ai,terminal,ssh,coding,agent,remote,developer,cli,monitor,control
```

> **100-character limit.** Current: 62 characters. Room for more keywords.
>
> Extended option (97 chars):
> ```
> ai,terminal,ssh,coding,agent,remote,developer,cli,monitor,control,devtools,mobile,qr,pair,connect
> ```

---

## 10. Screenshots

### Required Sizes

| Device Class                  | Resolution       | Minimum Count |
|-------------------------------|------------------|---------------|
| **iPhone 6.7" (15 Pro Max / 16 Pro Max)** | 1290 × 2796 px  | 3             |
| **iPhone 6.5" (14 Plus / 15 Plus / 16 Plus)** | 1284 × 2778 px  | 3             |
| **iPad Pro 13" (6th gen)**    | 2048 × 2732 px   | 3             |

> Tip: 6.7" screenshots can auto-scale for 6.5". Only one set needed if using the larger size.

### Recommended Screenshots (in order)

| #  | Screen             | Caption                                          |
|----|--------------------|--------------------------------------------------|
| 1  | Connection Hub      | `Connect to AI agents instantly`                 |
| 2  | QR Scanner          | `Scan to pair in seconds`                        |
| 3  | Terminal View       | `Full terminal in your pocket`                   |
| 4  | Connection History  | `Quick reconnect to recent sessions`             |
| 5  | Pairing Code Entry  | `Enter a code or paste a URL to connect`         |

### App Icon

| Requirement         | Value                     |
|---------------------|---------------------------|
| **Size**            | 1024 × 1024 px            |
| **Format**          | PNG, no alpha/transparency |
| **Corners**         | Square (iOS auto-rounds)  |

---

## 11. Pre-Submission Checklist

### Already Done ✅

- [x] Xcode project created
- [x] Bundle ID set: `com.lecoder.mconnect`
- [x] App name and subtitle decided
- [x] Description and keywords drafted
- [x] Review notes written
- [x] Privacy questionnaire answers prepared
- [x] Export compliance answers prepared

### Pending ⬜

- [ ] Create App Store Connect app record
- [ ] Fill contact email and phone in Section 6
- [ ] Create `PRIVACY.md` in repo (privacy policy URL)
- [ ] Add `ITSAppUsesNonExemptEncryption = NO` to `Info.plist`
- [ ] Verify `NSCameraUsageDescription` in `Info.plist`
- [ ] Verify `NSLocalNetworkUsageDescription` in `Info.plist`
- [ ] Design and export app icon (1024 × 1024)
- [ ] Capture iPhone screenshots (1290 × 2796 or 1284 × 2778)
- [ ] Capture iPad screenshots (2048 × 2732)
- [ ] Archive build in Xcode
- [ ] Upload build to App Store Connect
- [ ] Complete TestFlight setup (beta group, testers)
- [ ] Submit for TestFlight review

---

## Quick Reference: App Store Connect Navigation

```
App Store Connect → My Apps → LeCoder MConnect

├── App Information        → Section 1, 5
├── Pricing and Availability → Section 2
├── App Privacy            → Section 3
├── App Store (iOS)
│   ├── Version Information → Section 7, 8, 9, 10
│   └── App Review Information → Section 6
└── TestFlight
    ├── Test Information   → Description + review notes
    └── Builds             → Upload from Xcode
```
