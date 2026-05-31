use rmux_proto::{LayoutName, TerminalSize};

use super::{
    split_axis, LayoutCell, LayoutDirection, LayoutGeometry, LayoutOptions, LayoutTree,
    DEFAULT_MAIN_PANE_HEIGHT, DEFAULT_MAIN_PANE_WIDTH, PANE_BORDER_CELLS, PANE_MINIMUM,
};

impl LayoutTree {
    #[must_use]
    pub(crate) fn named(
        layout: LayoutName,
        pane_count: usize,
        size: TerminalSize,
        options: LayoutOptions,
    ) -> Self {
        if pane_count <= 1 {
            return Self::single(size);
        }

        let geometry = LayoutGeometry::new(u32::from(size.cols), u32::from(size.rows), 0, 0);
        let mut tree = match layout {
            LayoutName::EvenHorizontal => {
                Self::build_even(LayoutDirection::LeftRight, pane_count, geometry)
            }
            LayoutName::EvenVertical => {
                Self::build_even(LayoutDirection::TopBottom, pane_count, geometry)
            }
            LayoutName::MainHorizontal => {
                Self::build_main_horizontal(pane_count, geometry, options, false)
            }
            LayoutName::MainHorizontalMirrored => {
                Self::build_main_horizontal(pane_count, geometry, options, true)
            }
            LayoutName::MainVertical => {
                Self::build_main_vertical(pane_count, geometry, options, false)
            }
            LayoutName::MainVerticalMirrored => {
                Self::build_main_vertical(pane_count, geometry, options, true)
            }
            LayoutName::Tiled => Self::build_tiled(pane_count, geometry, options),
        };
        tree.root.fix_offsets(0, 0);
        tree
    }

    fn build_even(direction: LayoutDirection, pane_count: usize, geometry: LayoutGeometry) -> Self {
        let children = match direction {
            LayoutDirection::LeftRight => split_axis(geometry.width, pane_count)
                .into_iter()
                .scan(0_u32, |x, width| {
                    let child = LayoutCell::pane(LayoutGeometry::new(
                        width,
                        geometry.height,
                        *x,
                        geometry.y,
                    ));
                    *x = x.saturating_add(width).saturating_add(PANE_BORDER_CELLS);
                    Some(child)
                })
                .collect(),
            LayoutDirection::TopBottom => split_axis(geometry.height, pane_count)
                .into_iter()
                .scan(0_u32, |y, height| {
                    let child = LayoutCell::pane(LayoutGeometry::new(
                        geometry.width,
                        height,
                        geometry.x,
                        *y,
                    ));
                    *y = y.saturating_add(height).saturating_add(PANE_BORDER_CELLS);
                    Some(child)
                })
                .collect(),
        };

        Self {
            root: LayoutCell::split(direction, geometry, children),
            leaf_map: None,
        }
    }

    fn build_main_vertical(
        pane_count: usize,
        geometry: LayoutGeometry,
        options: LayoutOptions,
        mirrored: bool,
    ) -> Self {
        let main_width = resolve_main_pane_size(
            geometry.width,
            options.requested_main_width.map(u32::from),
            DEFAULT_MAIN_PANE_WIDTH,
        );
        let secondary_width = geometry
            .width
            .saturating_sub(main_width)
            .saturating_sub(PANE_BORDER_CELLS);

        let main = LayoutCell::pane(LayoutGeometry::new(main_width, geometry.height, 0, 0));
        let secondary = if pane_count == 2 {
            LayoutCell::pane(LayoutGeometry::new(
                secondary_width,
                geometry.height,
                main_width + PANE_BORDER_CELLS,
                0,
            ))
        } else {
            let secondary_geometry = LayoutGeometry::new(
                secondary_width,
                geometry.height,
                main_width + PANE_BORDER_CELLS,
                0,
            );
            let children = split_axis(geometry.height, pane_count - 1)
                .into_iter()
                .scan(0_u32, |y, height| {
                    let child = LayoutCell::pane(LayoutGeometry::new(
                        secondary_width,
                        height,
                        secondary_geometry.x,
                        *y,
                    ));
                    *y = y.saturating_add(height).saturating_add(PANE_BORDER_CELLS);
                    Some(child)
                })
                .collect();
            LayoutCell::split(LayoutDirection::TopBottom, secondary_geometry, children)
        };

        let (children, leaf_map) = if mirrored {
            let map = mirrored_leaf_map(pane_count);
            (
                vec![
                    shift_cell(secondary, 0, 0),
                    shift_cell(main, secondary_width + PANE_BORDER_CELLS, 0),
                ],
                Some(map),
            )
        } else {
            (vec![main, secondary], None)
        };

        let mut root = LayoutCell::split(LayoutDirection::LeftRight, geometry, children);
        root.fix_offsets(0, 0);
        Self { root, leaf_map }
    }

