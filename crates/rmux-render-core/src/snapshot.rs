//! Captured pane snapshot data.

use std::fmt;

use serde::{Deserialize, Deserializer, Serialize, Serializer};

mod attrs;
mod cell;
mod color;
mod cursor;
mod glyph;

pub use attrs::PaneAttributes;
pub use cell::PaneCell;
pub use color::PaneColor;
pub use cursor::PaneCursor;
pub use glyph::PaneGlyph;

/// A captured pane grid in row-major cell order.
#[derive(Debug, Default, Clone, PartialEq, Eq, Hash)]
pub struct PaneSnapshot {
    /// Visible pane width in terminal columns.
    pub cols: u16,
    /// Visible pane height in terminal rows.
    pub rows: u16,
    /// Row-major cells, with `row * cols + col` indexing.
    pub cells: Vec<PaneCell>,
    /// Captured cursor coordinates and state.
    pub cursor: PaneCursor,
    /// Daemon-derived revision counter for this captured pane state.
    pub revision: u64,
}

impl PaneSnapshot {
    /// Creates a snapshot after checking the row-major cell count.
    pub fn new(
        cols: u16,
        rows: u16,
        cells: Vec<PaneCell>,
        cursor: PaneCursor,
    ) -> Result<Self, PaneSnapshotShapeError> {
        let snapshot = Self {
            cols,
            rows,
            cells,
            cursor,
            revision: 0,
        };
        snapshot.validate_shape()?;
        Ok(snapshot)
    }

    /// Returns a copy of this snapshot with the supplied revision.
    #[must_use]
    pub fn with_revision(mut self, revision: u64) -> Self {
        self.revision = revision;
        self
    }

    /// Returns the number of row-major cells implied by `rows * cols`.
    #[must_use]
    pub fn expected_cell_count(&self) -> usize {
        expected_cell_count(self.cols, self.rows)
    }

    /// Returns whether `cells.len()` exactly matches `rows * cols`.
    #[must_use]
    pub fn is_row_major_shape(&self) -> bool {
        self.cells.len() == self.expected_cell_count()
    }

    /// Checks the row-major cell-count invariant.
    pub fn validate_shape(&self) -> Result<(), PaneSnapshotShapeError> {
        let expected = self.expected_cell_count();
        if self.cells.len() == expected {
            Ok(())
        } else {
            Err(PaneSnapshotShapeError {
                cols: self.cols,
                rows: self.rows,
                actual_cells: self.cells.len(),
                expected_cells: expected,
            })
        }
    }

    /// Returns one cell by visible row and column.
    #[must_use]
    pub fn cell(&self, row: u16, col: u16) -> Option<&PaneCell> {
        if row >= self.rows || col >= self.cols {
            return None;
        }
        let index = usize::from(row)
            .saturating_mul(usize::from(self.cols))
            .saturating_add(usize::from(col));
        self.cells.get(index)
    }

    /// Returns one row slice by visible row.
    #[must_use]
    pub fn row_cells(&self, row: u16) -> Option<&[PaneCell]> {
        if row >= self.rows {
            return None;
        }

        let cols = usize::from(self.cols);
        let start = usize::from(row).checked_mul(cols)?;
        let end = start.checked_add(cols)?;
        self.cells.get(start..end)
    }

    /// Iterates visible, non-padding cells with their original row and column.
    pub fn visible_cells(&self) -> impl Iterator<Item = (u16, u16, &PaneCell)> + '_ {
        let cols = usize::from(self.cols);
        let rows = usize::from(self.rows);
        self.cells
            .iter()
            .enumerate()
            .filter_map(move |(index, cell)| {
                if cols == 0 || cell.is_padding() {
                    return None;
                }

                let row = index / cols;
                if row >= rows {
                    return None;
                }
                let col = index % cols;
                Some((row as u16, col as u16, cell))
            })
    }

    /// Renders one visible row using lossy plain-text behavior.
    #[must_use]
    pub fn visible_row_text(&self, row: u16) -> Option<String> {
        self.lossy_row_cells(row).map(render_cells_lossy)
    }

    /// Renders all visible rows using lossy plain-text behavior.
    #[must_use]
    pub fn visible_lines(&self) -> Vec<String> {
        (0..self.rows)
            .map(|row| self.visible_row_text(row).unwrap_or_default())
            .collect()
    }

    fn lossy_row_cells(&self, row: u16) -> Option<&[PaneCell]> {
        if row >= self.rows {
            return None;
        }

        let cols = usize::from(self.cols);
        if cols == 0 {
            return Some(&[]);
        }

        let start = usize::from(row).checked_mul(cols)?;
        if start >= self.cells.len() {
            return Some(&[]);
        }
        let end = start.saturating_add(cols).min(self.cells.len());
        Some(&self.cells[start..end])
    }
}

