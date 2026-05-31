use std::fmt::Write as _;

use super::{LayoutDirection, PANE_BORDER_CELLS, PANE_MINIMUM};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct LayoutGeometry {
    pub(super) width: u32,
    pub(super) height: u32,
    pub(super) x: u32,
    pub(super) y: u32,
}

impl LayoutGeometry {
    #[must_use]
    pub(super) const fn new(width: u32, height: u32, x: u32, y: u32) -> Self {
        Self {
            width,
            height,
            x,
            y,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum LayoutKind {
    Pane,
    Split(LayoutDirection, Vec<LayoutCell>),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct LayoutCell {
    pub(super) geometry: LayoutGeometry,
    pub(super) kind: LayoutKind,
}

impl LayoutCell {
    #[must_use]
    pub(super) const fn pane(geometry: LayoutGeometry) -> Self {
        Self {
            geometry,
            kind: LayoutKind::Pane,
        }
    }

    #[must_use]
    pub(super) fn split(
        direction: LayoutDirection,
        geometry: LayoutGeometry,
        children: Vec<Self>,
    ) -> Self {
        Self {
            geometry,
            kind: LayoutKind::Split(direction, children),
        }
    }

    #[must_use]
    pub(super) fn leaf_count(&self) -> usize {
        match &self.kind {
            LayoutKind::Pane => 1,
            LayoutKind::Split(_, children) => children.iter().map(Self::leaf_count).sum(),
        }
    }

    pub(super) fn collect_leaf_geometries(&self, geometries: &mut Vec<LayoutGeometry>) {
        match &self.kind {
            LayoutKind::Pane => geometries.push(self.geometry),
            LayoutKind::Split(_, children) => {
                for child in children {
                    child.collect_leaf_geometries(geometries);
                }
            }
        }
    }

    pub(super) fn collect_leaf_paths(
        &self,
        current_path: &mut Vec<usize>,
        paths: &mut Vec<Vec<usize>>,
    ) {
        match &self.kind {
            LayoutKind::Pane => paths.push(current_path.clone()),
            LayoutKind::Split(_, children) => {
                for (index, child) in children.iter().enumerate() {
                    current_path.push(index);
                    child.collect_leaf_paths(current_path, paths);
                    current_path.pop();
                }
            }
        }
    }

    #[must_use]
    pub(super) fn dump_body(&self, pane_id_iter: &mut impl Iterator<Item = u32>) -> String {
        let mut body = format!(
            "{}x{},{},{}",
            self.geometry.width, self.geometry.height, self.geometry.x, self.geometry.y
        );
        match &self.kind {
            LayoutKind::Pane => {
                if let Some(pane_id) = pane_id_iter.next() {
                    let _ = write!(&mut body, ",{pane_id}");
                }
            }
            LayoutKind::Split(direction, children) => {
                let (open, close) = match direction {
                    LayoutDirection::LeftRight => ('{', '}'),
                    LayoutDirection::TopBottom => ('[', ']'),
                };
                body.push(open);
                for (index, child) in children.iter().enumerate() {
                    if index > 0 {
                        body.push(',');
                    }
                    body.push_str(&child.dump_body(pane_id_iter));
                }
                body.push(close);
            }
        }
        body
    }

    #[must_use]
    pub(super) fn check(&self) -> bool {
        match &self.kind {
            LayoutKind::Pane => true,
            LayoutKind::Split(direction, children) => {
                if children.is_empty() {
                    return false;
                }

                let mut total = 0_u32;
                for child in children {
                    if !child.check() {
                        return false;
                    }
                    match direction {
                        LayoutDirection::LeftRight => {
                            if child.geometry.height != self.geometry.height {
                                return false;
                            }
                            total = total.saturating_add(child.geometry.width + PANE_BORDER_CELLS);
                        }
                        LayoutDirection::TopBottom => {
                            if child.geometry.width != self.geometry.width {
                                return false;
                            }
                            total = total.saturating_add(child.geometry.height + PANE_BORDER_CELLS);
                        }
                    }
                }

                match direction {
                    LayoutDirection::LeftRight => {
                        total.saturating_sub(PANE_BORDER_CELLS) == self.geometry.width
                    }
                    LayoutDirection::TopBottom => {
                        total.saturating_sub(PANE_BORDER_CELLS) == self.geometry.height
                    }
                }
            }
        }
    }

    pub(super) fn fix_offsets(&mut self, x: u32, y: u32) {
        self.geometry.x = x;
        self.geometry.y = y;
        match &mut self.kind {
            LayoutKind::Pane => {}
            LayoutKind::Split(direction, children) => {
                let mut cursor = 0_u32;
                for child in children {
                    match direction {
                        LayoutDirection::LeftRight => {
                            child.fix_offsets(x + cursor, y);
                            cursor = cursor
                                .saturating_add(child.geometry.width)
                                .saturating_add(PANE_BORDER_CELLS);
                        }
                        LayoutDirection::TopBottom => {
                            child.fix_offsets(x, y + cursor);
                            cursor = cursor
                                .saturating_add(child.geometry.height)
                                .saturating_add(PANE_BORDER_CELLS);
                        }
                    }
                }
            }
        }
    }

    #[must_use]
    pub(super) fn resize_check(&self, direction: LayoutDirection) -> u32 {
        match &self.kind {
            LayoutKind::Pane => {
                let available = match direction {
                    LayoutDirection::LeftRight => self.geometry.width,
                    LayoutDirection::TopBottom => self.geometry.height,
                };
                available.saturating_sub(PANE_MINIMUM)
            }
            LayoutKind::Split(split_direction, children) => {
                if *split_direction == direction {
                    children
                        .iter()
                        .map(|child| child.resize_check(direction))
                        .sum()
                } else {
                    children
                        .iter()
                        .map(|child| child.resize_check(direction))
                        .min()
                        .unwrap_or(0)
                }
            }
        }
    }

    pub(super) fn resize_adjust(&mut self, direction: LayoutDirection, change: i32) {
        if change == 0 {
            return;
        }

        match direction {
            LayoutDirection::LeftRight => {
                self.geometry.width = self.geometry.width.saturating_add_signed(change);
            }
            LayoutDirection::TopBottom => {
                self.geometry.height = self.geometry.height.saturating_add_signed(change);
            }
        }

        let LayoutKind::Split(split_direction, children) = &mut self.kind else {
            return;
        };

        if *split_direction != direction {
            for child in children {
                child.resize_adjust(direction, change);
            }
            return;
        }

        let mut remaining = change;
        while remaining != 0 {
            let mut progressed = false;
            for child in children.iter_mut() {
                if remaining == 0 {
                    break;
                }
                if remaining > 0 {
                    child.resize_adjust(direction, 1);
                    remaining -= 1;
                    progressed = true;
                } else if child.resize_check(direction) > 0 {
                    child.resize_adjust(direction, -1);
                    remaining += 1;
                    progressed = true;
                }
            }
            if !progressed {
                break;
            }
        }
    }

    pub(super) fn spread(&mut self) -> bool {
        let LayoutKind::Split(direction, children) = &mut self.kind else {
            return false;
        };
        if children.len() <= 1 {
            return false;
        }

        let size = match direction {
            LayoutDirection::LeftRight => self.geometry.width,
            LayoutDirection::TopBottom => self.geometry.height,
        };
        if size < (children.len() as u32).saturating_sub(1) {
            return false;
        }

        let each =
            size.saturating_sub((children.len() as u32).saturating_sub(1)) / children.len() as u32;
        if each == 0 {
            return false;
        }

        let mut remainder = size
            .saturating_sub((children.len() as u32) * (each + PANE_BORDER_CELLS))
            .saturating_add(PANE_BORDER_CELLS);
        let mut changed = false;

        for child in children {
            let mut target = each;
            if remainder > 0 {
                target += 1;
                remainder -= 1;
            }
            let current = match direction {
                LayoutDirection::LeftRight => child.geometry.width,
                LayoutDirection::TopBottom => child.geometry.height,
            };
            let delta = target as i32 - current as i32;
            if delta != 0 {
                child.resize_adjust(*direction, delta);
                changed = true;
            }
        }

        changed
    }

    pub(super) fn fix_root_size_if_needed(&mut self) {
        let LayoutKind::Split(direction, children) = &self.kind else {
            return;
        };
        if children.is_empty() {
            return;
        }

        let (expected_width, expected_height) = match direction {
            LayoutDirection::LeftRight => (
                children
                    .iter()
                    .map(|child| child.geometry.width + PANE_BORDER_CELLS)
                    .sum::<u32>()
                    .saturating_sub(PANE_BORDER_CELLS),
                children[0].geometry.height,
            ),
            LayoutDirection::TopBottom => (
                children[0].geometry.width,
                children
                    .iter()
                    .map(|child| child.geometry.height + PANE_BORDER_CELLS)
                    .sum::<u32>()
                    .saturating_sub(PANE_BORDER_CELLS),
            ),
        };

        self.geometry.width = expected_width;
        self.geometry.height = expected_height;
        self.fix_offsets(0, 0);
    }
}
