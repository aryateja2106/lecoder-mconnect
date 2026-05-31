use rmux_core::StyleAlign;

use super::{BucketIndex, Canvas, DrawBucket, ParsedFormatDraw};

pub(super) fn layout_parsed_line(canvas: &mut Canvas, parsed: &ParsedFormatDraw, available: usize) {
    match parsed.list_align {
        StyleAlign::Default => layout_without_list(canvas, parsed, available),
        StyleAlign::Left => layout_left_list(canvas, parsed, available),
        StyleAlign::Centre => layout_centre_list(canvas, parsed, available),
        StyleAlign::Right => layout_right_list(canvas, parsed, available),
        StyleAlign::AbsoluteCentre => layout_absolute_centre_list(canvas, parsed, available),
    }
}

/// Re-layout with merged buckets, discarding list state.
fn layout_fallback_without_list(
    canvas: &mut Canvas,
    parsed: &ParsedFormatDraw,
    available: usize,
    left: DrawBucket,
    centre: DrawBucket,
    right: DrawBucket,
    abs_centre: DrawBucket,
) {
    let fallback = ParsedFormatDraw {
        buckets: [
            left,
            centre,
            right,
            abs_centre,
            DrawBucket::default(),
            DrawBucket::default(),
            DrawBucket::default(),
            DrawBucket::default(),
        ],
        list_align: StyleAlign::Default,
        focus_start: None,
        focus_end: None,
        fill: parsed.fill,
    };
    layout_without_list(canvas, &fallback, available);
}

fn layout_without_list(canvas: &mut Canvas, parsed: &ParsedFormatDraw, available: usize) {
    let left = parsed.bucket(BucketIndex::Left);
    let centre = parsed.bucket(BucketIndex::Centre);
    let right = parsed.bucket(BucketIndex::Right);
    let abs_centre = parsed.bucket(BucketIndex::AbsoluteCentre);

    let mut width_left = left.width;
    let mut width_centre = centre.width;
    let mut width_right = right.width;
    let width_abs_centre = abs_centre.width.min(available);

    while width_left + width_centre + width_right > available {
        if width_centre > 0 {
            width_centre -= 1;
        } else if width_right > 0 {
            width_right -= 1;
        } else {
            width_left -= 1;
        }
    }

    overlay_bucket(canvas, left, 0, 0, width_left);
    overlay_bucket(
        canvas,
        right,
        available.saturating_sub(width_right),
        right.width.saturating_sub(width_right),
        width_right,
    );
    overlay_bucket(
        canvas,
        centre,
        width_left + ((available.saturating_sub(width_right)).saturating_sub(width_left)) / 2
            - width_centre / 2,
        centre.width / 2 - width_centre / 2,
        width_centre,
    );
    overlay_bucket(
        canvas,
        abs_centre,
        (available.saturating_sub(width_abs_centre)) / 2,
        0,
        width_abs_centre,
    );
}

