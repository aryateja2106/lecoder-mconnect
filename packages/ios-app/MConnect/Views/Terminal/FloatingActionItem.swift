import SwiftUI

// MARK: - FloatingActionKind

enum FloatingActionKind: String, CaseIterable {
    case pin
    case keyboard
    case mouse
    case info
    case help
    case disconnect
    case markdown

    var systemImage: String {
        switch self {
        case .pin:        return "pin.fill"
        case .keyboard:   return "keyboard"
        case .mouse:      return "cursorarrow"
        case .info:       return "info.circle"
        case .help:       return "questionmark.circle"
        case .disconnect: return "xmark.circle.fill"
        case .markdown:   return "doc.richtext"
        }
    }

    var label: String {
        switch self {
        case .pin:        return "Pin keyboard"
        case .keyboard:   return "Toggle keyboard"
        case .mouse:      return "Toggle cursor mode"
        case .info:       return "Session info"
        case .help:       return "Keybinding help"
        case .disconnect: return "Disconnect session"
        case .markdown:   return "Toggle markdown render"
        }
    }
}

// MARK: - FloatingActionItem

struct FloatingActionItem: Identifiable {
    let id: FloatingActionKind
    let systemImage: String
    let label: String
    var isOn: Bool
    var action: () -> Void

    init(
        kind: FloatingActionKind,
        isOn: Bool = false,
        action: @escaping () -> Void
    ) {
        self.id = kind
        self.systemImage = kind.systemImage
        self.label = kind.label
        self.isOn = isOn
        self.action = action
    }
}
