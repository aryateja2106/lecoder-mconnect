# MConnect iOS App

Native iOS client for MConnect V2 - control AI coding agents from your iPhone.

## Prerequisites

- **Xcode 15.0+** (with Swift 5.9+)
- **iOS 17.0+** target device or simulator
- macOS 14.0+ (Sonoma) for development
- An Apple Developer account (for push notifications and device testing)

## Getting Started

### 1. Open the project

```bash
open packages/ios-app/MConnect.xcodeproj
```

### 2. Configure signing

1. Select the **MConnect** target in Xcode
2. Go to **Signing & Capabilities**
3. Select your development team
4. Xcode will auto-manage provisioning profiles

### 3. Configure capabilities

The app requires these capabilities (already declared in the project):

- **Keychain Sharing** - Secure credential storage
- **Push Notifications** - Agent event alerts
- **Background Modes** - Background fetch, remote notifications
- **Associated Domains** - URL scheme handling (`mconnect://`)

### 4. Build and run

Select an iOS 17+ simulator or device, then build (`Cmd+B`) and run (`Cmd+R`).

## Project Structure

```
MConnect/
├── App/
│   ├── MConnectApp.swift          # App entry point (@main)
│   ├── AppDelegate.swift          # Lifecycle, background modes, push setup
│   └── Router.swift               # Navigation coordinator
├── Views/
│   ├── Terminal/
│   │   ├── TerminalView.swift     # Main terminal SwiftUI view
│   │   ├── TerminalEmulator.swift # Terminal emulation (UIViewRepresentable)
│   │   └── KeyboardBar.swift      # Custom keyboard bar (Ctrl, Esc, Tab, arrows)
│   ├── Hosts/
│   │   ├── HostListView.swift     # Host profile list
│   │   ├── HostDetailView.swift   # Add/edit host profiles
│   │   └── QRScannerView.swift    # QR code scanner (AVFoundation)
│   ├── Agents/
│   │   ├── AgentDashboard.swift   # Agent overview with status badges
│   │   └── AgentDetailView.swift  # Agent controls and details
│   └── Vault/
│       ├── VaultView.swift        # Credentials management
│       └── VaultItemView.swift    # Edit individual credential
├── Services/
│   ├── WebSocket/
│   │   ├── WSClient.swift         # WebSocket protocol v3 client
│   │   ├── Protocol.swift         # Message type definitions
│   │   └── InputArbiter.swift     # Client-side input arbitration
│   ├── Auth/
│   │   ├── AuthService.swift      # OAuth 2.0 PKCE flow
│   │   └── TokenManager.swift     # JWT token storage and refresh
│   ├── Keychain/
│   │   ├── KeychainService.swift  # Keychain wrapper
│   │   └── BiometricAuth.swift    # Face ID / Touch ID
│   ├── Notifications/
│   │   └── PushService.swift      # APNs registration and handling
│   └── Background/
│       └── BackgroundManager.swift # Background task management
├── Models/
│   ├── Host.swift                 # Host profile (Codable)
│   ├── Session.swift              # Session model
│   ├── Agent.swift                # Agent model
│   └── VaultItem.swift            # Credential model
└── Resources/
    ├── Assets.xcassets            # App icons, colors
    └── Info.plist                 # URL schemes, permissions
```

## Architecture

The app follows **MVVM + Coordinator** pattern:

- **Views** - SwiftUI views (declarative UI)
- **ViewModels** - Business logic and state (ObservableObject)
- **Models** - Data models (Codable structs)
- **Services** - Network, auth, storage (protocol-oriented)
- **Router** - Navigation coordination

## Key Features

### Terminal Emulation
- Full terminal emulation via SwiftTerm
- Custom keyboard bar with special keys (Ctrl, Esc, Tab, arrow keys)
- Smooth scrolling and scrollback buffer
- Multi-agent tab switching

### Authentication
- OAuth 2.0 with PKCE (no secrets stored on device)
- JWT tokens stored in Keychain with biometric protection
- Automatic token refresh
- `mconnect://callback` URL scheme for OAuth redirect

### Secure Storage
- All credentials stored in iOS Keychain
- Biometric authentication (Face ID / Touch ID) required
- Host profiles encrypted at rest
- `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` access control

### WebSocket Protocol v3
- Automatic reconnection with exponential backoff
- Background WebSocket keepalive
- Heartbeat handling
- Input arbitration (PC priority awareness)

### Push Notifications
- Agent completion/error alerts
- Approval request notifications
- Deep linking to relevant session

## Testing

```bash
# Run unit tests
xcodebuild test \
  -project MConnect.xcodeproj \
  -scheme MConnect \
  -destination 'platform=iOS Simulator,name=iPhone 16'

# Run UI tests
xcodebuild test \
  -project MConnect.xcodeproj \
  -scheme MConnectUITests \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

Or use Xcode: `Cmd+U` to run all tests.

## Configuration

The app connects to the MConnect server. Configure the server URL through:

1. **QR Code** - Scan a QR code from the server's startup output
2. **Manual Entry** - Add a host profile with the server URL in the Hosts tab

## License

MIT
