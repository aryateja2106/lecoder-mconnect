//! Shared tmux-style fnmatch glob matching.

/// Returns whether `text` matches the tmux-style `pattern`.
#[must_use]
pub fn fnmatch(pattern: &str, text: &str) -> bool {
    let pattern = pattern.chars().collect::<Vec<_>>();
    let text = text.chars().collect::<Vec<_>>();
    fnmatch_from(&pattern, &text, 0, 0)
}

fn fnmatch_from(pattern: &[char], text: &[char], pattern_index: usize, text_index: usize) -> bool {
    if pattern_index == pattern.len() {
        return text_index == text.len();
    }

    match pattern[pattern_index] {
        '*' => {
            // Collapse consecutive stars to prevent exponential recursion.
            let mut next_pattern = pattern_index + 1;
            while next_pattern < pattern.len() && pattern[next_pattern] == '*' {
                next_pattern += 1;
            }
            (text_index..=text.len())
                .any(|next_text| fnmatch_from(pattern, text, next_pattern, next_text))
        }
        '?' => {
            text_index < text.len()
                && fnmatch_from(pattern, text, pattern_index + 1, text_index + 1)
        }
        '[' => {
            if text_index >= text.len() {
                return false;
            }
            if let Some((matched, next_pattern)) =
                bracket_match(pattern, pattern_index, text[text_index])
            {
                matched && fnmatch_from(pattern, text, next_pattern, text_index + 1)
            } else {
                text[text_index] == '['
                    && fnmatch_from(pattern, text, pattern_index + 1, text_index + 1)
            }
        }
        '\\' => {
            let next_pattern = pattern_index + 1;
            let literal = pattern.get(next_pattern).copied().unwrap_or('\\');
            let consumed_pattern = if next_pattern < pattern.len() {
                pattern_index + 2
            } else {
                pattern_index + 1
            };
            text_index < text.len()
                && text[text_index] == literal
                && fnmatch_from(pattern, text, consumed_pattern, text_index + 1)
        }
        literal => {
            text_index < text.len()
                && text[text_index] == literal
                && fnmatch_from(pattern, text, pattern_index + 1, text_index + 1)
        }
    }
}

fn bracket_match(pattern: &[char], start: usize, value: char) -> Option<(bool, usize)> {
    let mut index = start + 1;
    if index >= pattern.len() {
        return None;
    }
    let negated = matches!(pattern[index], '!' | '^');
    if negated {
        index += 1;
    }

    let mut matched = false;
    let mut saw_entry = false;
    while index < pattern.len() {
        if pattern[index] == ']' && saw_entry {
            return Some((matched != negated, index + 1));
        }

        let first = pattern[index];
        if index + 2 < pattern.len() && pattern[index + 1] == '-' && pattern[index + 2] != ']' {
            let last = pattern[index + 2];
            if first <= value && value <= last {
                matched = true;
            }
            index += 3;
        } else {
            if first == value {
                matched = true;
            }
            index += 1;
        }
        saw_entry = true;
    }

    None
}

#[cfg(test)]
mod tests {
    use super::fnmatch;

    #[test]
    fn fnmatch_handles_globs_character_classes_and_escapes() {
        assert!(fnmatch("xterm*", "xterm-256color"));
        assert!(fnmatch("foo[0-9]", "foo7"));
        assert!(fnmatch("literal\\*", "literal*"));
    }

    #[test]
    fn fnmatch_rejects_non_matching_values() {
        assert!(!fnmatch("xterm?", "xterm-256color"));
        assert!(!fnmatch("foo[!0-9]", "foo7"));
    }

    #[test]
    fn fnmatch_empty_patterns_and_texts() {
        assert!(fnmatch("", ""));
        assert!(!fnmatch("", "a"));
        assert!(!fnmatch("a", ""));
        assert!(fnmatch("*", ""));
        assert!(fnmatch("*", "anything"));
    }

    #[test]
    fn fnmatch_consecutive_stars_collapse() {
        assert!(fnmatch("**", "abc"));
        assert!(fnmatch("***", ""));
        assert!(fnmatch("a**b", "ab"));
        assert!(fnmatch("a**b", "aXYZb"));
        assert!(!fnmatch("a**b", "aXYZc"));
    }

    #[test]
    fn fnmatch_unterminated_bracket_matches_literal() {
        assert!(fnmatch("[", "["));
        assert!(!fnmatch("[", "a"));
        assert!(fnmatch("[abc", "[abc"));
        assert!(!fnmatch("[abc", "a"));
    }

    #[test]
    fn fnmatch_bracket_with_caret_negation() {
        assert!(fnmatch("[^a]", "b"));
        assert!(!fnmatch("[^a]", "a"));
    }

    #[test]
    fn fnmatch_bracket_closing_bracket_as_first_entry() {
        // `]` as first character in bracket is treated as literal until
        // a subsequent `]` closes the class.
        assert!(fnmatch("[]]", "]"));
    }

    #[test]
    fn fnmatch_trailing_backslash_matches_literal() {
        assert!(fnmatch("abc\\", "abc\\"));
        assert!(!fnmatch("abc\\", "abc"));
    }

    #[test]
    fn fnmatch_question_mark_matches_single_char() {
        assert!(fnmatch("?", "x"));
        assert!(!fnmatch("?", ""));
        assert!(!fnmatch("?", "xy"));
    }

    #[test]
    fn fnmatch_terminal_feature_patterns() {
        // Real patterns from terminal-features defaults.
        assert!(fnmatch("xterm*", "xterm-256color"));
        assert!(fnmatch("xterm*", "xterm-kitty"));
        assert!(fnmatch("screen*", "screen-256color"));
        assert!(fnmatch("rxvt*", "rxvt-unicode-256color"));
        assert!(fnmatch("linux*", "linux"));
        assert!(!fnmatch("xterm*", "tmux-256color"));
    }
}
