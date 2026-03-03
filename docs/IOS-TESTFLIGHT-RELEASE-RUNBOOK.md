# iOS TestFlight Release Runbook (Quick Ship Track)

This runbook is for the current quick-ship app at `lecocer-mconnect-test1/`.

## Current Status

- `asc auth` is configured and healthy.
- Bundle ID exists: `com.lecoder.mconnect` (`QP727UK8G8`).
- Distribution cert exists: `H83J94W3Q8`.
- App Store provisioning profile exists: `WMU9ZPAJRG`.
- App record in App Store Connect is still missing.
- Xcode archive currently fails because `Development Team` is not set.

## 1) One-Time App Store Connect App Creation

`asc apps create` for this step uses Apple ID auth (interactive), not only API key auth.

Run:

```bash
asc apps create \
  --name "LeCoder MConnect" \
  --bundle-id "com.lecoder.mconnect" \
  --sku "LECODER-MCONNECT-IOS-001" \
  --primary-locale "en-US" \
  --platform IOS \
  --output table
```

After creation, verify:

```bash
asc apps list --output table
```

Copy the returned app ID (you will use it as `<APP_ID>` in later steps).

## 2) Configure Signing in Xcode

Open `lecocer-mconnect-test1.xcodeproj`, then:

1. Select target `lecocer-mconnect-test1`.
2. Go to **Signing & Capabilities**.
3. Enable **Automatically manage signing**.
4. Set **Team** to your Apple Developer team.
5. Confirm bundle ID is `com.lecoder.mconnect`.

## 3) Archive Build

From Xcode UI:

- Product -> Archive

Or CLI:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -project "lecocer-mconnect-test1/lecocer-mconnect-test1.xcodeproj" \
  -scheme "lecocer-mconnect-test1" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  archive \
  -archivePath "build/lecoder-mconnect-test1.xcarchive"
```

## 4) Upload to App Store Connect (TestFlight)

Use Xcode Organizer (recommended first upload):

- Distribute App -> App Store Connect -> Upload

Then confirm build appears:

```bash
asc testflight builds list --app "<APP_ID>" --output table
```

## 5) Pre-Submit Quality Gate

When the App Store version (for example `1.0`) exists:

```bash
asc validate --app "<APP_ID>" --version "1.0" --platform IOS --output table
```

For stricter CI-style gating:

```bash
asc validate --app "<APP_ID>" --version "1.0" --platform IOS --strict --output table
```

Optional TestFlight readiness check:

```bash
asc validate testflight --app "<APP_ID>"
```

## 6) Submit (When Ready)

After fixing all validation errors and completing metadata/screenshots:

```bash
asc submit --app "<APP_ID>" --version "1.0"
```

## Troubleshooting

- `Signing requires a development team`:
  - Set Team in Xcode target Signing settings.
- `asc apps list` empty:
  - Create app record first using `asc apps create`.
- `asc apps create` asks for Apple ID:
  - Expected. Complete interactive auth + 2FA.

