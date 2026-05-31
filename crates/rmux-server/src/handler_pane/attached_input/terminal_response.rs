#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum TerminalResponseDecode {
    NotResponse,
    Partial,
    Matched { size: usize },
}

pub(super) fn decode_terminal_response(input: &[u8]) -> TerminalResponseDecode {
    if !input.starts_with(b"\x1b[") {
        return TerminalResponseDecode::NotResponse;
    }

    let Some(final_offset) = input[2..].iter().position(|byte| is_csi_final(*byte)) else {
        return if is_plausible_terminal_response_prefix(input) {
            TerminalResponseDecode::Partial
        } else {
            TerminalResponseDecode::NotResponse
        };
    };
    let final_index = final_offset + 2;
    match input[final_index] {
        b'R' | b'c' | b'n' | b't' => TerminalResponseDecode::Matched {
            size: final_index + 1,
        },
        _ => TerminalResponseDecode::NotResponse,
    }
}

fn is_plausible_terminal_response_prefix(input: &[u8]) -> bool {
    input
        .get(2)
        .is_some_and(|byte| *byte == b'?' || *byte == b'>' || byte.is_ascii_digit())
}

fn is_csi_final(byte: u8) -> bool {
    (0x40..=0x7e).contains(&byte)
}

#[cfg(test)]
mod tests {
    use super::{decode_terminal_response, TerminalResponseDecode};

    #[test]
    fn matches_primary_device_attributes_response() {
        assert_eq!(
            decode_terminal_response(b"\x1b[?62;52;ctail"),
            TerminalResponseDecode::Matched { size: 10 }
        );
    }

    #[test]
    fn matches_cursor_position_response() {
        assert_eq!(
            decode_terminal_response(b"\x1b[12;40R"),
            TerminalResponseDecode::Matched { size: 8 }
        );
    }

    #[test]
    fn retains_fragmented_responses() {
        assert_eq!(
            decode_terminal_response(b"\x1b[?62;52"),
            TerminalResponseDecode::Partial
        );
    }

    #[test]
    fn leaves_arrow_keys_for_key_decoder() {
        assert_eq!(
            decode_terminal_response(b"\x1b[A"),
            TerminalResponseDecode::NotResponse
        );
    }

    #[test]
    fn leaves_extended_keys_for_key_decoder() {
        assert_eq!(
            decode_terminal_response(b"\x1b[27;2;65u"),
            TerminalResponseDecode::NotResponse
        );
    }
}
