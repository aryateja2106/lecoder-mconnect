import Foundation
import os

/// Terminal output buffer managing per-agent scrollback.
///
/// Stores raw terminal output per agent and provides cleaned text for display.
/// Handles scrollback limits to prevent unbounded memory growth.
@MainActor
final class TerminalBuffer {
    // MARK: - Configuration

    /// Maximum number of scrollback lines to retain per agent.
    let maxScrollbackLines: Int

    // MARK: - Per-Agent Buffers

    /// Per-agent line buffers (ANSI stripped for display).
    private var buffers: [String: [String]] = [:]

    /// Per-agent raw output (preserves ANSI for SwiftTerm).
    private var rawBuffers: [String: String] = [:]

    // MARK: - Logger

    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "TerminalBuffer")

    // MARK: - Init

    init(maxScrollbackLines: Int = 10_000) {
        self.maxScrollbackLines = maxScrollbackLines
    }

    // MARK: - Public API

    /// Append output data for an agent.
    func append(_ data: String, forAgent agentId: String) {
        // Update raw buffer (preserves ANSI)
        let currentRaw = rawBuffers[agentId, default: ""]
        rawBuffers[agentId] = currentRaw + data

        // Split by newlines and append to line buffer (ANSI stripped)
        let stripped = stripANSI(data)
        let lines = stripped.components(separatedBy: .newlines)

        var currentBuffer = buffers[agentId, default: []]

        // If buffer is not empty and last line doesn't end with newline,
        // we need to append to the last line
        if !currentBuffer.isEmpty, !currentRaw.hasSuffix("\n") {
            let lastLine = currentBuffer.removeLast()
            currentBuffer.append(lastLine + (lines.first ?? ""))

            // Add remaining lines
            if lines.count > 1 {
                currentBuffer.append(contentsOf: lines.dropFirst())
            }
        } else {
            // Just append all lines
            currentBuffer.append(contentsOf: lines)
        }

        buffers[agentId] = currentBuffer
        trimBuffer(forAgent: agentId)

        logger.debug("Appended \(data.count) bytes to agent \(agentId), now \(currentBuffer.count) lines")
    }

    /// Get display text for an agent (ANSI stripped for plain text fallback).
    func displayText(forAgent agentId: String) -> String {
        guard let lines = buffers[agentId] else {
            return ""
        }
        return lines.joined(separator: "\n")
    }

    /// Get raw output for an agent (preserves ANSI for SwiftTerm).
    func rawOutput(forAgent agentId: String) -> String {
        return rawBuffers[agentId] ?? ""
    }

    /// Get line count for an agent.
    func lineCount(forAgent agentId: String) -> Int {
        return buffers[agentId]?.count ?? 0
    }

    /// Clear buffer for an agent.
    func clear(forAgent agentId: String) {
        buffers.removeValue(forKey: agentId)
        rawBuffers.removeValue(forKey: agentId)
        logger.info("Cleared buffer for agent \(agentId)")
    }

    /// Clear all buffers.
    func clearAll() {
        buffers.removeAll()
        rawBuffers.removeAll()
        logger.info("Cleared all buffers")
    }

    /// Prepend scrollback lines (from server scrollback response).
    ///
    /// The lines are inserted at the beginning of the buffer, before any existing content.
    func prependScrollback(_ lines: [String], forAgent agentId: String) {
        var currentBuffer = buffers[agentId, default: []]

        // Insert lines at the beginning
        currentBuffer.insert(contentsOf: lines, at: 0)
        buffers[agentId] = currentBuffer

        // Also prepend to raw buffer
        let scrollbackText = lines.joined(separator: "\n") + "\n"
        let currentRaw = rawBuffers[agentId, default: ""]
        rawBuffers[agentId] = scrollbackText + currentRaw

        trimBuffer(forAgent: agentId)

        logger.info("Prepended \(lines.count) scrollback lines to agent \(agentId)")
    }

    // MARK: - Private Helpers

    /// Strip ANSI escape sequences from text.
    ///
    /// Handles common escape patterns:
    /// - CSI sequences: ESC [ ... m (colors, cursor movement, etc.)
    /// - OSC sequences: ESC ] ... BEL|ESC\ (window title, etc.)
    /// - Simple escape codes: ESC followed by a single character
    private func stripANSI(_ text: String) -> String {
        var result = text

        // CSI sequences: ESC [ ... (letter or @)
        let csiPattern = "\\u{1B}\\[[0-9;?]*[a-zA-Z@]"
        result = result.replacingOccurrences(
            of: csiPattern,
            with: "",
            options: .regularExpression
        )

        // OSC sequences: ESC ] ... BEL or ESC ]...ESC\
        let oscPattern1 = "\\u{1B}\\][^\\u{07}]*\\u{07}"
        result = result.replacingOccurrences(
            of: oscPattern1,
            with: "",
            options: .regularExpression
        )

        let oscPattern2 = "\\u{1B}\\][^\\u{1B}]*\\u{1B}\\\\"
        result = result.replacingOccurrences(
            of: oscPattern2,
            with: "",
            options: .regularExpression
        )

        // Simple escape sequences: ESC followed by single char
        let simplePattern = "\\u{1B}[a-zA-Z]"
        result = result.replacingOccurrences(
            of: simplePattern,
            with: "",
            options: .regularExpression
        )

        // Control characters (except newline, tab, carriage return)
        let controlPattern = "[\\u{00}-\\u{08}\\u{0B}-\\u{0C}\\u{0E}-\\u{1F}]"
        result = result.replacingOccurrences(
            of: controlPattern,
            with: "",
            options: .regularExpression
        )

        return result
    }

    /// Trim buffer to maxScrollbackLines by removing oldest lines.
    private func trimBuffer(forAgent agentId: String) {
        guard var lines = buffers[agentId], lines.count > maxScrollbackLines else {
            return
        }

        // Keep only the most recent maxScrollbackLines
        let excess = lines.count - maxScrollbackLines
        lines.removeFirst(excess)
        buffers[agentId] = lines

        logger.info("Trimmed \(excess) lines from agent \(agentId) buffer")

        // Also trim raw buffer (approximate - just keep proportional amount)
        if var raw = rawBuffers[agentId] {
            // Calculate approximate trim point (rough estimate)
            let targetLength = (raw.count * maxScrollbackLines) / (lines.count + excess)
            if raw.count > targetLength {
                let trimIndex = raw.index(raw.startIndex, offsetBy: raw.count - targetLength)
                raw = String(raw[trimIndex...])
                rawBuffers[agentId] = raw
            }
        }
    }
}