fn layout_left_list(canvas: &mut Canvas, parsed: &ParsedFormatDraw, available: usize) {
    let left = parsed.bucket(BucketIndex::Left);
    let centre = parsed.bucket(BucketIndex::Centre);
    let right = parsed.bucket(BucketIndex::Right);
    let abs_centre = parsed.bucket(BucketIndex::AbsoluteCentre);
    let list = parsed.bucket(BucketIndex::List);
    let list_left = parsed.bucket(BucketIndex::ListLeft);
    let list_right = parsed.bucket(BucketIndex::ListRight);
    let after = parsed.bucket(BucketIndex::After);

    let mut width_left = left.width;
    let mut width_centre = centre.width;
    let mut width_right = right.width;
    let width_abs_centre = abs_centre.width.min(available);
    let mut width_list = list.width;
    let mut width_after = after.width;

    while width_left + width_centre + width_right + width_list + width_after > available {
        if width_centre > 0 {
            width_centre -= 1;
        } else if width_list > 0 {
            width_list -= 1;
        } else if width_right > 0 {
            width_right -= 1;
        } else if width_after > 0 {
            width_after -= 1;
        } else {
            width_left -= 1;
        }
    }

    if width_list == 0 {
        let mut merged_left = left.clone();
        merged_left.extend(after.slice(0, width_after));
        layout_fallback_without_list(
            canvas,
            parsed,
            available,
            merged_left,
            centre.clone(),
            right.clone(),
            abs_centre.clone(),
        );
        return;
    }

    overlay_bucket(canvas, left, 0, 0, width_left);
    overlay_bucket(
        canvas,
        right,
        available.saturating_sub(width_right),
        right.width.saturating_sub(width_right),
        width_right,
    );
    overlay_bucket(canvas, after, width_left + width_list, 0, width_after);
    overlay_bucket(
        canvas,
        centre,
        (width_left + width_list + width_after)
            + ((available.saturating_sub(width_right))
                .saturating_sub(width_left + width_list + width_after))
                / 2
            - width_centre / 2,
        centre.width / 2 - width_centre / 2,
        width_centre,
    );
    overlay_list(
        canvas,
        width_left,
        width_list,
        ListOverlay {
            list,
            list_left,
            list_right,
            focus_start: parsed.focus_start.unwrap_or(0),
            focus_end: parsed.focus_end.unwrap_or(0),
        },
    );
    overlay_bucket(
        canvas,
        abs_centre,
        (available.saturating_sub(width_abs_centre)) / 2,
        0,
        width_abs_centre,
    );
}

fn layout_centre_list(canvas: &mut Canvas, parsed: &ParsedFormatDraw, available: usize) {
    let left = parsed.bucket(BucketIndex::Left);
    let centre = parsed.bucket(BucketIndex::Centre);
    let right = parsed.bucket(BucketIndex::Right);
    let abs_centre = parsed.bucket(BucketIndex::AbsoluteCentre);
    let list = parsed.bucket(BucketIndex::List);
    let list_left = parsed.bucket(BucketIndex::ListLeft);
    let list_right = parsed.bucket(BucketIndex::ListRight);
    let after = parsed.bucket(BucketIndex::After);

    let mut width_left = left.width;
    let mut width_centre = centre.width;
    let mut width_right = right.width;
    let width_abs_centre = abs_centre.width.min(available);
    let mut width_list = list.width;
    let mut width_after = after.width;

    while width_left + width_centre + width_right + width_list + width_after > available {
        if width_list > 0 {
            width_list -= 1;
        } else if width_after > 0 {
            width_after -= 1;
        } else if width_centre > 0 {
            width_centre -= 1;
        } else if width_right > 0 {
            width_right -= 1;
        } else {
            width_left -= 1;
        }
    }

    if width_list == 0 {
        let mut merged_centre = centre.clone();
        merged_centre.extend(after.slice(0, width_after));
        layout_fallback_without_list(
            canvas,
            parsed,
            available,
            left.clone(),
            merged_centre,
            right.clone(),
            abs_centre.clone(),
        );
        return;
    }

    let middle = width_left
        + (available
            .saturating_sub(width_right)
            .saturating_sub(width_left))
            / 2;

    overlay_bucket(canvas, left, 0, 0, width_left);
    overlay_bucket(
        canvas,
        right,
        available.saturating_sub(width_right),
        right.width.saturating_sub(width_right),
        width_right,
    );
    overlay_bucket(
        canvas,
        centre,
        middle
            .saturating_sub(width_list / 2)
            .saturating_sub(width_centre),
        0,
        width_centre,
    );
    overlay_bucket(
        canvas,
        after,
        middle
            .saturating_sub(width_list / 2)
            .saturating_add(width_list),
        0,
        width_after,
    );
    overlay_list(
        canvas,
        middle.saturating_sub(width_list / 2),
        width_list,
        ListOverlay {
            list,
            list_left,
            list_right,
            focus_start: parsed.focus_start.unwrap_or(list.width / 2),
            focus_end: parsed.focus_end.unwrap_or(list.width / 2),
        },
    );
    overlay_bucket(
        canvas,
        abs_centre,
        (available.saturating_sub(width_abs_centre)) / 2,
        0,
        width_abs_centre,
    );
}

