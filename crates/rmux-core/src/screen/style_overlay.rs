use crate::input::{GridAttr, COLOUR_DEFAULT, COLOUR_NONE, COLOUR_TERMINAL};
use crate::style::{style_parse, Style, StyleCell};

use super::Screen;

impl Screen {
    /// Applies `style_input` only where the application left cell styling unset.
    pub fn overlay_style_on_default_cells(&mut self, style_input: &str) {
        let Some(style) = default_cell_overlay(style_input) else {
            return;
        };
        self.overlay_default_style(&style);
    }

    /// Applies `style` only where the application left cell styling unset.
    pub fn overlay_default_style(&mut self, style: &Style) {
        let background = effective_background(style);
        let width = self.grid.sx();
        for row in 0..self.grid.sy() {
            let Some(line) = self.grid.visible_line_mut(row) else {
                continue;
            };
            for x in 0..width {
                let Some(cell) = line.cell_mut(x) else {
                    continue;
                };
                if cell.is_padding() {
                    continue;
                }

                if is_set(style.cell.fg) && is_unset(cell.fg()) {
                    cell.set_fg(style.cell.fg);
                }
                if is_set(background) && is_unset(cell.bg()) {
                    cell.set_bg(background);
                }
                if is_set(style.cell.us) && is_unset(cell.us()) {
                    cell.set_us(style.cell.us);
                }
                if style.cell.attr != 0 && cell.attr() == 0 {
                    cell.set_attr(style.cell.attr & !GridAttr::NOATTR);
                }
            }
        }
    }
}

fn default_cell_overlay(style_input: &str) -> Option<Style> {
    if style_input.is_empty() {
        return None;
    }

    let base = StyleCell::default();
    let mut style = Style::default();
    style_parse(&mut style, &base, style_input).ok()?;
    (is_set(style.cell.fg)
        || is_set(style.cell.bg)
        || is_set(style.cell.us)
        || is_set(style.fill)
        || style.cell.attr != 0)
        .then_some(style)
}

fn effective_background(style: &Style) -> i32 {
    if is_set(style.cell.bg) {
        style.cell.bg
    } else {
        style.fill
    }
}

fn is_set(colour: i32) -> bool {
    !is_unset(colour)
}

fn is_unset(colour: i32) -> bool {
    matches!(colour, COLOUR_DEFAULT | COLOUR_TERMINAL | COLOUR_NONE)
}
