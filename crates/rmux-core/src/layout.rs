use rmux_proto::{LayoutName, RmuxError, SplitDirection, TerminalSize};

use crate::{Pane, PaneGeometry};

#[path = "layout/cell.rs"]
mod cell;
#[path = "layout/mutation.rs"]
mod mutation;
#[path = "layout/named.rs"]
mod named;
#[path = "layout/parser.rs"]
mod parser;
#[path = "layout/resize.rs"]
mod resize;

use cell::{LayoutCell, LayoutGeometry};
use parser::LayoutParser;

const PANE_BORDER_CELLS: u32 = 1;
const PANE_MINIMUM: u32 = 1;
const DEFAULT_MAIN_PANE_WIDTH: u32 = 80;
const DEFAULT_MAIN_PANE_HEIGHT: u32 = 24;

pub(crate) const fn minimum_axis_size_for_panes(pane_count: usize) -> u32 {
    if pane_count == 0 {
        return 0;
    }
    (PANE_MINIMUM * pane_count as u32) + (PANE_BORDER_CELLS * pane_count.saturating_sub(1) as u32)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub(crate) struct LayoutOptions {
    requested_main_width: Option<u16>,
    requested_main_height: Option<u16>,
    tiled_max_columns: Option<u16>,
}

impl LayoutOptions {
    #[must_use]
    pub(crate) const fn with_requested_main_width(mut self, width: Option<u16>) -> Self {
        self.requested_main_width = width;
        self
    }

    #[must_use]
    pub(crate) const fn with_requested_main_height(mut self, height: Option<u16>) -> Self {
        self.requested_main_height = height;
        self
    }

    #[must_use]
    pub(crate) const fn with_tiled_max_columns(mut self, columns: Option<u16>) -> Self {
        self.tiled_max_columns = columns;
        self
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum LayoutDirection {
    LeftRight,
    TopBottom,
}

impl LayoutDirection {
    #[must_use]
    pub(crate) const fn from_split_direction(direction: SplitDirection) -> Self {
        match direction {
            SplitDirection::Vertical => Self::LeftRight,
            SplitDirection::Horizontal => Self::TopBottom,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct LayoutTree {
    root: LayoutCell,
    /// When set, maps pane positions to leaf positions for mirrored layouts.
    /// `leaf_map[pane_position] = leaf_index` — pane at position `i` receives
    /// the geometry of leaf `leaf_map[i]`.  Cleared on any tree mutation.
    leaf_map: Option<Vec<usize>>,
}

impl LayoutTree {
    #[must_use]
    pub(crate) fn single(size: TerminalSize) -> Self {
        Self {
            root: LayoutCell::pane(LayoutGeometry::new(
                u32::from(size.cols),
                u32::from(size.rows),
                0,
                0,
            )),
            leaf_map: None,
        }
    }

    pub(crate) fn parse(layout: &str, pane_count: usize) -> Result<Self, RmuxError> {
        let (checksum, body) = layout
            .split_once(',')
            .ok_or_else(|| RmuxError::Server("invalid layout".to_owned()))?;
        if checksum.len() != 4 {
            return Err(RmuxError::Server("invalid layout".to_owned()));
        }
        let expected_checksum = u16::from_str_radix(checksum, 16)
            .map_err(|_| RmuxError::Server("invalid layout".to_owned()))?;
        if expected_checksum != layout_checksum(body) {
            return Err(RmuxError::Server("invalid layout".to_owned()));
        }

        let mut parser = LayoutParser::new(body);
        let root = parser.parse_cell()?;
        if !parser.is_eof() {
            return Err(RmuxError::Server("invalid layout".to_owned()));
        }

        let mut tree = Self {
            root,
            leaf_map: None,
        };
        while tree.leaf_count() > pane_count {
            if !tree.remove_leaf(tree.leaf_count() - 1) {
                return Err(RmuxError::Server("invalid layout".to_owned()));
            }
        }
        if pane_count > tree.leaf_count() {
            return Err(RmuxError::Server(format!(
                "have {pane_count} panes but need {}",
                tree.leaf_count()
            )));
        }

        tree.root.fix_root_size_if_needed();
        if !tree.root.check() {
            return Err(RmuxError::Server(
                "size mismatch after applying layout".to_owned(),
            ));
        }
        tree.root.fix_offsets(0, 0);
        Ok(tree)
    }

    #[must_use]
    pub(crate) fn leaf_count(&self) -> usize {
        self.root.leaf_count()
    }

    #[must_use]
    pub(crate) fn size(&self) -> TerminalSize {
        TerminalSize {
            cols: self.root.geometry.width.min(u32::from(u16::MAX)) as u16,
            rows: self.root.geometry.height.min(u32::from(u16::MAX)) as u16,
        }
    }

    pub(crate) fn apply_to_panes(&self, panes: &mut [Pane]) {
        let mut geometries = Vec::with_capacity(panes.len());
        self.root.collect_leaf_geometries(&mut geometries);
        debug_assert_eq!(geometries.len(), panes.len());

        for (pane_index, pane) in panes.iter_mut().enumerate() {
            let leaf_index = self
                .leaf_map
                .as_ref()
                .map_or(pane_index, |map| map[pane_index]);
            let geometry = geometries[leaf_index];
            pane.set_geometry(PaneGeometry::new(
                geometry.x.min(u32::from(u16::MAX)) as u16,
                geometry.y.min(u32::from(u16::MAX)) as u16,
                geometry.width.min(u32::from(u16::MAX)) as u16,
                geometry.height.min(u32::from(u16::MAX)) as u16,
            ));
        }
    }

    #[must_use]
    pub(crate) fn dump(&self, panes: &[Pane]) -> String {
        let pane_ids: Vec<u32> = panes.iter().map(|pane| pane.id().as_u32()).collect();
        let mut reordered_ids = vec![0_u32; pane_ids.len()];
        if let Some(map) = &self.leaf_map {
            for (pane_pos, &leaf_idx) in map.iter().enumerate() {
                if pane_pos < pane_ids.len() && leaf_idx < reordered_ids.len() {
                    reordered_ids[leaf_idx] = pane_ids[pane_pos];
                }
            }
        } else {
            reordered_ids = pane_ids;
        }
        let mut id_iter = reordered_ids.into_iter();
        let body = self.root.dump_body(&mut id_iter);
        format!("{:04x},{}", layout_checksum(&body), body)
    }
}

#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn apply_layout(
    panes: &mut [Pane],
    layout: LayoutName,
    size: TerminalSize,
    requested_main_width: Option<u16>,
) -> LayoutTree {
    let tree = LayoutTree::named(
        layout,
        panes.len(),
        size,
        LayoutOptions::default().with_requested_main_width(requested_main_width),
    );
    tree.apply_to_panes(panes);
    tree
}

#[must_use]
pub(crate) fn layout_checksum(layout: &str) -> u16 {
    let mut checksum = 0_u16;
    for byte in layout.bytes() {
        checksum = (checksum >> 1) + ((checksum & 1) << 15);
        checksum = checksum.wrapping_add(u16::from(byte));
    }
    checksum
}

fn split_axis(total: u32, count: usize) -> Vec<u32> {
    if count == 0 {
        return Vec::new();
    }
    let usable = total.saturating_sub((count as u32).saturating_sub(1) * PANE_BORDER_CELLS);
    let each = usable / count as u32;
    let remainder = usable - each * count as u32;
    let mut sizes = Vec::with_capacity(count);
    for index in 0..count {
        let mut size = each;
        if index + 1 == count {
            size += remainder;
        }
        sizes.push(size);
    }
    sizes
}

#[cfg(test)]
#[path = "layout/tests.rs"]
mod tests;

#[cfg(test)]
#[path = "layout/tiled_tests.rs"]
mod tiled_tests;
