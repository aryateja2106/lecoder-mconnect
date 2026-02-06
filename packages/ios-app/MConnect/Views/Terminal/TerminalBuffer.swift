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

    /// Maximum raw buffer size in bytes per agent (2MB default).
    let maxRawBufferSize: Int

    // MARK: - Per-Agent Buffers

    /// Per-agent line buffers (ANSI stripped for display).
    private var buffers: [String: [String]] = [:]

    /// Per-agent raw output (preserves ANSI for SwiftTerm).
    private var rawBuffers: [String: String] = [:]

    /// Cached display text per agent to avoid rejoining all lines.
    private var displayTextCache: [String: String] = [:]

    /// Number of lines already in the cache per agent.
    private var cachedLineCount: [String: Int] = [:]

    // MARK: - Logger

    private let logger = Logger(subsystem: "com.lecoder.mconnect", category: "TerminalBuffer")

    // MARK: - Init

    init(maxScrollbackLines: Int = 10_000, maxRawBufferSize: Int = 2 * 1024 * 1024) {
        self.maxScrollbackLines = maxScrollbackLines
        self.maxRawBufferSize = maxRawBufferSize
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

        // Trim raw buffer if it exceeds size limit
        if let raw = rawBuffers[agentId], raw.utf8.count > maxRawBufferSize {
            let excess = raw.utf8.count - maxRawBufferSize
            // Find a safe trim point (after a newline if possible)
            if let trimRange = raw.range(of: "\n", range: raw.index(raw.startIndex, offsetBy: excess)..<raw.endIndex) {
                rawBuffers[agentId] = String(raw[trimRange.upperBound...])
            } else {
                let trimIndex = raw.index(raw.startIndex, offsetBy: excess)
                rawBuffers[agentId] = String(raw[trimIndex...])
            }
        }

        logger.debug("Appended \(data.count) bytes to agent \(agentId), now \(currentBuffer.count) lines")
    }

    /// Get display text for an agent (ANSI stripped for plain text fallback).
    ///
    /// Uses incremental caching to avoid rejoining all lines on every call.
    func displayText(forAgent agentId: String) -> String {
        guard let lines = buffers[agentId] else { return "" }

        let cachedCount = cachedLineCount[agentId, default: 0]

        if cachedCount == lines.count {
            // Cache is up to date
            return displayTextCache[agentId] ?? ""
        }

        if cachedCount == 0 || cachedCount > lines.count {
            // Full rebuild needed (cleared or trimmed)
            let text = lines.joined(separator: "\n")
            displayTextCache[agentId] = text
            cachedLineCount[agentId] = lines.count
            return text
        }

        // Incremental: append only new lines
        let newLines = lines[cachedCount...]
        let newText = newLines.joined(separator: "\n")
        let cached = displayTextCache[agentId] ?? ""
        let updated = cached.isEmpty ? newText : cached + "\n" + newText
        displayTextCache[agentId] = updated
        cachedLineCount[agentId] = lines.count
        return updated
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
        displayTextCache.removeValue(forKey: agentId)
        cachedLineCount.removeValue(forKey: agentId)
        logger.info("Cleared buffer for agent \(agentId)")
    }

    /// Clear all buffers.
    func clearAll() {
        buffers.removeAll()
        rawBuffers.removeAll()
        displayTextCache.removeAll()
        cachedLineCount.removeAll()
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

        // Invalidate cache since content changed at beginning
        displayTextCache.removeValue(forKey: agentId)
        cachedLineCount.removeValue(forKey: agentId)

        trimBuffer(forAgent: agentId)

        logger.info("Prepended \(lines.count) scrollback lines to agent \(agentId)")
    }

    // MARK: - Private Helpers

    /// Strip ANSI escape sequences from text using a single-pass character scanner.
    ///
    /// Handles common escape patterns:
    /// - CSI sequences: ESC [ ... m (colors, cursor movement, etc.)
    /// - OSC sequences: ESC ] ... BEL|ESC\ (window title, etc.)
    /// - Simple escape codes: ESC followed by a single character
    ///
    /// This is significantly faster than multiple regex replacements for large output.
    private func stripANSI(_ text: String) -> String {
        var result = ""
        result.reserveCapacity(text.count)
        var iterator = text.unicodeScalars.makeIterator()

        while let scalar = iterator.next() {
            if scalar == "\u{1B}" {
                // Start of escape sequence
                guard let next = iterator.next() else { break }
                if next == "[" {
                    // CSI sequence: consume until letter or @
                    while let ch = iterator.next() {
                        if (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || ch == "@" {
                            break
                        }
                    }
                } else if next == "]" {
                    // OSC sequence: consume until BEL or ESC\
                    while let ch = iterator.next() {
                        if ch == "\u{07}" { break }
                        if ch == "\u{1B}" {
                            let _ = iterator.next() // consume the \
                            break
                        }
                    }
                }
                // else: simple escape - next char already consumed
            } else if scalar.value < 0x20 && scalar != "\n" && scalar != "\t" && scalar != "\r" {
                // Control character - skip
            } else {
                result.unicodeScalars.append(scalar)
            }
        }

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

        // Invalidate cache since lines were removed from the beginning
        displayTextCache.removeValue(forKey: agentId)
        cachedLineCount.removeValue(forKey: agentId)

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