    fn build_main_horizontal(
        pane_count: usize,
        geometry: LayoutGeometry,
        options: LayoutOptions,
        mirrored: bool,
    ) -> Self {
        let main_height = resolve_main_pane_size(
            geometry.height,
            options.requested_main_height.map(u32::from),
            DEFAULT_MAIN_PANE_HEIGHT,
        );
        let secondary_height = geometry
            .height
            .saturating_sub(main_height)
            .saturating_sub(PANE_BORDER_CELLS);

        let main = LayoutCell::pane(LayoutGeometry::new(geometry.width, main_height, 0, 0));
        let secondary = if pane_count == 2 {
            LayoutCell::pane(LayoutGeometry::new(
                geometry.width,
                secondary_height,
                0,
                main_height + PANE_BORDER_CELLS,
            ))
        } else {
            let secondary_geometry = LayoutGeometry::new(
                geometry.width,
                secondary_height,
                0,
                main_height + PANE_BORDER_CELLS,
            );
            let children = split_axis(geometry.width, pane_count - 1)
                .into_iter()
                .scan(0_u32, |x, width| {
                    let child = LayoutCell::pane(LayoutGeometry::new(
                        width,
                        secondary_height,
                        *x,
                        secondary_geometry.y,
                    ));
                    *x = x.saturating_add(width).saturating_add(PANE_BORDER_CELLS);
                    Some(child)
                })
                .collect();
            LayoutCell::split(LayoutDirection::LeftRight, secondary_geometry, children)
        };

        let (children, leaf_map) = if mirrored {
            let map = mirrored_leaf_map(pane_count);
            (
                vec![
                    shift_cell(secondary, 0, 0),
                    shift_cell(main, 0, secondary_height + PANE_BORDER_CELLS),
                ],
                Some(map),
            )
        } else {
            (vec![main, secondary], None)
        };

        let mut root = LayoutCell::split(LayoutDirection::TopBottom, geometry, children);
        root.fix_offsets(0, 0);
        Self { root, leaf_map }
    }

