use super::*;

#[test]
fn string_scalar_append_concatenates_effective_value() {
    let mut store = OptionStore::new();

    store
        .set(
            ScopeSelector::Global,
            OptionName::StatusLeft,
            "[extra]".to_owned(),
            SetOptionMode::Append,
        )
        .expect("status-left append succeeds");

    assert_eq!(
        store.global_value(OptionName::StatusLeft),
        Some("[#{session_name}] [extra]")
    );
}

#[test]
fn user_options_require_a_non_empty_value() {
    let mut store = OptionStore::new();

    let error = store
        .set_by_name(
            OptionScopeSelector::SessionGlobal,
            "@empty",
            None,
            SetOptionMode::Replace,
            false,
            false,
            false,
        )
        .expect_err("missing user option value must fail");

    assert_eq!(error, RmuxError::InvalidSetOption("empty value".to_owned()));
}

#[test]
fn default_size_rejects_values_outside_tmux_pattern() {
    let mut store = OptionStore::new();

    let error = store
        .set(
            ScopeSelector::Session(session_name("alpha")),
            OptionName::DefaultSize,
            "80 by 24".to_owned(),
            SetOptionMode::Replace,
        )
        .expect_err("invalid default-size must fail");

    assert_eq!(
        error,
        RmuxError::InvalidSetOption("value is invalid: 80 by 24".to_owned())
    );
}

#[test]
fn user_option_set_and_resolve_at_session_global_scope() {
    let mut store = OptionStore::new();
    let alpha = session_name("alpha");

    store
        .set_by_name(
            OptionScopeSelector::SessionGlobal,
            "@my-var",
            Some("hello".to_owned()),
            SetOptionMode::Replace,
            false,
            false,
            false,
        )
        .expect("user option set succeeds");

    assert_eq!(
        store.resolve_name(Some(&alpha), "@my-var"),
        Some("hello".to_owned())
    );
}

#[test]
fn show_options_named_user_option_rejects_missing_scope_value() {
    let mut store = OptionStore::new();
    let alpha = session_name("alpha");
    let window = WindowTarget::with_window(alpha, 0);

    store
        .set_by_name(
            OptionScopeSelector::Window(window.clone()),
            "@wfoo",
            Some("win".to_owned()),
            SetOptionMode::Replace,
            false,
            false,
            false,
        )
        .expect("window user option set succeeds");

    assert_eq!(
        store
            .show_options_lines_filtered(&OptionScopeSelector::Window(window), Some("@wfoo"), true,)
            .expect("window user option is visible"),
        vec!["win".to_owned()]
    );
    assert_eq!(
        store
            .show_options_lines_filtered(&OptionScopeSelector::WindowGlobal, Some("@wfoo"), true)
            .expect_err("window-local user option is not global"),
        RmuxError::Message("invalid option: @wfoo".to_owned())
    );
    assert_eq!(
        store
            .show_options_lines_filtered(
                &OptionScopeSelector::SessionGlobal,
                Some("@missing"),
                true,
            )
            .expect_err("missing user option is invalid"),
        RmuxError::Message("invalid option: @missing".to_owned())
    );
}

#[test]
fn user_option_session_local_overrides_global() {
    let mut store = OptionStore::new();
    let alpha = session_name("alpha");
    let beta = session_name("beta");

    store
        .set_by_name(
            OptionScopeSelector::SessionGlobal,
            "@color",
            Some("red".to_owned()),
            SetOptionMode::Replace,
            false,
            false,
            false,
        )
        .expect("global set succeeds");

    store
        .set_by_name(
            OptionScopeSelector::Session(alpha.clone()),
            "@color",
            Some("blue".to_owned()),
            SetOptionMode::Replace,
            false,
            false,
            false,
        )
        .expect("session set succeeds");

    assert_eq!(
        store.resolve_name(Some(&alpha), "@color"),
        Some("blue".to_owned())
    );
    assert_eq!(
        store.resolve_name(Some(&beta), "@color"),
        Some("red".to_owned())
    );
}

#[test]
fn runtime_user_option_resolution_prefers_server_global_before_context_roots() {
    let mut store = OptionStore::new();
    let alpha = session_name("alpha");
    let window = WindowTarget::with_window(alpha.clone(), 2);
    let pane = PaneTarget::with_window(alpha.clone(), 2, 1);

    store
        .set_by_name(
            OptionScopeSelector::ServerGlobal,
            "@theme",
            Some("server".to_owned()),
            SetOptionMode::Replace,
            false,
            false,
            false,
        )
        .expect("server set succeeds");
    store
        .set_by_name(
            OptionScopeSelector::Session(alpha.clone()),
            "@theme",
            Some("session".to_owned()),
            SetOptionMode::Replace,
            false,
            false,
            false,
        )
        .expect("session set succeeds");
    store
        .set_by_name(
            OptionScopeSelector::Window(window),
            "@theme",
            Some("window".to_owned()),
            SetOptionMode::Replace,
            false,
            false,
            false,
        )
        .expect("window set succeeds");
    store
        .set_by_name(
            OptionScopeSelector::Pane(pane),
            "@theme",
            Some("pane".to_owned()),
            SetOptionMode::Replace,
            false,
            false,
            false,
        )
        .expect("pane set succeeds");

    assert_eq!(
        store.resolve_name(Some(&alpha), "@theme"),
        Some("server".to_owned())
    );
    assert_eq!(
        store.resolve_name_for_window(&alpha, 2, "@theme"),
        Some("server".to_owned())
    );
    assert_eq!(
        store.resolve_name_for_pane(&alpha, 2, 1, "@theme"),
        Some("server".to_owned())
    );
}

#[test]
fn runtime_user_option_resolution_prefers_window_chain_before_session_chain() {
    let mut store = OptionStore::new();
    let alpha = session_name("alpha");
    let pane = PaneTarget::with_window(alpha.clone(), 3, 0);

    store
        .set_by_name(
            OptionScopeSelector::Session(alpha.clone()),
            "@theme",
            Some("session".to_owned()),
            SetOptionMode::Replace,
            false,
            false,
            false,
        )
        .expect("session set succeeds");
    store
        .set_by_name(
            OptionScopeSelector::WindowGlobal,
            "@theme",
            Some("window-global".to_owned()),
            SetOptionMode::Replace,
            false,
            false,
            false,
        )
        .expect("window global set succeeds");
    store
        .set_by_name(
            OptionScopeSelector::Pane(pane),
            "@theme",
            Some("pane".to_owned()),
            SetOptionMode::Replace,
            false,
            false,
            false,
        )
        .expect("pane set succeeds");

    assert_eq!(
        store.resolve_name_for_window(&alpha, 3, "@theme"),
        Some("window-global".to_owned())
    );
    assert_eq!(
        store.resolve_name_for_pane(&alpha, 3, 0, "@theme"),
        Some("pane".to_owned())
    );
}

#[test]
fn user_option_rejects_array_index_syntax() {
    let result = super::resolve_option_name("@my-var[0]");
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("array indexes"));
}
