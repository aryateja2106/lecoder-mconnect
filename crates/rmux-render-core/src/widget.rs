//! Deterministic, sync ratatui widget for a captured RMUX pane state.

use ratatui_core::buffer::Buffer;
use ratatui_core::layout::Rect;
use ratatui_core::style::Style;
use ratatui_core::widgets::Widget;

use crate::theme::{cell_style, glyph_symbol};
use crate::PaneState;

/// Sync ratatui widget that paints one [`PaneState`].
#[derive(Debug, Clone, Copy)]
pub struct PaneWidget<'a> {
    state: &'a PaneState,
    base_style: Style,
}

impl<'a> PaneWidget<'a> {
    /// Creates a widget that renders `state` with the default style.
    #[must_use]
    pub const fn new(state: &'a PaneState) -> Self {
        Self {
            state,
            base_style: Style::new(),
        }
    }

    /// Returns a copy of this widget that pre-fills the render area with `style`.
    #[must_use]
    pub const fn base_style(mut self, style: Style) -> Self {
        self.base_style = style;
        self
    }

    /// Returns the borrowed state.
    #[must_use]
    pub const fn state(&self) -> &'a PaneState {
        self.state
    }

    fn paint(&self, area: Rect, buf: &mut Buffer) {
        if area.width == 0 || area.height == 0 {
            return;
        }

        let snapshot = &self.state.snapshot;
        fill_area(buf, area, self.base_style);
        if !snapshot.is_row_major_shape() {
            return;
        }

        let max_rows = u16::min(snapshot.rows, area.height);
        let max_cols = u16::min(snapshot.cols, area.width);

        for row in 0..max_rows {
            let Some(row_cells) = snapshot.row_cells(row) else {
                continue;
            };
            let target_y = area.y.saturating_add(row);
            for col in 0..max_cols {
                let Some(cell) = row_cells.get(usize::from(col)) else {
                    continue;
                };
                let target_x = area.x.saturating_add(col);
                let Some(buffer_cell) = buf.cell_mut((target_x, target_y)) else {
                    continue;
                };
                let symbol = glyph_symbol(&cell.glyph);
                if symbol.is_empty() {
                    buffer_cell.set_symbol(" ");
                } else {
                    buffer_cell.set_symbol(symbol);
                }
                buffer_cell.set_style(cell_style(cell));
            }
        }
    }
}

fn fill_area(buf: &mut Buffer, area: Rect, style: Style) {
    for y in area.y..area.y.saturating_add(area.height) {
        for x in area.x..area.x.saturating_add(area.width) {
            let Some(cell) = buf.cell_mut((x, y)) else {
                continue;
            };
            cell.set_symbol(" ");
            cell.set_style(style);
        }
    }
}

impl<'a> Widget for PaneWidget<'a> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        self.paint(area, buf);
    }
}

impl<'a, 'b> Widget for &'b PaneWidget<'a> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        self.paint(area, buf);
    }
}

#[cfg(test)]
mod tests {
    use ratatui_core::buffer::Buffer;
    use ratatui_core::layout::Rect;
    use ratatui_core::widgets::Widget;

    use crate::{PaneCell, PaneCursor, PaneGlyph, PaneSnapshot, PaneState, PaneWidget};

    #[test]
    fn widget_renders_snapshot_symbols() {
        let snapshot = PaneSnapshot::new(
            2,
            1,
            vec![
                PaneCell::new(PaneGlyph::new("a", 1)),
                PaneCell::new(PaneGlyph::new("b", 1)),
            ],
            PaneCursor::default(),
        )
        .expect("valid snapshot");
        let state = PaneState::from_snapshot(snapshot);
        let area = Rect::new(0, 0, 2, 1);
        let mut buffer = Buffer::empty(area);

        PaneWidget::new(&state).render(area, &mut buffer);

        assert_eq!(buffer.cell((0, 0)).expect("cell").symbol(), "a");
        assert_eq!(buffer.cell((1, 0)).expect("cell").symbol(), "b");
    }
}
