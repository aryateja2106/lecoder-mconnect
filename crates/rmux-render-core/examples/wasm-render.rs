use ratatui_core::buffer::Buffer;
use ratatui_core::layout::Rect;
use ratatui_core::widgets::Widget;
use rmux_render_core::{PaneCell, PaneCursor, PaneGlyph, PaneSnapshot, PaneState, PaneWidget};

fn main() {
    let cells = (0..400)
        .map(|index| {
            let symbol = if index % 40 == 0 { "$" } else { " " };
            PaneCell::new(PaneGlyph::new(symbol, 1))
        })
        .collect();
    let snapshot =
        PaneSnapshot::new(40, 10, cells, PaneCursor::new(0, 1, true, 0)).expect("valid fixture");
    let state = PaneState::from_snapshot(snapshot);
    let area = Rect::new(0, 0, 40, 10);
    let mut buffer = Buffer::empty(area);
    PaneWidget::new(&state).render(area, &mut buffer);
    let _ = buffer;
}
