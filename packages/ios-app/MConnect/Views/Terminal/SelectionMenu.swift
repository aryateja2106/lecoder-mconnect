// SelectionMenu.swift
// MConnect
//
// SwiftUI view modifier that attaches a UIEditMenuInteraction on long-press,
// surfacing Copy, Paste, Select All, and Search Web actions for the terminal.
// Minimum deployment target iOS 17 — UIEditMenuInteraction is unconditionally available.

import SwiftUI
import UIKit

// MARK: - View Modifier

/// Attach with `.terminalSelectionMenu(getSelectedText:onPaste:onSelectAll:)`.
struct TerminalSelectionMenuModifier: ViewModifier {
    let getSelectedText: () -> String?
    let onPaste: () -> Void
    let onSelectAll: () -> Void

    func body(content: Content) -> some View {
        content.overlay(
            SelectionMenuOverlay(
                getSelectedText: getSelectedText,
                onPaste: onPaste,
                onSelectAll: onSelectAll
            )
        )
    }
}

// MARK: - Overlay UIViewRepresentable

/// Transparent overlay that installs UIEditMenuInteraction on long-press.
private struct SelectionMenuOverlay: UIViewRepresentable {
    let getSelectedText: () -> String?
    let onPaste: () -> Void
    let onSelectAll: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(
            getSelectedText: getSelectedText,
            onPaste: onPaste,
            onSelectAll: onSelectAll
        )
    }

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.backgroundColor = .clear
        view.isUserInteractionEnabled = true

        let longPress = UILongPressGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handleLongPress(_:))
        )
        longPress.minimumPressDuration = 0.5
        view.addGestureRecognizer(longPress)

        let interaction = UIEditMenuInteraction(delegate: context.coordinator)
        view.addInteraction(interaction)
        context.coordinator.editMenuInteraction = interaction

        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {}

    // MARK: - Coordinator

    final class Coordinator: NSObject, UIEditMenuInteractionDelegate {
        let getSelectedText: () -> String?
        let onPaste: () -> Void
        let onSelectAll: () -> Void

        weak var editMenuInteraction: UIEditMenuInteraction?
        private var longPressLocation: CGPoint = .zero

        init(
            getSelectedText: @escaping () -> String?,
            onPaste: @escaping () -> Void,
            onSelectAll: @escaping () -> Void
        ) {
            self.getSelectedText = getSelectedText
            self.onPaste = onPaste
            self.onSelectAll = onSelectAll
        }

        @objc func handleLongPress(_ recognizer: UILongPressGestureRecognizer) {
            guard recognizer.state == .began else { return }
            longPressLocation = recognizer.location(in: recognizer.view)
            let config = UIEditMenuConfiguration(
                identifier: nil,
                sourcePoint: longPressLocation
            )
            editMenuInteraction?.presentEditMenu(with: config)
        }

        // MARK: - UIEditMenuInteractionDelegate

        func editMenuInteraction(
            _ interaction: UIEditMenuInteraction,
            menuFor configuration: UIEditMenuConfiguration,
            suggestedActions: [UIMenuElement]
        ) -> UIMenu? {
            var actions: [UIAction] = []

            // Copy and Search Web — only shown when text is selected
            if let selected = getSelectedText(), !selected.isEmpty {
                let copy = UIAction(
                    title: "Copy",
                    image: UIImage(systemName: "doc.on.doc")
                ) { [weak self] _ in
                    UIPasteboard.general.string = selected
                    self?.postCopyNotification()
                }
                actions.append(copy)

                let searchWeb = UIAction(
                    title: "Search Web",
                    image: UIImage(systemName: "magnifyingglass")
                ) { _ in
                    let query = selected.trimmingCharacters(in: .whitespacesAndNewlines)
                    if let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
                       let url = URL(string: "https://www.google.com/search?q=\(encoded)") {
                        UIApplication.shared.open(url)
                    }
                }
                actions.append(searchWeb)
            }

            // Paste — always available
            let paste = UIAction(
                title: "Paste",
                image: UIImage(systemName: "doc.on.clipboard")
            ) { [weak self] _ in
                self?.onPaste()
            }
            actions.append(paste)

            // Select All — always available
            let selectAll = UIAction(
                title: "Select All",
                image: UIImage(systemName: "checkmark.rectangle")
            ) { [weak self] _ in
                self?.onSelectAll()
            }
            actions.append(selectAll)

            return UIMenu(children: actions)
        }

        private func postCopyNotification() {
            NotificationCenter.default.post(name: .swiftTermCopyRequested, object: nil)
        }
    }
}

// MARK: - View Extension

extension View {
    /// Attaches a long-press selection menu to the terminal view.
    ///
    /// - Parameters:
    ///   - getSelectedText: Closure returning the current selection, or nil if none.
    ///   - onPaste: Called when the user taps Paste.
    ///   - onSelectAll: Called when the user taps Select All.
    func terminalSelectionMenu(
        getSelectedText: @escaping () -> String?,
        onPaste: @escaping () -> Void,
        onSelectAll: @escaping () -> Void
    ) -> some View {
        modifier(
            TerminalSelectionMenuModifier(
                getSelectedText: getSelectedText,
                onPaste: onPaste,
                onSelectAll: onSelectAll
            )
        )
    }
}

// MARK: - Notification Names (non-SwiftTerm builds)
//
// When SwiftTerm is not imported, SwiftTermBridge+Selection.swift is compiled
// out entirely (wrapped in #if canImport(SwiftTerm)). Declare the same names
// here so SelectionMenu can post/observe them unconditionally.

#if !canImport(SwiftTerm)
extension Notification.Name {
    static let swiftTermCopyRequested      = Notification.Name("swiftTermCopyRequested")
    static let swiftTermPasteRequested     = Notification.Name("swiftTermPasteRequested")
    static let swiftTermSelectAllRequested = Notification.Name("swiftTermSelectAllRequested")
    static let swiftTermShowSelectionHint  = Notification.Name("swiftTermShowSelectionHint")
}
#endif
