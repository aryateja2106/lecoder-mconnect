use super::*;

#[test]
fn tree_preview_layout_matches_tmux_gutters_when_not_all_items_fit() {
    let layout = tree_preview_layout(5, 2, 60).expect("layout");
    assert_eq!(layout.start, 1);
    assert_eq!(layout.end, 3);
    assert!(layout.left);
    assert!(layout.right);
    assert_eq!(layout.each, 27);
    assert_eq!(layout.remaining, 0);
}

#[test]
fn render_tree_columns_preview_draws_real_columns_and_label_boxes() {
    let utf8 = Utf8Config::default();
    let inactive = Style::parse("fg=blue").expect("style parses");
    let active = Style::parse("fg=red").expect("style parses");
    let lines = render_tree_columns_preview(
        vec![
            PreviewColumn {
                label: " 0:alpha ".to_owned(),
                label_area_width: 29,
                lines: vec!["left".to_owned(); 7],
            },
            PreviewColumn {
                label: " 1:beta ".to_owned(),
                label_area_width: 30,
                lines: vec!["right".to_owned(); 7],
            },
        ],
        0,
        60,
        7,
        &inactive,
        &active,
        &utf8,
    );

    assert_eq!(lines.len(), 7);
    assert!(lines.iter().any(|line| line.contains("left")));
    assert!(lines.iter().any(|line| line.contains("right")));
    assert!(lines.iter().any(|line| line.contains('│')));
    assert!(lines.iter().any(|line| line.contains("0:alpha")));
    assert!(lines.iter().any(|line| line.contains("1:beta")));
    assert!(
        lines.iter().any(|line| line.contains("#[fg=red] 0:alpha ")),
        "active preview label should carry display-panes-active-colour"
    );
}

#[test]
fn preview_lines_for_screen_preserves_cell_colours() {
    let mut screen = Screen::new(TerminalSize { cols: 20, rows: 5 }, 0);
    let mut parser = InputParser::new();
    parser.parse(b"\x1b[32mRMUXHOST\x1b[0m\r\n", &mut screen);

    let lines = preview_lines_for_screen(&screen, 3, 20, &Utf8Config::default());
    assert!(
        lines
            .iter()
            .any(|line| line.contains("#[fg=green]RMUXHOST#[default]")),
        "screen preview should preserve shell prompt colours"
    );
}

#[test]
fn preview_vertical_offset_follows_tmux_cursor_bias() {
    let mut screen = Screen::new(TerminalSize { cols: 20, rows: 10 }, 0);
    let mut parser = InputParser::new();
    parser.parse(b"1\r\n2\r\n3\r\n4\r\n5\r\n6\r\n7\r\n", &mut screen);

    assert_eq!(preview_vertical_offset(&screen, 4), 6);
}

#[test]
fn preview_horizontal_offset_follows_tmux_cursor_bias() {
    let mut screen = Screen::new(TerminalSize { cols: 20, rows: 3 }, 0);
    let mut parser = InputParser::new();
    parser.parse(b"0123456789abcdef", &mut screen);

    assert_eq!(preview_horizontal_offset(&screen, 8), 12);
}

#[test]
fn preview_lines_for_screen_uses_tmux_horizontal_cursor_window() {
    let mut screen = Screen::new(TerminalSize { cols: 20, rows: 3 }, 0);
    let mut parser = InputParser::new();
    parser.parse(b"0123456789abcdef", &mut screen);

    let lines = preview_lines_for_screen(&screen, 2, 8, &Utf8Config::default());

    assert!(
        lines[0].contains("cdef"),
        "preview should follow tmux and show the tail near the cursor, got {:?}",
        lines[0]
    );
    assert!(
        !lines[0].contains("0123"),
        "preview should not stay pinned to the far left once the cursor is to the right, got {:?}",
        lines[0]
    );
}

#[test]
fn render_preview_segment_row_pads_empty_preview_rows_to_full_width() {
    let inactive = Style::default();
    let column = PreviewColumn {
        label: " 0 ".to_owned(),
        label_area_width: 8,
        lines: vec![String::new()],
    };

    let rendered = render_preview_segment_row(
        &column,
        0,
        8,
        column.label_area_width,
        5,
        &inactive,
        &Utf8Config::default(),
    );

    assert_eq!(rendered, "        ");
}

#[test]
fn render_preview_segment_row_preserves_formatted_preview_lines() {
    let inactive = Style::default();
    let column = PreviewColumn {
        label: " 0 ".to_owned(),
        label_area_width: 6,
        lines: vec!["#[fg=green]abcdef#[default]".to_owned()],
    };

    let rendered = render_preview_segment_row(
        &column,
        0,
        6,
        column.label_area_width,
        5,
        &inactive,
        &Utf8Config::default(),
    );

    assert_eq!(rendered, "#[fg=green]abcdef#[default]");
}

#[test]
fn tree_window_preview_label_matches_tmux_padding() {
    assert_eq!(tree_window_preview_label(3), " 3 ");
}

#[test]
fn render_preview_segment_row_uses_tmux_ceiling_centre_for_box_labels() {
    let inactive = Style::default();
    let column = PreviewColumn {
        label: " 3 ".to_owned(),
        label_area_width: 8,
        lines: Vec::new(),
    };

    let rendered = render_preview_segment_row(
        &column,
        3,
        7,
        column.label_area_width,
        5,
        &inactive,
        &Utf8Config::default(),
    );

    assert!(
        rendered.starts_with("  │"),
        "tmux centres the pane box label with div_ceil, got {rendered:?}"
    );
}

#[test]
fn preview_lines_for_screen_marks_cursor_cell_reverse_like_tmux() {
    let mut screen = Screen::new(TerminalSize { cols: 20, rows: 3 }, 0);
    let mut parser = InputParser::new();
    parser.parse(b"prompt> ", &mut screen);

    let lines = preview_lines_for_screen(&screen, 1, 10, &Utf8Config::default());

    assert!(
        lines[0].contains("reverse"),
        "preview should reverse the cursor cell like tmux, got {:?}",
        lines[0]
    );
}

#[test]
fn preview_lines_for_screen_shows_top_content_instead_of_blank_tail() {
    let mut screen = Screen::new(TerminalSize { cols: 20, rows: 10 }, 0);
    let mut parser = InputParser::new();
    parser.parse(b"top\r\n", &mut screen);

    let lines = preview_lines_for_screen(&screen, 4, 20, &Utf8Config::default());

    assert!(
        lines.iter().any(|line| line.contains("top")),
        "cursor-anchored preview should keep top content visible"
    );
}

#[test]
fn mode_tree_list_rows_disables_preview_when_terminal_is_too_small() {
    assert_eq!(mode_tree_list_rows(3, 20, PreviewMode::Normal), 3);
    assert_eq!(mode_tree_list_rows(5, 20, PreviewMode::Normal), 5);
}

#[test]
fn mode_tree_list_rows_uses_all_rows_when_preview_is_off() {
    assert_eq!(mode_tree_list_rows(100, 20, PreviewMode::Off), 100);
    assert_eq!(mode_tree_list_rows(0, 20, PreviewMode::Off), 0);
}