    fn build_tiled(pane_count: usize, geometry: LayoutGeometry, options: LayoutOptions) -> Self {
        let max_columns = options
            .tiled_max_columns
            .filter(|columns| *columns > 0)
            .map(usize::from);
        let (rows, columns) = tiled_grid_size(pane_count, max_columns);
        let width = ((geometry
            .width
            .saturating_sub((columns as u32).saturating_sub(1)))
            / columns as u32)
            .max(PANE_MINIMUM);
        let height = ((geometry
            .height
            .saturating_sub((rows as u32).saturating_sub(1)))
            / rows as u32)
            .max(PANE_MINIMUM);
        let root_width = (((width + PANE_BORDER_CELLS) * columns as u32)
            .saturating_sub(PANE_BORDER_CELLS))
        .max(geometry.width);
        let root_height = (((height + PANE_BORDER_CELLS) * rows as u32)
            .saturating_sub(PANE_BORDER_CELLS))
        .max(geometry.height);
        let root_geometry = LayoutGeometry::new(root_width, root_height, 0, 0);

        let mut remaining = pane_count;
        let mut row_y = 0_u32;
        let mut rows_cells = Vec::new();

        for _ in 0..rows {
            if remaining == 0 {
                break;
            }

            let panes_in_row = remaining.min(columns);
            let mut row = if panes_in_row == 1 || columns == 1 {
                LayoutCell::pane(LayoutGeometry::new(geometry.width, height, 0, row_y))
            } else {
                let mut children = Vec::new();
                let mut row_x = 0_u32;
                for _ in 0..panes_in_row {
                    children.push(LayoutCell::pane(LayoutGeometry::new(
                        width, height, row_x, row_y,
                    )));
                    row_x = row_x
                        .saturating_add(width)
                        .saturating_add(PANE_BORDER_CELLS);
                }
                let used = (((panes_in_row as u32) * (width + PANE_BORDER_CELLS))
                    .saturating_sub(PANE_BORDER_CELLS))
                .min(root_geometry.width);
                if let Some(last) = children.last_mut() {
                    let extra = geometry.width.saturating_sub(used);
                    if extra > 0 {
                        last.resize_adjust(LayoutDirection::LeftRight, extra as i32);
                    }
                }
                LayoutCell::split(
                    LayoutDirection::LeftRight,
                    LayoutGeometry::new(geometry.width, height, 0, row_y),
                    children,
                )
            };

            if row.geometry.width != geometry.width {
                row.geometry.width = geometry.width;
            }
            rows_cells.push(row);
            remaining -= panes_in_row;
            row_y = row_y
                .saturating_add(height)
                .saturating_add(PANE_BORDER_CELLS);
        }

        let used = (((rows as u32) * height).saturating_add((rows as u32).saturating_sub(1)))
            .min(root_geometry.height);
        if let Some(last) = rows_cells.last_mut() {
            let extra = geometry.height.saturating_sub(used);
            if extra > 0 {
                last.resize_adjust(LayoutDirection::TopBottom, extra as i32);
            }
        }

        let mut root = LayoutCell::split(LayoutDirection::TopBottom, geometry, rows_cells);
        root.fix_offsets(0, 0);
        Self {
            root,
            leaf_map: None,
        }
    }
}

/// Builds a leaf map for mirrored layouts where tree order is [secondary..., main]
/// but pane assignment order is [main, secondary...].
fn mirrored_leaf_map(pane_count: usize) -> Vec<usize> {
    let mut map: Vec<usize> = (0..pane_count).collect();
    if pane_count >= 2 {
        map[0] = pane_count - 1;
        for (pane_pos, leaf_idx) in map.iter_mut().enumerate().skip(1) {
            *leaf_idx = pane_pos - 1;
        }
    }
    map
}

fn resolve_main_pane_size(total: u32, requested: Option<u32>, default: u32) -> u32 {
    let available = total.saturating_sub(PANE_BORDER_CELLS);
    let candidate = requested.unwrap_or(default).min(available);
    if candidate.saturating_add(PANE_MINIMUM) >= available {
        if available <= PANE_MINIMUM.saturating_mul(2) {
            PANE_MINIMUM.min(available)
        } else {
            available.saturating_sub(PANE_MINIMUM)
        }
    } else {
        candidate
    }
}

fn shift_cell(mut cell: LayoutCell, x: u32, y: u32) -> LayoutCell {
    cell.fix_offsets(x, y);
    cell
}

fn tiled_grid_size(pane_count: usize, max_columns: Option<usize>) -> (usize, usize) {
    let mut rows = 1_usize;
    let mut columns = 1_usize;

    while rows.saturating_mul(columns) < pane_count {
        rows += 1;
        if rows.saturating_mul(columns) < pane_count
            && max_columns.map(|limit| columns < limit).unwrap_or(true)
        {
            columns += 1;
        }
    }

    if let Some(limit) = max_columns {
        columns = columns.min(limit.max(1));
        rows = pane_count.div_ceil(columns.max(1));
    }

    (rows.max(1), columns.max(1))
}
