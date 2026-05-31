pub use rmux_types::{TerminalGeometry, TerminalPixels, TerminalSize};

#[cfg(unix)]
use rustix::termios::Winsize;

#[cfg(unix)]
pub(crate) const fn into_winsize(size: TerminalSize) -> Winsize {
    into_winsize_geometry(TerminalGeometry::from_size(size))
}

#[cfg(unix)]
pub(crate) const fn into_winsize_geometry(geometry: TerminalGeometry) -> Winsize {
    let pixels = match geometry.pixels {
        Some(pixels) => pixels,
        None => TerminalPixels {
            width: 0,
            height: 0,
        },
    };
    Winsize {
        ws_row: geometry.size.rows,
        ws_col: geometry.size.cols,
        ws_xpixel: pixels.width,
        ws_ypixel: pixels.height,
    }
}

#[cfg(unix)]
pub(crate) const fn from_winsize(winsize: Winsize) -> TerminalSize {
    TerminalSize {
        cols: winsize.ws_col,
        rows: winsize.ws_row,
    }
}
