/// Scans `s` for the first byte in `end` at bracket depth 0, respecting `#{`/`}`
/// nesting and `#,`, `##`, `#}`, `#{`, `#:` escape sequences.
///
/// Returns the byte offset into `s` of the delimiter, or `None` if not found.
pub(super) fn format_skip(s: &[u8], end: &[u8]) -> Option<usize> {
    let mut brackets: i32 = 0;
    let mut i = 0;

    while i < s.len() {
        let ch = s[i];

        // Opening `#{` increases bracket depth.
        if ch == b'#' && s.get(i + 1) == Some(&b'{') {
            brackets += 1;
        }

        // Escape sequences: `#` followed by one of `,`, `#`, `{`, `}`, `:`.
        if ch == b'#' && i + 1 < s.len() && b",#{}:".contains(&s[i + 1]) {
            i += 2;
            continue;
        }

        // Closing `}` decreases bracket depth.
        if ch == b'}' {
            brackets -= 1;
        }

        // Check if we hit a delimiter at depth 0.
        if end.contains(&ch) && brackets == 0 {
            return Some(i);
        }

        i += 1;
    }

    None
}

/// Public wrapper around tmux's nesting-aware delimiter scanner.
///
/// This is used by renderer-side `#[...]` consumers so they can match tmux's
/// bracket handling instead of scanning for a raw `]`.
#[must_use]
pub fn format_skip_delimiter(value: &str, end: &[u8]) -> Option<usize> {
    format_skip(value.as_bytes(), end)
}
