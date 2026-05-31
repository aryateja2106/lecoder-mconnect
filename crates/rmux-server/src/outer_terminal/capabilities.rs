pub(super) fn apply_template_override(
    target: &mut Option<String>,
    value: Option<&str>,
    remove: bool,
) {
    if remove {
        *target = None;
    } else if let Some(value) = value {
        *target = Some(decode_capability_string(value));
    }
}

pub(super) fn parse_capability_override(spec: &str) -> Option<(&str, Option<&str>, bool)> {
    let spec = spec.trim();
    if spec.is_empty() {
        return None;
    }
    if let Some((name, value)) = spec.split_once('=') {
        return Some((name.trim(), Some(value.trim()), false));
    }
    if let Some(name) = spec.strip_suffix('@') {
        return Some((name.trim(), None, true));
    }
    Some((spec, None, false))
}

pub(super) fn split_override_segments(entry: &str) -> Vec<String> {
    let mut segments = Vec::new();
    let mut current = String::new();
    let mut chars = entry.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == ':' {
            if chars.peek() == Some(&':') {
                current.push(':');
                let _ = chars.next();
            } else {
                segments.push(current);
                current = String::new();
            }
        } else {
            current.push(ch);
        }
    }
    segments.push(current);
    segments
}

pub(super) fn decode_capability_string(value: &str) -> String {
    let mut decoded = String::with_capacity(value.len());
    let mut chars = value.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch != '\\' {
            decoded.push(ch);
            continue;
        }

        match chars.peek() {
            Some('0'..='7') => {
                let octal_value = consume_octal(&mut chars);
                if let Some(byte) = char::from_u32(octal_value) {
                    decoded.push(byte);
                }
            }
            _ => match chars.next() {
                Some('E' | 'e') => decoded.push('\x1b'),
                Some('a') => decoded.push('\x07'),
                Some('b') => decoded.push('\x08'),
                Some('f') => decoded.push('\x0c'),
                Some('n') => decoded.push('\n'),
                Some('r') => decoded.push('\r'),
                Some('s') => decoded.push(' '),
                Some('t') => decoded.push('\t'),
                Some('v') => decoded.push('\x0b'),
                Some('\\') => decoded.push('\\'),
                Some(':') => decoded.push(':'),
                Some('^') => {
                    if let Some(ctrl) = chars.next() {
                        if ctrl == '?' {
                            decoded.push('\x7f');
                        } else {
                            decoded.push(char::from((ctrl as u8) & 0x1f));
                        }
                    }
                }
                Some(other) => decoded.push(other),
                None => decoded.push('\\'),
            },
        }
    }

    decoded
}

fn consume_octal(chars: &mut std::iter::Peekable<std::str::Chars<'_>>) -> u32 {
    let mut value: u32 = 0;
    for _ in 0..3 {
        match chars.peek() {
            Some('0'..='7') => {
                let digit = chars.next().unwrap();
                value = (value << 3) | (digit as u32 - '0' as u32);
            }
            _ => break,
        }
    }
    value
}