impl Serialize for PaneSnapshot {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        self.validate_shape().map_err(serde::ser::Error::custom)?;
        PaneSnapshotFieldsRef {
            cols: self.cols,
            rows: self.rows,
            cells: &self.cells,
            cursor: &self.cursor,
            revision: self.revision,
        }
        .serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for PaneSnapshot {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let fields = PaneSnapshotFields::deserialize(deserializer)?;
        Self::new(fields.cols, fields.rows, fields.cells, fields.cursor)
            .map(|snapshot| snapshot.with_revision(fields.revision))
            .map_err(serde::de::Error::custom)
    }
}

#[derive(Serialize)]
struct PaneSnapshotFieldsRef<'a> {
    cols: u16,
    rows: u16,
    cells: &'a [PaneCell],
    cursor: &'a PaneCursor,
    revision: u64,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
struct PaneSnapshotFields {
    cols: u16,
    rows: u16,
    cells: Vec<PaneCell>,
    cursor: PaneCursor,
    revision: u64,
}

/// Error returned when a snapshot's dimensions do not match its cell vector.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PaneSnapshotShapeError {
    cols: u16,
    rows: u16,
    actual_cells: usize,
    expected_cells: usize,
}

impl PaneSnapshotShapeError {
    /// Returns the snapshot column count.
    #[must_use]
    pub const fn cols(&self) -> u16 {
        self.cols
    }

    /// Returns the snapshot row count.
    #[must_use]
    pub const fn rows(&self) -> u16 {
        self.rows
    }

    /// Returns the actual number of cells supplied.
    #[must_use]
    pub const fn actual_cells(&self) -> usize {
        self.actual_cells
    }

    /// Returns the expected `rows * cols` cell count.
    #[must_use]
    pub const fn expected_cells(&self) -> usize {
        self.expected_cells
    }
}

impl fmt::Display for PaneSnapshotShapeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "pane snapshot shape mismatch: {}x{} expects {} cells, got {}",
            self.cols, self.rows, self.expected_cells, self.actual_cells
        )
    }
}

impl std::error::Error for PaneSnapshotShapeError {}

fn expected_cell_count(cols: u16, rows: u16) -> usize {
    usize::from(cols) * usize::from(rows)
}

fn render_cells_lossy(cells: &[PaneCell]) -> String {
    let mut rendered = String::new();
    for cell in cells {
        if cell.is_padding() {
            continue;
        }
        rendered.push_str(cell.text());
    }
    while rendered.ends_with(' ') {
        rendered.pop();
    }
    rendered
}

#[cfg(test)]
mod tests {
    use super::{PaneCell, PaneCursor, PaneGlyph, PaneSnapshot};

    #[test]
    fn rejects_non_row_major_shape() {
        let error = PaneSnapshot::new(2, 2, vec![PaneCell::blank()], PaneCursor::default())
            .expect_err("shape mismatch");

        assert_eq!(error.expected_cells(), 4);
        assert_eq!(error.actual_cells(), 1);
    }

    #[test]
    fn visible_cells_skip_padding() {
        let snapshot = PaneSnapshot::new(
            3,
            1,
            vec![
                PaneCell::new(PaneGlyph::new("界", 2)),
                PaneCell::padding(),
                PaneCell::new(PaneGlyph::new("x", 1)),
            ],
            PaneCursor::default(),
        )
        .expect("valid snapshot");

        let cells = snapshot
            .visible_cells()
            .map(|(_, col, cell)| (col, cell.text().to_owned()))
            .collect::<Vec<_>>();

        assert_eq!(cells, vec![(0, "界".to_owned()), (2, "x".to_owned())]);
    }

    #[test]
    fn visible_lines_trim_trailing_spaces() {
        let snapshot = PaneSnapshot::new(
            3,
            1,
            vec![
                PaneCell::new(PaneGlyph::new("a", 1)),
                PaneCell::blank(),
                PaneCell::blank(),
            ],
            PaneCursor::default(),
        )
        .expect("valid snapshot");

        assert_eq!(snapshot.visible_lines(), vec!["a".to_owned()]);
    }
}
