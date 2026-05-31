use crate::{Pane, PaneGeometry, Window};

pub(super) fn directional_pane(window: &Window, value: &str) -> Option<u32> {
    let direction = match value {
        "{up-of}" => Direction::Up,
        "{down-of}" => Direction::Down,
        "{left-of}" => Direction::Left,
        "{right-of}" => Direction::Right,
        _ => return None,
    };
    find_neighbor(window, direction)
}

pub(super) fn pane_description(window: &Window, value: &str) -> Option<u32> {
    let corner = match value {
        "top" => return pane_with_minimum(window, |geometry| geometry.y() as u32),
        "bottom" => {
            return pane_with_maximum(window, |geometry| {
                u32::from(geometry.y()) + u32::from(geometry.rows())
            });
        }
        "left" => return pane_with_minimum(window, |geometry| geometry.x() as u32),
        "right" => {
            return pane_with_maximum(window, |geometry| {
                u32::from(geometry.x()) + u32::from(geometry.cols())
            });
        }
        "top-left" => Corner::TopLeft,
        "top-right" => Corner::TopRight,
        "bottom-left" => Corner::BottomLeft,
        "bottom-right" => Corner::BottomRight,
        _ => return None,
    };
    pane_in_corner(window, corner)
}

#[derive(Debug, Clone, Copy)]
enum Direction {
    Up,
    Down,
    Left,
    Right,
}

#[derive(Debug, Clone, Copy)]
enum Corner {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

fn find_neighbor(window: &Window, direction: Direction) -> Option<u32> {
    let active = window.active_pane()?;
    let active_geometry = active.geometry();
    let mut candidate = None;

    for pane in window
        .panes()
        .iter()
        .filter(|pane| pane.index() != active.index())
    {
        if !neighbor_matches(
            active_geometry,
            pane.geometry(),
            direction,
            window.size().cols.into(),
            window.size().rows.into(),
        ) {
            continue;
        }
        match candidate {
            Some((best_active_point, _)) if pane.active_point() <= best_active_point => {}
            _ => candidate = Some((pane.active_point(), pane.index())),
        }
    }

    candidate.map(|(_, pane_index)| pane_index)
}

fn neighbor_matches(
    active: PaneGeometry,
    candidate: PaneGeometry,
    direction: Direction,
    window_cols: u32,
    window_rows: u32,
) -> bool {
    match direction {
        Direction::Up => {
            let mut edge = u32::from(active.y());
            if edge == 0 {
                edge = window_rows.saturating_add(1);
            }
            bottom(candidate).saturating_add(1) == edge && horizontal_overlap(active, candidate)
        }
        Direction::Down => {
            let mut edge = bottom(active).saturating_add(1);
            if edge >= window_rows {
                edge = 0;
            }
            u32::from(candidate.y()) == edge && horizontal_overlap(active, candidate)
        }
        Direction::Left => {
            let mut edge = u32::from(active.x());
            if edge == 0 {
                edge = window_cols.saturating_add(1);
            }
            right(candidate).saturating_add(1) == edge && vertical_overlap(active, candidate)
        }
        Direction::Right => {
            let mut edge = right(active).saturating_add(1);
            if edge >= window_cols {
                edge = 0;
            }
            u32::from(candidate.x()) == edge && vertical_overlap(active, candidate)
        }
    }
}

fn pane_with_minimum(window: &Window, value: impl Fn(PaneGeometry) -> u32) -> Option<u32> {
    window
        .panes()
        .iter()
        .min_by_key(|pane| (value(pane.geometry()), pane.index()))
        .map(Pane::index)
}

fn pane_with_maximum(window: &Window, value: impl Fn(PaneGeometry) -> u32) -> Option<u32> {
    window
        .panes()
        .iter()
        .max_by_key(|pane| (value(pane.geometry()), std::cmp::Reverse(pane.index())))
        .map(Pane::index)
}

fn pane_in_corner(window: &Window, corner: Corner) -> Option<u32> {
    window
        .panes()
        .iter()
        .min_by_key(|pane| corner_score(pane.geometry(), corner))
        .map(Pane::index)
}

fn corner_score(geometry: PaneGeometry, corner: Corner) -> (u32, u32, u32) {
    match corner {
        Corner::TopLeft => (u32::from(geometry.y()), u32::from(geometry.x()), 0),
        Corner::TopRight => (
            u32::from(geometry.y()),
            u32::MAX - right(geometry),
            u32::from(geometry.x()),
        ),
        Corner::BottomLeft => (
            u32::MAX - bottom(geometry),
            u32::from(geometry.x()),
            u32::from(geometry.y()),
        ),
        Corner::BottomRight => (
            u32::MAX - bottom(geometry),
            u32::MAX - right(geometry),
            u32::from(geometry.x()),
        ),
    }
}

fn horizontal_overlap(left: PaneGeometry, right: PaneGeometry) -> bool {
    ranges_overlap(
        u32::from(left.x()),
        self::right(left),
        u32::from(right.x()),
        self::right(right),
    )
}

fn vertical_overlap(left: PaneGeometry, right: PaneGeometry) -> bool {
    ranges_overlap(
        u32::from(left.y()),
        bottom(left),
        u32::from(right.y()),
        bottom(right),
    )
}

fn ranges_overlap(left_start: u32, left_end: u32, right_start: u32, right_end: u32) -> bool {
    left_start < right_end && right_start < left_end
}

fn right(geometry: PaneGeometry) -> u32 {
    u32::from(geometry.x()) + u32::from(geometry.cols())
}

fn bottom(geometry: PaneGeometry) -> u32 {
    u32::from(geometry.y()) + u32::from(geometry.rows())
}
