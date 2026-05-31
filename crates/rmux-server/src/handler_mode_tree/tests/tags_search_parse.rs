use super::*;

#[test]
fn toggle_tag_does_not_tag_no_tag_items() {
    let mut items = BTreeMap::new();
    items.insert(
        "header".to_owned(),
        ModeTreeItem {
            id: "header".to_owned(),
            parent: None,
            children: vec!["child".to_owned()],
            depth: 0,
            line: String::new(),
            search_text: String::new(),
            preview: Vec::new(),
            no_tag: true,
            action: ModeTreeAction::None,
        },
    );
    items.insert(
        "child".to_owned(),
        ModeTreeItem {
            id: "child".to_owned(),
            parent: Some("header".to_owned()),
            children: Vec::new(),
            depth: 1,
            line: String::new(),
            search_text: String::new(),
            preview: Vec::new(),
            no_tag: false,
            action: ModeTreeAction::None,
        },
    );
    let build = ModeTreeBuild {
        items,
        roots: vec!["header".to_owned()],
        order: vec!["header".to_owned(), "child".to_owned()],
        visible: vec!["header".to_owned(), "child".to_owned()],
        no_matches: false,
    };
    let mut mode = test_mode(10);
    mode.selected_id = Some("header".to_owned());
    toggle_tag(&mut mode, &build);
    assert!(mode.tagged.is_empty());
}

#[test]
fn toggle_tag_untags_ancestors_and_descendants() {
    let mut items = BTreeMap::new();
    items.insert(
        "parent".to_owned(),
        ModeTreeItem {
            id: "parent".to_owned(),
            parent: None,
            children: vec!["child".to_owned()],
            depth: 0,
            line: String::new(),
            search_text: String::new(),
            preview: Vec::new(),
            no_tag: false,
            action: ModeTreeAction::None,
        },
    );
    items.insert(
        "child".to_owned(),
        ModeTreeItem {
            id: "child".to_owned(),
            parent: Some("parent".to_owned()),
            children: vec!["grandchild".to_owned()],
            depth: 1,
            line: String::new(),
            search_text: String::new(),
            preview: Vec::new(),
            no_tag: false,
            action: ModeTreeAction::None,
        },
    );
    items.insert(
        "grandchild".to_owned(),
        ModeTreeItem {
            id: "grandchild".to_owned(),
            parent: Some("child".to_owned()),
            children: Vec::new(),
            depth: 2,
            line: String::new(),
            search_text: String::new(),
            preview: Vec::new(),
            no_tag: false,
            action: ModeTreeAction::None,
        },
    );
    let build = ModeTreeBuild {
        items,
        roots: vec!["parent".to_owned()],
        order: vec![
            "parent".to_owned(),
            "child".to_owned(),
            "grandchild".to_owned(),
        ],
        visible: vec![
            "parent".to_owned(),
            "child".to_owned(),
            "grandchild".to_owned(),
        ],
        no_matches: false,
    };
    let mut mode = test_mode(10);
    mode.tagged.insert("parent".to_owned());
    mode.tagged.insert("grandchild".to_owned());
    mode.selected_id = Some("child".to_owned());
    toggle_tag(&mut mode, &build);
    assert!(mode.tagged.contains("child"));
    assert!(
        !mode.tagged.contains("parent"),
        "ancestor should be untagged"
    );
    assert!(
        !mode.tagged.contains("grandchild"),
        "descendant should be untagged"
    );
}

#[test]
fn search_smart_case_lowercase_query_is_case_insensitive() {
    let build = flat_build(&["Alpha", "beta", "GAMMA"]);
    let mut mode = test_mode(10);
    mode.selected_id = Some("Alpha".to_owned());
    mode.search = Some(SearchState {
        value: "gamma".to_owned(),
        direction: SearchDirection::Forward,
    });
    repeat_search(&mut mode, &build, false);
    assert_eq!(mode.selected_id.as_deref(), Some("GAMMA"));
}

#[test]
fn search_mixed_case_query_is_case_sensitive() {
    let build = flat_build(&["Alpha", "beta", "GAMMA"]);
    let mut mode = test_mode(10);
    mode.selected_id = Some("Alpha".to_owned());
    mode.search = Some(SearchState {
        value: "Beta".to_owned(),
        direction: SearchDirection::Forward,
    });
    // "Beta" != "beta" in case-sensitive mode; no match
    repeat_search(&mut mode, &build, false);
    assert_eq!(mode.selected_id.as_deref(), Some("Alpha"));
}

#[test]
fn search_wraps_around() {
    let build = flat_build(&["a", "b", "c"]);
    let mut mode = test_mode(10);
    mode.selected_id = Some("c".to_owned());
    mode.search = Some(SearchState {
        value: "a".to_owned(),
        direction: SearchDirection::Forward,
    });
    repeat_search(&mut mode, &build, false);
    assert_eq!(mode.selected_id.as_deref(), Some("a"));
}

#[test]
fn search_backward_wraps_around() {
    let build = flat_build(&["a", "b", "c"]);
    let mut mode = test_mode(10);
    mode.selected_id = Some("a".to_owned());
    mode.search = Some(SearchState {
        value: "c".to_owned(),
        direction: SearchDirection::Backward,
    });
    repeat_search(&mut mode, &build, false);
    assert_eq!(mode.selected_id.as_deref(), Some("c"));
}

