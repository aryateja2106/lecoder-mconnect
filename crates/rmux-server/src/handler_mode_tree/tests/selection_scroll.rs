use super::*;

#[test]
fn ensure_selected_visible_scrolls_down_past_viewport() {
    let mut mode = test_mode(3);
    mode.scroll = 0;
    ensure_selected_visible(&mut mode, 5);
    assert_eq!(mode.scroll, 3);
}

#[test]
fn ensure_selected_visible_scrolls_up() {
    let mut mode = test_mode(3);
    mode.scroll = 5;
    ensure_selected_visible(&mut mode, 2);
    assert_eq!(mode.scroll, 2);
}

#[test]
fn ensure_selected_visible_noop_when_in_viewport() {
    let mut mode = test_mode(5);
    mode.scroll = 2;
    ensure_selected_visible(&mut mode, 4);
    assert_eq!(mode.scroll, 2);
}

#[test]
fn clamp_scroll_bounds_to_visible_length() {
    let build = flat_build(&["a", "b", "c"]);
    let mut mode = test_mode(5);
    mode.scroll = 10;
    mode.selected_id = Some("c".to_owned());
    clamp_scroll(&mut mode, &build);
    assert!(mode.scroll <= 2);
}

#[test]
fn clamp_scroll_resets_on_empty_build() {
    let build = flat_build(&[]);
    let mut mode = test_mode(5);
    mode.scroll = 5;
    clamp_scroll(&mut mode, &build);
    assert_eq!(mode.scroll, 0);
}

#[test]
fn move_selection_wraps_at_boundaries() {
    let build = flat_build(&["a", "b", "c"]);
    let mut mode = test_mode(10);
    mode.selected_id = Some("c".to_owned());

    move_selection(&mut mode, &build, 1, true);
    assert_eq!(mode.selected_id.as_deref(), Some("a"));

    mode.selected_id = Some("a".to_owned());
    move_selection(&mut mode, &build, -1, true);
    assert_eq!(mode.selected_id.as_deref(), Some("c"));
}

#[test]
fn move_selection_without_wrap_saturates_at_boundaries() {
    let build = flat_build(&["a", "b", "c"]);
    let mut mode = test_mode(10);
    mode.selected_id = Some("c".to_owned());

    move_selection(&mut mode, &build, 5, false);
    assert_eq!(mode.selected_id.as_deref(), Some("c"));

    mode.selected_id = Some("a".to_owned());
    move_selection(&mut mode, &build, -5, false);
    assert_eq!(mode.selected_id.as_deref(), Some("a"));
}

#[test]
fn move_selection_from_none_selects_first() {
    let build = flat_build(&["a", "b"]);
    let mut mode = test_mode(10);
    mode.selected_id = None;
    move_selection(&mut mode, &build, 1, true);
    assert_eq!(mode.selected_id.as_deref(), Some("a"));
}

#[test]
fn cycle_sort_wraps_around_order_seq() {
    let mut mode = test_mode(10);
    mode.sort_order = Some(SortOrder::Activity);
    cycle_sort(&mut mode);
    assert_eq!(mode.sort_order, Some(SortOrder::Index));
}

#[test]
fn cycle_sort_noop_on_empty_seq() {
    let mut mode = test_mode(10);
    mode.order_seq = Vec::new();
    mode.sort_order = None;
    cycle_sort(&mut mode);
    assert_eq!(mode.sort_order, None);
}

#[test]
fn preview_mode_cycle_is_off_big_normal_off() {
    assert_eq!(PreviewMode::Off.cycle(), PreviewMode::Big);
    assert_eq!(PreviewMode::Big.cycle(), PreviewMode::Normal);
    assert_eq!(PreviewMode::Normal.cycle(), PreviewMode::Off);
}

#[test]
fn tree_item_display_line_uses_tmux_name_text_shape() {
    assert_eq!(
        tree_item_display_line("alpha", "3 windows (attached)"),
        "alpha: 3 windows (attached)"
    );
    assert_eq!(tree_item_display_line("0", "bash*"), "0: bash*");
    assert_eq!(tree_item_display_line("0", ""), "0");
}