fn layout_right_list(canvas: &mut Canvas, parsed: &ParsedFormatDraw, available: usize) {
    let left = parsed.bucket(BucketIndex::Left);
    let centre = parsed.bucket(BucketIndex::Centre);
    let right = parsed.bucket(BucketIndex::Right);
    let abs_centre = parsed.bucket(BucketIndex::AbsoluteCentre);
    let list = parsed.bucket(BucketIndex::List);
    let list_left = parsed.bucket(BucketIndex::ListLeft);
    let list_right = parsed.bucket(BucketIndex::ListRight);
    let after = parsed.bucket(BucketIndex::After);

    let mut width_left = left.width;
    let mut width_centre = centre.width;
    let mut width_right = right.width;
    let width_abs_centre = abs_centre.width.min(available);
    let mut width_list = list.width;
    let mut width_after = after.width;

    while width_left + width_centre + width_right + width_list + width_after > available {
        if width_centre > 0 {
            width_centre -= 1;
        } else if width_list > 0 {
            width_list -= 1;
        } else if width_right > 0 {
            width_right -= 1;
        } else if width_after > 0 {
            width_after -= 1;
        } else {
            width_left -= 1;
        }
    }

    if width_list == 0 {
        let mut merged_right = right.clone();
        merged_right.extend(after.slice(0, width_after));
        layout_fallback_without_list(
            canvas,
            parsed,
            available,
            left.clone(),
            centre.clone(),
            merged_right,
            abs_centre.clone(),
        );
        return;
    }

    overlay_bucket(canvas, left, 0, 0, width_left);
    overlay_bucket(
        canvas,
        after,
        available.saturating_sub(width_after),
        after.width.saturating_sub(width_after),
        width_after,
    );
    overlay_bucket(
        canvas,
        right,
        available
            .saturating_sub(width_right)
            .saturating_sub(width_list)
            .saturating_sub(width_after),
        0,
        width_right,
    );
    overlay_bucket(
        canvas,
        centre,
        width_left
            + ((available
                .saturating_sub(width_right)
                .saturating_sub(width_list)
                .saturating_sub(width_after))
            .saturating_sub(width_left))
                / 2
            - width_centre / 2,
        centre.width / 2 - width_centre / 2,
        width_centre,
    );
    overlay_list(
        canvas,
        available
            .saturating_sub(width_list)
            .saturating_sub(width_after),
        width_list,
        ListOverlay {
            list,
            list_left,
            list_right,
            focus_start: parsed.focus_start.unwrap_or(0),
            focus_end: parsed.focus_end.unwrap_or(0),
        },
    );
    overlay_bucket(
        canvas,
        abs_centre,
        (available.saturating_sub(width_abs_centre)) / 2,
        0,
        width_abs_centre,
    );
}

