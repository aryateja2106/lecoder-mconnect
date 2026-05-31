/// Returns whether an APC payload is a Kitty graphics command.
///
/// Kitty graphics commands are APC strings whose payload starts with `G`.
/// The full escape sequence is `ESC _ G<control data>;<payload> ESC \`.
pub(crate) fn is_kitty_graphics_apc(payload: &[u8]) -> bool {
    payload.first() == Some(&b'G')
}

#[cfg(test)]
mod tests {
    use super::is_kitty_graphics_apc;

    #[test]
    fn identifies_kitty_graphics_payloads() {
        assert!(is_kitty_graphics_apc(b"Gf=100;AAAA"));
        assert!(is_kitty_graphics_apc(b"Gm=0;"));
        assert!(!is_kitty_graphics_apc(b"APC Title"));
        assert!(!is_kitty_graphics_apc(b""));
    }
}
