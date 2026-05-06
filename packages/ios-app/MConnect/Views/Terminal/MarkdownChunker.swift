import Foundation

/// Classifies ANSI-stripped terminal output into semantic chunks for markdown rendering.
///
/// Heuristics (applied per line):
/// - Lines starting with `> ` or `❯ ` → `.assistantMessage`
/// - Lines starting with `$ ` or `➜ ` → `.command`
/// - Triple-backtick fences → `.codeBlock(language:body:)`
/// - Everything else → `.output`
///
/// Adjacent lines of the same kind are merged into a single chunk.
enum MarkdownChunker {

    // MARK: - Chunk Type

    enum Chunk: Equatable {
        /// A shell command line (prefix stripped).
        case command(String)
        /// Raw terminal output (non-classified lines).
        case output(String)
        /// An assistant / agent prose response.
        case assistantMessage(String)
        /// A fenced code block.
        case codeBlock(language: String?, body: String)
    }

    // MARK: - Public API

    /// Parse `cleaned` text (already ANSI-stripped) into an array of `Chunk` values.
    static func chunks(from cleaned: String) -> [Chunk] {
        var result: [Chunk] = []
        let lines = cleaned.components(separatedBy: .newlines)
        var index = 0

        while index < lines.count {
            let line = lines[index]

            // --- Code fence ---
            if line.hasPrefix("```") {
                let language: String? = {
                    let tag = String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                    return tag.isEmpty ? nil : tag
                }()
                index += 1
                var bodyLines: [String] = []
                while index < lines.count && !lines[index].hasPrefix("```") {
                    bodyLines.append(lines[index])
                    index += 1
                }
                if index < lines.count { index += 1 } // consume closing ```
                result.append(.codeBlock(language: language, body: bodyLines.joined(separator: "\n")))
                continue
            }

            // --- Classify single line ---
            let kind = classify(line)

            // Accumulate adjacent lines of the same kind
            var accumulated = [stripped(line, for: kind)]
            index += 1

            while index < lines.count {
                let next = lines[index]
                // Never greedily consume a code fence start
                if next.hasPrefix("```") { break }
                guard classify(next) == kind else { break }
                accumulated.append(stripped(next, for: kind))
                index += 1
            }

            let body = accumulated.joined(separator: "\n")
            switch kind {
            case .command:        result.append(.command(body))
            case .output:         result.append(.output(body))
            case .assistantMessage: result.append(.assistantMessage(body))
            case .codeBlock:      break // handled above
            }
        }

        return result
    }

    // MARK: - Private

    private enum LineKind: Equatable {
        case command, output, assistantMessage, codeBlock
    }

    private static func classify(_ line: String) -> LineKind {
        if line.hasPrefix("> ") || line.hasPrefix("❯ ") {
            return .assistantMessage
        }
        if line.hasPrefix("$ ") || line.hasPrefix("➜ ") {
            return .command
        }
        return .output
    }

    /// Strip the leading prefix for the given kind so the body is clean.
    private static func stripped(_ line: String, for kind: LineKind) -> String {
        switch kind {
        case .command:
            if line.hasPrefix("$ ") { return String(line.dropFirst(2)) }
            if line.hasPrefix("➜ ") { return String(line.dropFirst(2)) }
            return line
        case .assistantMessage:
            if line.hasPrefix("> ") { return String(line.dropFirst(2)) }
            if line.hasPrefix("❯ ") { return String(line.dropFirst(2)) }
            return line
        case .output, .codeBlock:
            return line
        }
    }
}
