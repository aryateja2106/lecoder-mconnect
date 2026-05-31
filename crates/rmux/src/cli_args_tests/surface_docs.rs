use super::*;

#[test]
fn top_level_help_footer_tracks_supported_surface_and_aliases() {
    let error = parse_args(&["--help"]).unwrap_err();
    let rendered = error.to_string();

    assert!(rendered.contains("list-commands (lscm)"));
    assert!(rendered.contains("set-window-option (setw)"));
    assert!(rendered.contains("show-window-options (showw)"));
    assert!(rendered.contains("choose-window => choose-tree -w"));
    assert!(rendered.contains("choose-session => choose-tree -s"));
    assert!(rendered.contains("display-menu (menu)"));
    assert!(rendered.contains("display-popup (popup)"));
    assert!(rendered.contains("clear-prompt-history (clearphist)"));
    assert!(rendered.contains("show-prompt-history (showphist)"));
}

#[test]
fn raw_cli_top_level_flags_match_tmux_usage_contract() {
    let mut switch_flags = BTreeSet::new();
    let mut valued_flags = BTreeSet::new();

    for argument in super::super::RawCli::command().get_arguments() {
        let Some(short) = argument.get_short() else {
            continue;
        };

        match argument.get_action() {
            ArgAction::Set | ArgAction::Append => {
                valued_flags.insert(short);
            }
            ArgAction::SetTrue | ArgAction::Count | ArgAction::Help | ArgAction::Version => {
                switch_flags.insert(short);
            }
            action => panic!("unexpected top-level arg action for -{short}: {action:?}"),
        }
    }

    assert_eq!(
        switch_flags,
        BTreeSet::from(['2', 'C', 'D', 'N', 'l', 'u', 'v'])
    );
    assert_eq!(valued_flags, BTreeSet::from(['L', 'S', 'T', 'c', 'f']));

    let help = super::super::RawCli::command().try_get_matches_from(["rmux", "-h"]);
    assert!(matches!(
        help,
        Err(error) if error.kind() == clap::error::ErrorKind::DisplayHelp
    ));

    let version = super::super::RawCli::command().try_get_matches_from(["rmux", "-V"]);
    assert!(matches!(
        version,
        Err(error) if error.kind() == clap::error::ErrorKind::DisplayVersion
    ));
}

#[test]
fn implemented_surface_matches_the_full_tmux_command_table() {
    let expected = super::super::COMMAND_TABLE
        .iter()
        .map(rendered_surface_entry)
        .collect::<Vec<_>>();
    let actual = super::super::implemented_command_surface()
        .iter()
        .map(|entry| rendered_surface_entry(entry))
        .collect::<Vec<_>>();

    assert_eq!(actual, expected);

    for entry in super::super::COMMAND_TABLE {
        assert!(
            help_dispatch_is_supported(entry.name),
            "{} dropped out of the public help/dispatch surface",
            entry.name
        );
    }
}

#[test]
fn default_key_bindings_reference_only_implemented_commands() {
    let implemented = super::super::implemented_command_surface()
        .iter()
        .map(|entry| entry.name.to_owned())
        .collect::<BTreeSet<_>>();
    let store = rmux_core::KeyBindingStore::default();
    let mut referenced = BTreeSet::new();

    for binding in store.list_bindings(None, rmux_core::KeyBindingSortOrder::Name, false) {
        collect_nested_command_names(binding.binding().commands(), &mut referenced);
    }

    let unknown = referenced
        .difference(&implemented)
        .cloned()
        .collect::<BTreeSet<_>>();
    assert!(
        unknown.is_empty(),
        "default list-keys bindings reference commands outside the implemented inventory: {unknown:?}"
    );
    assert!(
        referenced.contains("list-keys"),
        "serverless default-table list-keys should be represented in default bindings"
    );
}

#[test]
fn supported_commands_do_not_treat_short_h_as_clap_help() {
    for entry in super::super::implemented_command_surface() {
        if let Err(error) = parse_args(&[entry.name, "-h"]) {
            assert_ne!(
                error.kind(),
                clap::error::ErrorKind::DisplayHelp,
                "{} consumed -h as Clap help",
                entry.name
            );
        }
    }
}

#[test]
fn manpage_surface_matches_implemented_commands_and_aliases() {
    let manpage = repo_file("rmux.1");
    let surface_entries = troff_literal_block(
        &manpage,
        ".SH IMPLEMENTED COMMAND SURFACE",
        ".SH BUILT-IN COMMAND ALIASES",
    );
    let expected_entries = super::super::implemented_command_surface()
        .iter()
        .map(|entry| rendered_surface_entry(entry))
        .collect::<Vec<_>>();
    assert_eq!(surface_entries, expected_entries);
    assert!(manpage.contains(&format!(
        "The public CLI dispatches {} commands:",
        expected_entries.len()
    )));

    let alias_section = troff_section(&manpage, ".SH BUILT-IN COMMAND ALIASES", ".SH NOTES");
    for alias in super::super::documented_cli_aliases() {
        assert!(alias_section.contains(&format!(".B {}", alias.alias)));
        assert!(alias_section.contains(&format!(".BR \"{}\" .", alias.expansion)));
    }

    assert!(manpage.contains(".B -Vh"));
    assert!(manpage.contains(".BR \"rmux <command> --help\" ."));
    assert!(manpage.contains(".BR \"rmux split-window -h\" ."));
}

fn collect_nested_command_names(
    commands: &rmux_core::command_parser::ParsedCommands,
    names: &mut BTreeSet<String>,
) {
    for command in commands.commands() {
        names.insert(command.name().to_owned());
        for argument in command.arguments() {
            if let rmux_core::command_parser::CommandArgument::Commands(nested) = argument {
                collect_nested_command_names(nested, names);
            }
        }
    }
}
