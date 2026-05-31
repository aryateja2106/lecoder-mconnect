use rmux_core::input::mode;

const MOUSE_PARAM_MAX: u16 = 0xff;
const MOUSE_PARAM_UTF8_MAX: u16 = 0x7ff;
const MOUSE_PARAM_BTN_OFF: u16 = 0x20;
const MOUSE_PARAM_POS_OFF: u16 = 0x21;

const MOUSE_MASK_BUTTONS: u16 = 195;
const MOUSE_MASK_DRAG: u16 = 32;
const MOUSE_WHEEL_UP: u16 = 64;
const MOUSE_WHEEL_DOWN: u16 = 65;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct MouseForwardEvent {
    pub(crate) b: u16,
    pub(crate) lb: u16,
    pub(crate) x: u16,
    pub(crate) y: u16,
    pub(crate) lx: u16,
    pub(crate) ly: u16,
    pub(crate) sgr_b: u16,
    pub(crate) sgr_type: char,
    pub(crate) ignore: bool,
}

impl MouseForwardEvent {
    #[cfg(test)]
    pub(super) fn button_event(b: u16, x: u16, y: u16) -> Self {
        Self {
            b,
            lb: b,
            x,
            y,
            lx: x,
            ly: y,
            sgr_b: b,
            sgr_type: ' ',
            ignore: false,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum MouseDecode {
    Invalid,
    Partial,
    Discard {
        size: usize,
    },
    Matched {
        size: usize,
        event: MouseForwardEvent,
    },
}

pub(crate) fn encode_mouse_event(
    pane_mode: u32,
    event: &MouseForwardEvent,
    x: u16,
    y: u16,
) -> Option<Vec<u8>> {
    if event.ignore || (pane_mode & mode::ALL_MOUSE_MODES) == 0 {
        return None;
    }

    if mouse_drag(event.b) && (pane_mode & motion_mouse_modes()) == 0 {
        return None;
    }
    if sgr_release_discard(event, pane_mode) {
        return None;
    }

    // Only use SGR encoding when both the application requested it AND the
    // source event was SGR format. A legacy mouse release cannot be converted
    // to SGR because the released button identity is unknown.
    if event.sgr_type != ' ' && (pane_mode & mode::MODE_MOUSE_SGR) != 0 {
        return Some(
            format!(
                "\x1b[<{};{};{}{}",
                event.sgr_b,
                x + 1,
                y + 1,
                event.sgr_type
            )
            .into_bytes(),
        );
    }

    if (pane_mode & mode::MODE_MOUSE_UTF8) != 0 {
        if event.b > MOUSE_PARAM_UTF8_MAX - MOUSE_PARAM_BTN_OFF
            || x > MOUSE_PARAM_UTF8_MAX - MOUSE_PARAM_POS_OFF
            || y > MOUSE_PARAM_UTF8_MAX - MOUSE_PARAM_POS_OFF
        {
            return None;
        }
        let mut bytes = b"\x1b[M".to_vec();
        append_utf8_mouse_value(event.b + MOUSE_PARAM_BTN_OFF, &mut bytes);
        append_utf8_mouse_value(x + MOUSE_PARAM_POS_OFF, &mut bytes);
        append_utf8_mouse_value(y + MOUSE_PARAM_POS_OFF, &mut bytes);
        return Some(bytes);
    }

    if event.b + MOUSE_PARAM_BTN_OFF > MOUSE_PARAM_MAX {
        return None;
    }

    let mut bytes = b"\x1b[M".to_vec();
    bytes.push((event.b + MOUSE_PARAM_BTN_OFF) as u8);
    bytes.push((x + MOUSE_PARAM_POS_OFF).min(MOUSE_PARAM_MAX) as u8);
    bytes.push((y + MOUSE_PARAM_POS_OFF).min(MOUSE_PARAM_MAX) as u8);
    Some(bytes)
}

pub(crate) fn decode_mouse(input: &[u8], last: Option<MouseForwardEvent>) -> MouseDecode {
    if input.first() != Some(&0x1b) {
        return MouseDecode::Invalid;
    }
    if input.len() == 1 {
        return MouseDecode::Partial;
    }
    if input[1] != b'[' {
        return MouseDecode::Invalid;
    }
    if input.len() == 2 {
        return MouseDecode::Partial;
    }

    if input[2] == b'M' {
        if input.len() < 6 {
            return MouseDecode::Partial;
        }
        let b = u16::from(input[3]);
        let x = u16::from(input[4]);
        let y = u16::from(input[5]);
        if b < MOUSE_PARAM_BTN_OFF || x < MOUSE_PARAM_POS_OFF || y < MOUSE_PARAM_POS_OFF {
            return MouseDecode::Discard { size: 6 };
        }
        let previous = last.unwrap_or(MouseForwardEvent {
            b: 0,
            lb: 0,
            x: 0,
            y: 0,
            lx: 0,
            ly: 0,
            sgr_b: 0,
            sgr_type: ' ',
            ignore: false,
        });
        return MouseDecode::Matched {
            size: 6,
            event: MouseForwardEvent {
                lx: previous.x,
                ly: previous.y,
                lb: previous.b,
                b: b - MOUSE_PARAM_BTN_OFF,
                x: x - MOUSE_PARAM_POS_OFF,
                y: y - MOUSE_PARAM_POS_OFF,
                sgr_b: 0,
                sgr_type: ' ',
                ignore: false,
            },
        };
    }

    if input[2] != b'<' {
        return MouseDecode::Invalid;
    }

    let Some((b, offset_after_b)) = parse_mouse_decimal(input, 3) else {
        return MouseDecode::Partial;
    };
    let Some((x, offset_after_x)) = parse_mouse_decimal(input, offset_after_b + 1) else {
        return MouseDecode::Partial;
    };
    let Some((y, offset_after_y)) = parse_mouse_decimal(input, offset_after_x + 1) else {
        return MouseDecode::Partial;
    };
    let Some(&terminator) = input.get(offset_after_y) else {
        return MouseDecode::Partial;
    };
    if terminator != b'M' && terminator != b'm' {
        return MouseDecode::Invalid;
    }
    if x < 1 || y < 1 {
        return MouseDecode::Discard {
            size: offset_after_y + 1,
        };
    }
    if terminator == b'm' && mouse_wheel(b) {
        return MouseDecode::Discard {
            size: offset_after_y + 1,
        };
    }

    let previous = last.unwrap_or(MouseForwardEvent {
        b: 0,
        lb: 0,
        x: 0,
        y: 0,
        lx: 0,
        ly: 0,
        sgr_b: 0,
        sgr_type: ' ',
        ignore: false,
    });
    let sgr_b = b;
    let b = if terminator == b'm' { 3 } else { b };
    MouseDecode::Matched {
        size: offset_after_y + 1,
        event: MouseForwardEvent {
            lx: previous.x,
            ly: previous.y,
            lb: previous.b,
            b,
            x: x - 1,
            y: y - 1,
            sgr_b,
            sgr_type: terminator as char,
            ignore: false,
        },
    }
}

fn motion_mouse_modes() -> u32 {
    mode::MODE_MOUSE_BUTTON | mode::MODE_MOUSE_ALL
}

fn sgr_release_discard(event: &MouseForwardEvent, pane_mode: u32) -> bool {
    if event.sgr_type != ' ' {
        return mouse_drag(event.sgr_b)
            && mouse_release(event.sgr_b)
            && (pane_mode & mode::MODE_MOUSE_ALL) == 0;
    }
    mouse_drag(event.b)
        && mouse_release(event.b)
        && mouse_release(event.lb)
        && (pane_mode & mode::MODE_MOUSE_ALL) == 0
}

fn append_utf8_mouse_value(value: u16, output: &mut Vec<u8>) {
    if value <= 0x7f {
        output.push(value as u8);
        return;
    }

    output.push((0b1100_0000 | ((value >> 6) as u8)) & 0b1101_1111);
    output.push(0b1000_0000 | (value as u8 & 0b0011_1111));
}

fn parse_mouse_decimal(input: &[u8], start: usize) -> Option<(u16, usize)> {
    let mut index = start;
    let mut value = 0_u16;
    while let Some(&byte) = input.get(index) {
        if byte == b';' || byte == b'M' || byte == b'm' {
            return Some((value, index));
        }
        if !byte.is_ascii_digit() {
            return None;
        }
        value = value.checked_mul(10)?.checked_add(u16::from(byte - b'0'))?;
        index += 1;
    }
    None
}

fn mouse_wheel(button: u16) -> bool {
    let buttons = mouse_buttons(button);
    buttons == MOUSE_WHEEL_UP || buttons == MOUSE_WHEEL_DOWN
}

fn mouse_drag(button: u16) -> bool {
    (button & MOUSE_MASK_DRAG) != 0
}

fn mouse_release(button: u16) -> bool {
    mouse_buttons(button) == 3
}

fn mouse_buttons(button: u16) -> u16 {
    button & MOUSE_MASK_BUTTONS
}
