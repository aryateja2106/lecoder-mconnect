import Foundation

/// Utility for stripping ANSI terminal escape sequences from raw terminal output.
///
/// Handles:
/// - CSI sequences: ESC [ ... final-byte  (SGR, cursor, erase, etc.)
/// - OSC sequences: ESC ] ... BEL         (window title, hyperlinks, etc.)
/// - C1 control codes: ESC followed by single char
/// - BEL character (U+0007)
/// - Tab expansion to 4 spaces
enum ANSIStripper {

    // MARK: - Public API

    /// Strip all ANSI escape sequences from `raw` and return clean text.
    ///
    /// - Tab characters are replaced with 4 spaces.
    /// - BEL (U+0007) characters are removed.
    /// - All other printable characters and newlines are preserved.
    static func strip(_ raw: String) -> String {
        var result = ""
        result.reserveCapacity(raw.unicodeScalars.count)
        var iter = raw.unicodeScalars.makeIterator()

        while let scalar = iter.next() {
            switch scalar.value {
            case 0x1B: // ESC
                guard let next = iter.next() else { break }
                switch next.value {
                case 0x5B: // '[' — CSI sequence: ESC [ params final
                    consumeCSI(&iter)
                case 0x5D: // ']' — OSC sequence: ESC ] ... BEL or ESC\
                    consumeOSC(&iter)
                default:
                    // Simple two-char escape (e.g. ESC= ESC> ESC7 ESC8) — already consumed
                    break
                }
            case 0x07: // BEL — discard
                break
            case 0x09: // TAB — expand to 4 spaces
                result.append("    ")
            case 0x0A, 0x0D: // LF, CR — preserve
                result.unicodeScalars.append(scalar)
            case 0x00..<0x20: // Other C0 controls — discard
                break
            default:
                result.unicodeScalars.append(scalar)
            }
        }

        return result
    }

    // MARK: - Private Helpers

    /// Consume a CSI sequence body: zero or more parameter/intermediate bytes, then one final byte.
    /// Parameter bytes: 0x30–0x3F  (?@A–Z[\]^_ are also in range but handled as final).
    /// Intermediate bytes: 0x20–0x2F
    /// Final byte: 0x40–0x7E
    private static func consumeCSI(_ iter: inout String.UnicodeScalarView.Iterator) {
        while let ch = iter.next() {
            let v = ch.value
            if (0x40...0x7E).contains(v) {
                // Final byte — done
                return
            }
            // Parameter (0x30–0x3F) and intermediate (0x20–0x2F) bytes — continue
        }
    }

    /// Consume an OSC sequence body until BEL (U+0007) or ESC \ (string terminator).
    private static func consumeOSC(_ iter: inout String.UnicodeScalarView.Iterator) {
        while let ch = iter.next() {
            switch ch.value {
            case 0x07: // BEL — end of OSC
                return
            case 0x1B: // ESC — expect '\' (ST)
                _ = iter.next() // consume the '\'
                return
            default:
                break
            }
        }
    }
}