#[test]
fn parse_choose_tree_with_s_flag() {
    let parsed = CommandParser::new()
        .parse_one_group("choose-tree -s")
        .expect("parses");
    let mode = RequestHandler::parse_mode_tree_queue_command(parsed.commands()[0].clone())
        .expect("ok")
        .expect("recognized");
    assert_eq!(mode.tree_depth, TreeDepth::Session);
}

#[test]
fn parse_choose_tree_with_w_flag() {
    let parsed = CommandParser::new()
        .parse_one_group("choose-tree -w")
        .expect("parses");
    let mode = RequestHandler::parse_mode_tree_queue_command(parsed.commands()[0].clone())
        .expect("ok")
        .expect("recognized");
    assert_eq!(mode.tree_depth, TreeDepth::Window);
}

#[test]
fn parse_choose_tree_rejects_invalid_sort_order() {
    let parsed = CommandParser::new()
        .parse_one_group("choose-tree -O size")
        .expect("parses");
    let err = RequestHandler::parse_mode_tree_queue_command(parsed.commands()[0].clone());
    assert!(err.is_err());
}

#[test]
fn parse_choose_tree_rejects_unknown_flag() {
    let parsed = CommandParser::new()
        .parse_one_group("choose-tree -Q")
        .expect("parses");
    let err = RequestHandler::parse_mode_tree_queue_command(parsed.commands()[0].clone());
    assert!(err.is_err());
}

#[test]
fn parse_customize_mode_ignores_template_argument() {
    let parsed = CommandParser::new()
        .parse_one_group("customize-mode")
        .expect("parses");
    let mode = RequestHandler::parse_mode_tree_queue_command(parsed.commands()[0].clone())
        .expect("ok")
        .expect("recognized");
    assert!(mode.template.is_none());
    assert_eq!(mode.kind, ModeTreeKind::Customize);
}

#[test]
fn n_flag_single_disables_preview() {
    let parsed = CommandParser::new()
        .parse_one_group("choose-buffer -N")
        .expect("parses");
    let mode = RequestHandler::parse_mode_tree_queue_command(parsed.commands()[0].clone())
        .expect("ok")
        .expect("recognized");
    assert_eq!(mode.preview_mode, PreviewMode::Off);
}

#[test]
fn n_flag_double_enables_big_preview() {
    let parsed = CommandParser::new()
        .parse_one_group("choose-buffer -NN")
        .expect("parses");
    let mode = RequestHandler::parse_mode_tree_queue_command(parsed.commands()[0].clone())
        .expect("ok")
        .expect("recognized");
    assert_eq!(mode.preview_mode, PreviewMode::Big);
}

#[test]
fn selected_items_returns_tagged_or_selected() {
    let build = flat_build(&["a", "b", "c"]);
    let mut mode = test_mode(10);
    mode.selected_id = Some("a".to_owned());
    // No tags: falls back to selected
    let items = selected_items(&mode, &build);
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].id, "a");

    // With tags: returns tagged
    mode.tagged.insert("b".to_owned());
    mode.tagged.insert("c".to_owned());
    let items = selected_items(&mode, &build);
    assert_eq!(items.len(), 2);
}

#[test]
fn current_and_tagged_tree_kill_prompts_match_tmux_text() {
    let mut mode = test_mode(10);
    mode.selected_id = Some("window".to_owned());
    mode.tagged.insert("pane".to_owned());
    mode.tagged.insert("session".to_owned());

    let build = ModeTreeBuild {
        items: BTreeMap::from([
            (
                "session".to_owned(),
                ModeTreeItem {
                    id: "session".to_owned(),
                    parent: None,
                    children: vec!["window".to_owned()],
                    depth: 0,
                    line: String::new(),
                    search_text: String::new(),
                    preview: Vec::new(),
                    no_tag: false,
                    action: ModeTreeAction::TreeTarget {
                        session_name: SessionName::new("alpha").expect("valid session"),
                        window_index: None,
                        pane_index: None,
                        pane_id: None,
                    },
                },
            ),
            (
                "window".to_owned(),
                ModeTreeItem {
                    id: "window".to_owned(),
                    parent: Some("session".to_owned()),
                    children: vec!["pane".to_owned()],
                    depth: 1,
                    line: String::new(),
                    search_text: String::new(),
                    preview: Vec::new(),
                    no_tag: false,
                    action: ModeTreeAction::TreeTarget {
                        session_name: SessionName::new("alpha").expect("valid session"),
                        window_index: Some(3),
                        pane_index: None,
                        pane_id: None,
                    },
                },
            ),
            (
                "pane".to_owned(),
                ModeTreeItem {
                    id: "pane".to_owned(),
                    parent: Some("window".to_owned()),
                    children: Vec::new(),
                    depth: 2,
                    line: String::new(),
                    search_text: String::new(),
                    preview: Vec::new(),
                    no_tag: false,
                    action: ModeTreeAction::TreeTarget {
                        session_name: SessionName::new("alpha").expect("valid session"),
                        window_index: Some(3),
                        pane_index: Some(1),
                        pane_id: Some(42),
                    },
                },
            ),
        ]),
        roots: vec!["session".to_owned()],
        order: vec!["session".to_owned(), "window".to_owned(), "pane".to_owned()],
        visible: vec!["session".to_owned(), "window".to_owned(), "pane".to_owned()],
        no_matches: false,
    };

    assert_eq!(
        current_tree_kill_prompt(&mode, &build).as_deref(),
        Some("Kill window 3? ")
    );
    assert_eq!(
        tagged_tree_kill_prompt(&mode).as_deref(),
        Some("Kill 2 tagged? ")
    );
}