fn layout_absolute_centre_list(canvas: &mut Canvas, parsed: &ParsedFormatDraw, available: usize) {
    let left = parsed.bucket(BucketIndex::Left);
    let centre = parsed.bucket(BucketIndex::Centre);
    let right = parsed.bucket(BucketIndex::Right);
    let abs_centre = parsed.bucket(BucketIndex::AbsoluteCentre);
    let list = parsed.bucket(BucketIndex::List);
    let list_left = parsed.bucket(BucketIndex::ListLeft);
    let list_right = parsed.bucket(BucketIndex::ListRight);
    let after = parsed.bucket(BucketIndex::After);

    let mut width_left = left.width;
    let mut width_centre = centre.width;
    let mut width_right = right.width;
    let mut width_abs_centre = abs_centre.width;
    let mut width_list = list.width;
    let mut width_after = after.width;

    while width_left + width_centre + width_right > available {
        if width_centre > 0 {
            width_centre -= 1;
        } else if width_right > 0 {
            width_right -= 1;
        } else {
            width_left -= 1;
        }
    }

    while width_list + width_after + width_abs_centre > available {
        if width_list > 0 {
            width_list -= 1;
        } else if width_after > 0 {
            width_after -= 1;
        } else {
            width_abs_centre -= 1;
        }
    }

    overlay_bucket(canvas, left, 0, 0, width_left);
    overlay_bucket(
        canvas,
        right,
        available.saturating_sub(width_right),
        right.width.saturating_sub(width_right),
        width_right,
    );

    let middle = width_left
        + (available
            .saturating_sub(width_right)
            .saturating_sub(width_left))
            / 2;
    overlay_bucket(
        canvas,
        centre,
        middle.saturating_sub(width_centre),
        0,
        width_centre,
    );

    let mut abs_offset = (available
        .saturating_sub(width_list)
        .saturating_sub(width_abs_centre))
        / 2;
    overlay_bucket(canvas, abs_centre, abs_offset, 0, width_abs_centre);
    abs_offset = abs_offset.saturating_add(width_abs_centre);
    overlay_list(
        canvas,
        abs_offset,
        width_list,
        ListOverlay {
            list,
            list_left,
            list_right,
            focus_start: parsed.focus_start.unwrap_or(list.width / 2),
            focus_end: parsed.focus_end.unwrap_or(list.width / 2),
        },
    );
    abs_offset = abs_offset.saturating_add(width_list);
    overlay_bucket(canvas, after, abs_offset, 0, width_after);
}

fn overlay_bucket(
    canvas: &mut Canvas,
    bucket: &DrawBucket,
    offset: usize,
    start: usize,
    width: usize,
) {
    if width == 0 {
        return;
    }
    canvas.overlay_cells(offset, &bucket.slice(start, width));
}

struct ListOverlay<'a> {
    list: &'a DrawBucket,
    list_left: &'a DrawBucket,
    list_right: &'a DrawBucket,
    focus_start: usize,
    focus_end: usize,
}

fn overlay_list(canvas: &mut Canvas, offset: usize, width: usize, list_overlay: ListOverlay<'_>) {
    if width == 0 || list_overlay.list.width == 0 {
        return;
    }

    if width >= list_overlay.list.width {
        overlay_bucket(canvas, list_overlay.list, offset, 0, width);
        return;
    }

    let focus_centre = list_overlay.focus_start
        + (list_overlay
            .focus_end
            .saturating_sub(list_overlay.focus_start))
            / 2;
    let mut start = focus_centre.saturating_sub(width / 2);
    if start + width > list_overlay.list.width {
        start = list_overlay.list.width.saturating_sub(width);
    }

    let mut draw_offset = offset;
    let mut draw_start = start;
    let mut draw_width = width;

    if start != 0 && width > list_overlay.list_left.width {
        overlay_bucket(
            canvas,
            list_overlay.list_left,
            draw_offset,
            0,
            list_overlay.list_left.width,
        );
        draw_offset += list_overlay.list_left.width;
        draw_start += list_overlay.list_left.width;
        draw_width = draw_width.saturating_sub(list_overlay.list_left.width);
    }
    if start + width < list_overlay.list.width && draw_width > list_overlay.list_right.width {
        overlay_bucket(
            canvas,
            list_overlay.list_right,
            draw_offset + draw_width - list_overlay.list_right.width,
            0,
            list_overlay.list_right.width,
        );
        draw_width = draw_width.saturating_sub(list_overlay.list_right.width);
    }

    overlay_bucket(
        canvas,
        list_overlay.list,
        draw_offset,
        draw_start,
        draw_width,
    );
}
