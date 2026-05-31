use super::*;

#[test]
fn tmux_format_table_names_is_sorted_and_unique() {
    for pair in super::TMUX_FORMAT_TABLE_NAMES.windows(2) {
        assert!(
            pair[0] < pair[1],
            "TMUX_FORMAT_TABLE_NAMES not sorted: {:?} >= {:?}",
            pair[0],
            pair[1]
        );
    }
}

#[test]
fn tmux_time_format_variable_names_is_sorted_and_subset() {
    for pair in super::TMUX_TIME_FORMAT_VARIABLE_NAMES.windows(2) {
        assert!(
            pair[0] < pair[1],
            "TMUX_TIME_FORMAT_VARIABLE_NAMES not sorted: {:?} >= {:?}",
            pair[0],
            pair[1]
        );
    }
    for name in super::TMUX_TIME_FORMAT_VARIABLE_NAMES {
        assert!(
            super::TMUX_FORMAT_TABLE_NAMES.binary_search(&name).is_ok(),
            "TIME variable {name:?} not in TMUX_FORMAT_TABLE_NAMES"
        );
    }
}

#[test]
fn is_known_format_variable_name_covers_enum_and_table() {
    for variable in super::FORMAT_VARIABLES {
        assert!(
            super::is_known_format_variable_name(variable.name()),
            "enum variable {:?} not recognized by is_known",
            variable.name()
        );
    }
    for name in super::TMUX_FORMAT_TABLE_NAMES {
        assert!(
            super::is_known_format_variable_name(name),
            "table variable {name:?} not recognized by is_known"
        );
    }
    assert!(!super::is_known_format_variable_name("nonexistent_var"));
    assert!(!super::is_known_format_variable_name("@user_option"));
}

// -----------------------------------------------------------------------
// Hardening tests — time formatting
// -----------------------------------------------------------------------

#[test]
fn time_modifier_with_epoch_zero() {
    struct TimeVars;
    impl FormatVariables for TimeVars {
        fn format_value(&self, _: FormatVariable) -> Option<String> {
            None
        }
        fn format_value_by_name(&self, name: &str) -> Option<String> {
            match name {
                "session_created" => Some("0".to_owned()),
                _ => None,
            }
        }
    }
    let result = render_template("#{t:session_created}", &TimeVars);
    assert_eq!(result, "", "tmux renders epoch 0 time formats as empty");
}

#[test]
fn time_modifier_with_non_numeric_value() {
    struct TimeVars;
    impl FormatVariables for TimeVars {
        fn format_value(&self, _: FormatVariable) -> Option<String> {
            None
        }
        fn format_value_by_name(&self, name: &str) -> Option<String> {
            match name {
                "session_created" => Some("not-a-number".to_owned()),
                _ => None,
            }
        }
    }
    // Non-numeric input to `t` modifier should produce empty (graceful).
    let result = render_template("#{t:session_created}", &TimeVars);
    assert_eq!(result, "");
}

// -----------------------------------------------------------------------
// Hardening tests — truncation edge cases
// -----------------------------------------------------------------------
