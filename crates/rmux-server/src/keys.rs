#[cfg(test)]
use rmux_core::{key_code_to_bytes, key_string_lookup_string, KeyCode};
#[cfg(not(test))]
use rmux_core::{key_string_lookup_string, KeyCode};

#[cfg(test)]
pub(crate) fn resolve_key(token: &str) -> Vec<u8> {
    key_string_lookup_string(token)
        .and_then(key_code_to_bytes)
        .unwrap_or_else(|| token.as_bytes().to_vec())
}

pub(crate) fn resolve_hex_key(token: &str) -> Option<u8> {
    let token = token.strip_prefix("0x").unwrap_or(token);
    u8::from_str_radix(token, 16).ok()
}

pub(crate) fn parse_key_code(token: &str) -> Option<KeyCode> {
    key_string_lookup_string(token)
}

#[cfg(test)]
mod tests {
    use super::{parse_key_code, resolve_hex_key, resolve_key};

    #[test]
    fn named_keys_resolve_to_tmux_bytes() {
        assert_eq!(resolve_key("Enter"), b"\r");
        assert_eq!(resolve_key("C-c"), [0x03]);
    }

    #[test]
    fn unknown_keys_fall_back_to_literal_utf8() {
        assert_eq!(resolve_key("hello"), b"hello");
        assert_eq!(resolve_key("é"), "é".as_bytes());
    }

    #[test]
    fn hex_keys_accept_optional_prefix() {
        assert_eq!(resolve_hex_key("41"), Some(b'A'));
        assert_eq!(resolve_hex_key("0x0d"), Some(0x0d));
    }

    #[test]
    fn key_codes_parse_named_and_mouse_keys() {
        assert!(parse_key_code("C-b").is_some());
        assert!(parse_key_code("WheelUpPane").is_some());
    }
}
