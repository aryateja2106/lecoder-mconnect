const KITTY_GRAPHICS_APC_START: &[u8] = b"\x1b_G";
const STRING_TERMINATOR: &[u8] = b"\x1b\\";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum KittyGraphicsApcDecode {
    NotKittyGraphics,
    Partial,
    Matched { size: usize },
}

pub(super) fn decode_kitty_graphics_apc(input: &[u8]) -> KittyGraphicsApcDecode {
    if input.starts_with(KITTY_GRAPHICS_APC_START) {
        let body = &input[KITTY_GRAPHICS_APC_START.len()..];
        if let Some(end_offset) = find_subslice(body, STRING_TERMINATOR) {
            return KittyGraphicsApcDecode::Matched {
                size: KITTY_GRAPHICS_APC_START.len() + end_offset + STRING_TERMINATOR.len(),
            };
        }
        return KittyGraphicsApcDecode::Partial;
    }

    KittyGraphicsApcDecode::NotKittyGraphics
}

fn find_subslice(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

#[cfg(test)]
mod tests {
    use super::{decode_kitty_graphics_apc, KittyGraphicsApcDecode};

    #[test]
    fn matches_through_string_terminator() {
        assert_eq!(
            decode_kitty_graphics_apc(b"\x1b_Gi=1;OK\x1b\\tail"),
            KittyGraphicsApcDecode::Matched { size: 11 }
        );
    }

    #[test]
    fn retains_complete_start_without_terminator() {
        assert_eq!(
            decode_kitty_graphics_apc(b"\x1b_Gi=1;OK"),
            KittyGraphicsApcDecode::Partial
        );
    }

    #[test]
    fn leaves_meta_underscore_for_key_decoder() {
        assert_eq!(
            decode_kitty_graphics_apc(b"\x1b_"),
            KittyGraphicsApcDecode::NotKittyGraphics
        );
    }

    #[test]
    fn ignores_non_kitty_apc_payloads() {
        assert_eq!(
            decode_kitty_graphics_apc(b"\x1b_title\x1b\\"),
            KittyGraphicsApcDecode::NotKittyGraphics
        );
    }
}
