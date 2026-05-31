use crate::input::GridAttr;

use super::{StyleRange, StyleWidth};

const ATTR_TOKEN_DELIMITERS: &[char] = &[' ', ',', '|'];
const USER_RANGE_MAX_CHARS: usize = 15;

pub(super) fn parse_range(value: &str) -> Option<StyleRange> {
    let (kind, argument) = match value.split_once('|') {
        Some((kind, argument)) => (kind, Some(argument)),
        None => (value, None),
    };

    if kind.eq_ignore_ascii_case("left") {
        return argument.is_none().then_some(StyleRange::Left);
    }
    if kind.eq_ignore_ascii_case("right") {
        return argument.is_none().then_some(StyleRange::Right);
    }
    if kind.eq_ignore_ascii_case("control") {
        let argument = argument?;
        let value = argument.parse::<u8>().ok()?;
        return (value <= 9).then_some(StyleRange::Control(value));
    }
    if kind.eq_ignore_ascii_case("pane") {
        let argument = argument?;
        let id = argument.strip_prefix('%')?;
        return Some(StyleRange::Pane(id.parse::<u32>().ok()?));
    }
    if kind.eq_ignore_ascii_case("window") {
        let argument = argument?;
        return Some(StyleRange::Window(argument.parse::<u32>().ok()?));
    }
    if kind.eq_ignore_ascii_case("session") {
        let argument = argument?;
        let id = argument.strip_prefix('$')?;
        return Some(StyleRange::Session(id.parse::<u32>().ok()?));
    }
    if kind.eq_ignore_ascii_case("user") {
        let argument = argument?;
        if argument.is_empty() || argument.chars().count() > USER_RANGE_MAX_CHARS {
            return None;
        }
        return Some(StyleRange::User(argument.to_owned()));
    }

    None
}

pub(super) fn parse_width(value: &str) -> Option<StyleWidth> {
    if let Some(value) = value.strip_suffix('%') {
        let value = value.parse::<u8>().ok()?;
        return (value <= 100).then_some(StyleWidth::Percentage(value));
    }
    value.parse::<u32>().ok().map(StyleWidth::Cells)
}

pub(super) fn parse_attributes(value: &str) -> Option<u16> {
    if value.is_empty() || value.ends_with(ATTR_TOKEN_DELIMITERS) {
        return None;
    }

    if value.eq_ignore_ascii_case("default") || value.eq_ignore_ascii_case("none") {
        return Some(0);
    }

    let mut attr = 0;
    for token in value.split(|character| ATTR_TOKEN_DELIMITERS.contains(&character)) {
        if token.is_empty() {
            return None;
        }
        attr |= match token.to_ascii_lowercase().as_str() {
            "acs" => GridAttr::CHARSET,
            "bright" | "bold" => GridAttr::BRIGHT,
            "dim" => GridAttr::DIM,
            "underscore" => GridAttr::UNDERSCORE,
            "blink" => GridAttr::BLINK,
            "reverse" => GridAttr::REVERSE,
            "hidden" => GridAttr::HIDDEN,
            "italics" => GridAttr::ITALICS,
            "strikethrough" => GridAttr::STRIKETHROUGH,
            "double-underscore" => GridAttr::UNDERSCORE_2,
            "curly-underscore" => GridAttr::UNDERSCORE_3,
            "dotted-underscore" => GridAttr::UNDERSCORE_4,
            "dashed-underscore" => GridAttr::UNDERSCORE_5,
            "overline" => GridAttr::OVERLINE,
            _ => return None,
        };
    }
    Some(attr)
}

pub(super) fn attributes_to_string(attr: u16) -> String {
    if attr == 0 {
        return "none".to_owned();
    }

    let mut tokens = Vec::new();
    for (mask, name) in [
        (GridAttr::CHARSET, "acs"),
        (GridAttr::BRIGHT, "bright"),
        (GridAttr::DIM, "dim"),
        (GridAttr::UNDERSCORE, "underscore"),
        (GridAttr::BLINK, "blink"),
        (GridAttr::REVERSE, "reverse"),
        (GridAttr::HIDDEN, "hidden"),
        (GridAttr::ITALICS, "italics"),
        (GridAttr::STRIKETHROUGH, "strikethrough"),
        (GridAttr::UNDERSCORE_2, "double-underscore"),
        (GridAttr::UNDERSCORE_3, "curly-underscore"),
        (GridAttr::UNDERSCORE_4, "dotted-underscore"),
        (GridAttr::UNDERSCORE_5, "dashed-underscore"),
        (GridAttr::OVERLINE, "overline"),
        (GridAttr::NOATTR, "noattr"),
    ] {
        if attr & mask != 0 {
            tokens.push(name);
        }
    }
    tokens.join(",")
}

/// Strips a case-insensitive prefix, returning the remainder with its
/// original casing intact (important for colour values like `#FF0000`).
pub(super) fn strip_prefix_ci<'a>(value: &'a str, prefix: &str) -> Option<&'a str> {
    (value.len() >= prefix.len() && value[..prefix.len()].eq_ignore_ascii_case(prefix))
        .then(|| &value[prefix.len()..])
}
