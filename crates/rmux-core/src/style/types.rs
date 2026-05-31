use crate::input::{Colour, COLOUR_DEFAULT};

/// Shared cell colours and attributes used by [`Style`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StyleCell {
    /// Foreground colour.
    pub fg: Colour,
    /// Background colour.
    pub bg: Colour,
    /// Underline colour.
    pub us: Colour,
    /// Attribute bitset, including `GridAttr::NOATTR`.
    pub attr: u16,
}

impl Default for StyleCell {
    fn default() -> Self {
        Self {
            fg: COLOUR_DEFAULT,
            bg: COLOUR_DEFAULT,
            us: COLOUR_DEFAULT,
            attr: 0,
        }
    }
}

/// Horizontal alignment directive from tmux `style_align`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum StyleAlign {
    /// No explicit alignment override.
    #[default]
    Default,
    /// Left aligned.
    Left,
    /// Centred.
    Centre,
    /// Right aligned.
    Right,
    /// Absolutely centred.
    AbsoluteCentre,
}

impl StyleAlign {
    pub(super) fn as_tmux_str(self) -> Option<&'static str> {
        match self {
            Self::Default => None,
            Self::Left => Some("left"),
            Self::Centre => Some("centre"),
            Self::Right => Some("right"),
            Self::AbsoluteCentre => Some("absolute-centre"),
        }
    }
}

/// List drawing directive from tmux `style_list`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum StyleList {
    /// Outside list rendering.
    #[default]
    Off,
    /// Inside the list body.
    On,
    /// Inside the focused list entry.
    Focus,
    /// Inside the left marker.
    LeftMarker,
    /// Inside the right marker.
    RightMarker,
}

impl StyleList {
    pub(super) fn as_tmux_str(self) -> Option<&'static str> {
        match self {
            Self::Off => None,
            Self::On => Some("on"),
            Self::Focus => Some("focus"),
            Self::LeftMarker => Some("left-marker"),
            Self::RightMarker => Some("right-marker"),
        }
    }
}

/// Range directive from tmux `style_range_type`.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum StyleRange {
    /// No active range.
    #[default]
    None,
    /// Left side status range.
    Left,
    /// Right side status range.
    Right,
    /// Pane-linked range.
    Pane(u32),
    /// Window-linked range.
    Window(u32),
    /// Session-linked range.
    Session(u32),
    /// User string range.
    User(String),
    /// Control-mode range.
    Control(u8),
}

impl StyleRange {
    pub(super) fn as_tmux_value(&self) -> Option<String> {
        match self {
            Self::None => None,
            Self::Left => Some("left".to_owned()),
            Self::Right => Some("right".to_owned()),
            Self::Pane(id) => Some(format!("pane|%{id}")),
            Self::Window(id) => Some(format!("window|{id}")),
            Self::Session(id) => Some(format!("session|${id}")),
            Self::User(value) => Some(format!("user|{value}")),
            Self::Control(id) => Some(format!("control|{id}")),
        }
    }
}

/// Width directive used by popup, menu, and status rendering.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StyleWidth {
    /// An absolute cell width.
    Cells(u32),
    /// A width percentage.
    Percentage(u8),
}

impl StyleWidth {
    pub(super) fn as_tmux_value(self) -> String {
        match self {
            Self::Cells(value) => value.to_string(),
            Self::Percentage(value) => format!("{value}%"),
        }
    }
}

/// Default stack action from tmux `style_default_type`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum StyleDefaultType {
    /// No stack action.
    #[default]
    Base,
    /// Push the current default.
    Push,
    /// Pop the current default.
    Pop,
    /// Replace the current default.
    Set,
}

impl StyleDefaultType {
    pub(super) fn as_tmux_str(self) -> Option<&'static str> {
        match self {
            Self::Base => None,
            Self::Push => Some("push-default"),
            Self::Pop => Some("pop-default"),
            Self::Set => Some("set-default"),
        }
    }
}

/// Full tmux style state.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Style {
    /// Grid-cell colours and attributes.
    pub cell: StyleCell,
    /// Ignore flag used by `format_draw`.
    pub ignore: bool,
    /// Fill colour applied to the entire rendered area.
    pub fill: Colour,
    /// Horizontal alignment directive.
    pub align: StyleAlign,
    /// List state directive.
    pub list: StyleList,
    /// Active range descriptor.
    pub range: StyleRange,
    /// Optional width override.
    pub width: Option<StyleWidth>,
    /// Optional pad override.
    pub pad: Option<u32>,
    /// Default stack action.
    pub default_type: StyleDefaultType,
}

impl Default for Style {
    fn default() -> Self {
        Self {
            cell: StyleCell::default(),
            ignore: false,
            fill: COLOUR_DEFAULT,
            align: StyleAlign::Default,
            list: StyleList::Off,
            range: StyleRange::None,
            width: None,
            pad: None,
            default_type: StyleDefaultType::Base,
        }
    }
}
