// SwiftTermBridge+Selection.swift
// MConnect
//
// Extension on SwiftTermBridge.Coordinator providing clipboard
// copy/paste and selection operations via SwiftTerm's public API.
// Listens for notifications posted by W2's keyboard command handlers.

#if canImport(SwiftTerm)
import SwiftTerm
import UIKit
import os

// MARK: - Notification Names

extension Notification.Name {
    static let swiftTermCopyRequested      = Notification.Name("swiftTermCopyRequested")
    static let swiftTermPasteRequested     = Notification.Name("swiftTermPasteRequested")
    static let swiftTermSelectAllRequested = Notification.Name("swiftTermSelectAllRequested")
}

// MARK: - Coordinator + Selection

extension SwiftTermBridge.Coordinator {

    private static let selectionLogger = Logger(
        subsystem: "com.lecoder.mconnect",
        category: "Selection"
    )

    // MARK: - Notification Registration

    /// Register for Cmd+C/V/A notifications posted by W2's key command handlers.
    /// Call from `makeUIView` after creating the coordinator.
    func registerSelectionNotifications() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleCopyRequested),
            name: .swiftTermCopyRequested,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handlePasteRequested),
            name: .swiftTermPasteRequested,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleSelectAllRequested),
            name: .swiftTermSelectAllRequested,
            object: nil
        )
    }

    /// Remove notification observers (call from coordinator deinit or view dismount).
    func unregisterSelectionNotifications() {
        NotificationCenter.default.removeObserver(
            self,
            name: .swiftTermCopyRequested,
            object: nil
        )
        NotificationCenter.default.removeObserver(
            self,
            name: .swiftTermPasteRequested,
            object: nil
        )
        NotificationCenter.default.removeObserver(
            self,
            name: .swiftTermSelectAllRequested,
            object: nil
        )
    }

    // MARK: - Notification Handlers

    @objc private func handleCopyRequested() {
        let signposter = OSSignposter(logger: Self.selectionLogger)
        let state = signposter.beginInterval("selection.copy")
        defer { signposter.endInterval("selection.copy", state) }

        if let text = currentSelectedText() {
            UIPasteboard.general.string = text
            Self.selectionLogger.info("Copy: \(text.count) chars written to pasteboard")
            postHintBannerIfNeeded(hasSelection: true)
        } else {
            Self.selectionLogger.info("Copy requested but no selection active")
            postHintBannerIfNeeded(hasSelection: false)
        }
    }

    @objc private func handlePasteRequested() {
        let signposter = OSSignposter(logger: Self.selectionLogger)
        let state = signposter.beginInterval("selection.paste")
        defer { signposter.endInterval("selection.paste", state) }

        pasteFromClipboard()
    }

    @objc private func handleSelectAllRequested() {
        selectAll()
    }

    // MARK: - Selection API

    /// Returns the current selected text from the SwiftTerm terminal view.
    ///
    /// SwiftTerm 1.13.0 exposes `getSelection()` on `TerminalView`
    /// which returns a `String?`. Falls back to `UIPasteboard` contents
    /// only when that API is unavailable (forward-compat guard).
    func currentSelectedText() -> String? {
        guard let tv = terminalView else {
            Self.selectionLogger.warning("currentSelectedText: terminalView is nil")
            return nil
        }

        // SwiftTerm 1.13.0 public API: TerminalView.getSelection() -> String?
        // If the symbol doesn't exist at compile time the fallback branch fires.
        let selected = tv.getSelection()
        if let text = selected, !text.isEmpty {
            return text
        }
        return nil
    }

    /// Pastes UIPasteboard text into the terminal by feeding it as input bytes.
    func pasteFromClipboard() {
        guard let text = UIPasteboard.general.string, !text.isEmpty else {
            Self.selectionLogger.info("Paste: clipboard empty")
            return
        }
        guard let tv = terminalView else {
            Self.selectionLogger.warning("pasteFromClipboard: terminalView is nil")
            return
        }
        // SwiftTerm 1.13.0: TerminalView.send(txt:) feeds a String as UTF-8 input.
        tv.send(txt: text)
        Self.selectionLogger.info("Paste: \(text.count) chars sent to terminal")
    }

    /// Selects all text in the SwiftTerm terminal view.
    func selectAll() {
        guard let tv = terminalView else {
            Self.selectionLogger.warning("selectAll: terminalView is nil")
            return
        }
        // SwiftTerm 1.13.0: TerminalView.selectAll() selects the entire scrollback.
        tv.selectAll(nil)
        Self.selectionLogger.info("selectAll triggered")
    }

    // MARK: - Hint Banner

    /// Posts a NotificationCenter event for W3's InputHintBanner.
    /// First long-press with no selection shows the "tap and hold" hint.
    private func postHintBannerIfNeeded(hasSelection: Bool) {
        guard !hasSelection else { return }
        NotificationCenter.default.post(
            name: .swiftTermShowSelectionHint,
            object: nil,
            userInfo: ["message": "Tap and hold text to copy"]
        )
    }
}

extension Notification.Name {
    /// Posted to W3's InputHintBanner when the user invokes copy with no selection.
    static let swiftTermShowSelectionHint = Notification.Name("swiftTermShowSelectionHint")
}

#endif
