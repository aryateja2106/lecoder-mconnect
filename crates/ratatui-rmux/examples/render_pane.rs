//! Rendering demo for the sync `ratatui-rmux` widget.
//!
//! Compile-tested by `cargo build --workspace --examples` and
//! `cargo clippy --workspace --all-targets --locked`. The example builds
//! a synthetic [`PaneSnapshot`], folds it into a [`PaneState`], and paints
//! it through [`PaneWidget`] into a ratatui [`Buffer`]. No async runtime
//! or daemon is involved, and the render path itself is I/O-free. The
//! final stdout summary just makes the rendered buffer easy to inspect.
//!
//! Uses only types re-exported from `rmux_sdk` and `ratatui_rmux`. Does
//! not depend on `rmux-client`, `rmux-core`, `rmux-server`, or `rmux-pty`.

use ratatui_core::buffer::Buffer;
use ratatui_core::layout::Rect;
use ratatui_core::style::{Color, Style};
use ratatui_core::widgets::Widget;

use ratatui_rmux::{PaneState, PaneWidget};
use rmux_sdk::{
    PaneAttributes, PaneCell, PaneColor, PaneCursor, PaneGlyph, PaneSnapshot,
    PaneSnapshotShapeError,
};

const COLS: u16 = 12;
const ROWS: u16 = 3;

fn build_snapshot() -> Result<PaneSnapshot, PaneSnapshotShapeError> {
    let mut cells: Vec<PaneCell> = Vec::with_capacity(usize::from(COLS) * usize::from(ROWS));
    let banner = "hi rmux!    ";
    let body = "row two:    ";
    let body2 = "row three:  ";
    for ch in banner.chars() {
        cells.push(styled_cell(ch, PaneColor::ansi(1), PaneAttributes::BOLD));
    }
    for ch in body.chars() {
        cells.push(styled_cell(ch, PaneColor::ansi(4), PaneAttributes::EMPTY));
    }
    for ch in body2.chars() {
        cells.push(styled_cell(
            ch,
            PaneColor::rgb(0, 255, 0),
            PaneAttributes::ITALIC,
        ));
    }

    Ok(PaneSnapshot::new(COLS, ROWS, cells, PaneCursor::new(0, 0, true, 0))?.with_revision(1))
}

fn styled_cell(ch: char, fg: PaneColor, attrs: PaneAttributes) -> PaneCell {
    let mut text = String::new();
    text.push(ch);
    PaneCell {
        glyph: PaneGlyph::new(text, 1),
        attributes: attrs,
        foreground: fg,
        background: PaneColor::Default,
        underline: PaneColor::Default,
    }
}

fn main() -> Result<(), PaneSnapshotShapeError> {
    let state = PaneState::from_snapshot(build_snapshot()?);
    let area = Rect::new(0, 0, COLS, ROWS);
    let base_style = Style::new().bg(Color::Reset);

    let mut buffer_a = Buffer::empty(area);
    PaneWidget::new(&state)
        .base_style(base_style)
        .render(area, &mut buffer_a);

    // Determinism witness: rendering the same `PaneState` into a fresh
    // buffer must yield the same cell contents. Asserting it here keeps
    // the comment honest — the example *proves* the claim it makes
    // rather than just declaring it.
    let mut buffer_b = Buffer::empty(area);
    PaneWidget::new(&state)
        .base_style(base_style)
        .render(area, &mut buffer_b);
    assert!(
        buffer_a == buffer_b,
        "PaneWidget render must be deterministic for a fixed PaneState",
    );

    for row in 0..ROWS {
        let mut line = String::new();
        for col in 0..COLS {
            if let Some(cell) = buffer_a.cell((col, row)) {
                line.push_str(cell.symbol());
            }
        }
        println!("{row:>2}: {line}");
    }

    Ok(())
}
