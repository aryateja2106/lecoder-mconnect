#![deny(missing_docs)]
#![deny(rustdoc::broken_intra_doc_links)]
#![deny(rustdoc::invalid_codeblock_attributes)]
#![forbid(unsafe_code)]

//! Pure-data RMUX pane rendering core.
//!
//! This crate owns no daemon, IPC, process, filesystem, network, Tokio, or
//! terminal-driver integration. It contains only captured pane snapshot data and
//! deterministic ratatui projection code that can compile for
//! `wasm32-unknown-unknown`.

mod snapshot;
mod state;
mod theme;
mod widget;

pub use snapshot::{
    PaneAttributes, PaneCell, PaneColor, PaneCursor, PaneGlyph, PaneSnapshot,
    PaneSnapshotShapeError,
};
pub use state::PaneState;
pub use theme::{cell_style, color, glyph_symbol, modifier};
pub use widget::PaneWidget;
