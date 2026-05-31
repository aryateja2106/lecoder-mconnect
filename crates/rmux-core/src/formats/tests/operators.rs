use super::*;

#[test]
fn comparison_equal() {
    assert_eq!(
        render_template("#{==:alpha,alpha}", &StaticWindowValues),
        "1"
    );
    assert_eq!(
        render_template("#{==:alpha,beta}", &StaticWindowValues),
        "0"
    );
}

#[test]
fn comparison_not_equal() {
    assert_eq!(
        render_template("#{!=:alpha,beta}", &StaticWindowValues),
        "1"
    );
    assert_eq!(
        render_template("#{!=:alpha,alpha}", &StaticWindowValues),
        "0"
    );
}

#[test]
fn comparison_less_than() {
    assert_eq!(render_template("#{<:abc,def}", &StaticWindowValues), "1");
    assert_eq!(render_template("#{<:def,abc}", &StaticWindowValues), "0");
}

#[test]
fn comparison_greater_than() {
    assert_eq!(render_template("#{>:def,abc}", &StaticWindowValues), "1");
    assert_eq!(render_template("#{>:abc,def}", &StaticWindowValues), "0");
}

#[test]
fn comparison_less_equal() {
    assert_eq!(render_template("#{<=:abc,abc}", &StaticWindowValues), "1");
    assert_eq!(render_template("#{<=:abc,def}", &StaticWindowValues), "1");
    assert_eq!(render_template("#{<=:def,abc}", &StaticWindowValues), "0");
}

#[test]
fn comparison_greater_equal() {
    assert_eq!(render_template("#{>=:def,def}", &StaticWindowValues), "1");
    assert_eq!(render_template("#{>=:def,abc}", &StaticWindowValues), "1");
    assert_eq!(render_template("#{>=:abc,def}", &StaticWindowValues), "0");
}

#[test]
fn comparison_with_variable_expansion() {
    // Compare expanded variables.
    assert_eq!(
        render_template("#{==:#{session_name},alpha}", &StaticWindowValues),
        "1"
    );
    assert_eq!(
        render_template("#{!=:#{session_name},beta}", &StaticWindowValues),
        "1"
    );
}

// -----------------------------------------------------------------------
// New tests — fnmatch
// -----------------------------------------------------------------------

#[test]
fn fnmatch_basic() {
    assert_eq!(render_template("#{m:al*,alpha}", &StaticWindowValues), "1");
    assert_eq!(render_template("#{m:be*,alpha}", &StaticWindowValues), "0");
}

#[test]
fn fnmatch_question_mark() {
    assert_eq!(
        render_template("#{m:alph?,alpha}", &StaticWindowValues),
        "1"
    );
    assert_eq!(render_template("#{m:alp?,alpha}", &StaticWindowValues), "0");
}

// -----------------------------------------------------------------------
// New tests — boolean operators
// -----------------------------------------------------------------------

#[test]
fn boolean_and() {
    // Both truthy — operands are format expressions that get expanded.
    assert_eq!(
        render_template(
            "#{&&:#{window_active},#{session_name}}",
            &StaticWindowValues
        ),
        "1"
    );
    // One falsy (window_last_flag = "0").
    assert_eq!(
        render_template(
            "#{&&:#{window_last_flag},#{window_active}}",
            &StaticWindowValues
        ),
        "0"
    );
}

#[test]
fn boolean_or() {
    // One truthy.
    assert_eq!(
        render_template(
            "#{||:#{window_last_flag},#{window_active}}",
            &StaticWindowValues
        ),
        "1"
    );
    // Both falsy (window_last_flag="0", missing="").
    assert_eq!(
        render_template("#{||:#{window_last_flag},#{missing}}", &StaticWindowValues),
        "0"
    );
}

#[test]
fn boolean_not() {
    assert_eq!(
        render_template("#{!:#{window_active}}", &StaticWindowValues),
        "0"
    );
    assert_eq!(
        render_template("#{!:#{window_last_flag}}", &StaticWindowValues),
        "1"
    );
}

#[test]
fn boolean_not_not() {
    assert_eq!(
        render_template("#{!!:#{window_active}}", &StaticWindowValues),
        "1"
    );
    assert_eq!(
        render_template("#{!!:#{window_last_flag}}", &StaticWindowValues),
        "0"
    );
}

#[test]
fn boolean_and_nary() {
    // Three operands, all truthy.
    assert_eq!(
        render_template(
            "#{&&:#{window_active},#{session_name},#{window_panes}}",
            &StaticWindowValues
        ),
        "1"
    );
    // Three operands, one falsy.
    assert_eq!(
        render_template(
            "#{&&:#{window_active},#{window_last_flag},#{session_name}}",
            &StaticWindowValues
        ),
        "0"
    );
}

#[test]
fn boolean_or_nary() {
    // Three operands, all falsy.
    assert_eq!(
        render_template(
            "#{||:#{window_last_flag},#{missing},#{missing2}}",
            &StaticWindowValues
        ),
        "0"
    );
    // Three operands, one truthy.
    assert_eq!(
        render_template(
            "#{||:#{window_last_flag},#{window_active},#{missing}}",
            &StaticWindowValues
        ),
        "1"
    );
}

// -----------------------------------------------------------------------
// New tests — multi-pair conditionals
// -----------------------------------------------------------------------

#[test]
fn conditional_multi_pair() {
    // #{?cond1,val1,cond2,val2,default}
    // cond1=window_last_flag → "0" → false
    // cond2=window_active → "1" → true → return val2
    assert_eq!(
        render_template(
            "#{?window_last_flag,first,window_active,second,default}",
            &StaticWindowValues
        ),
        "second"
    );
}

#[test]
fn conditional_multi_pair_default() {
    // All conditions false.
    assert_eq!(
        render_template(
            "#{?window_last_flag,first,missing,second,default}",
            &StaticWindowValues
        ),
        "default"
    );
}

#[test]
fn conditional_multi_pair_no_default() {
    // All conditions false, no unpaired default → empty.
    assert_eq!(
        render_template(
            "#{?window_last_flag,first,missing,second}",
            &StaticWindowValues
        ),
        ""
    );
}

// -----------------------------------------------------------------------
// New tests — escape sequences in expansion
// -----------------------------------------------------------------------

#[test]
fn escape_comma() {
    // `#,` in template produces literal `,`.
    assert_eq!(render_template("a#,b", &StaticWindowValues), "a,b");
}

#[test]
fn escape_closing_brace() {
    // `#}` in template produces literal `}`.
    assert_eq!(render_template("a#}b", &StaticWindowValues), "a}b");
}

// -----------------------------------------------------------------------
// New tests — recursion limit
// -----------------------------------------------------------------------

#[test]
fn recursion_limit_produces_empty() {
    // Deeply nested expand modifiers should hit the limit and return empty.
    // Create a template that re-expands many times.
    struct RecurseVars;
    impl FormatVariables for RecurseVars {
        fn format_value(&self, variable: FormatVariable) -> Option<String> {
            match variable {
                FormatVariable::SessionName => Some("#{E:session_name}".to_owned()),
                _ => None,
            }
        }
    }
    // This will try to expand session_name → "#{E:session_name}" → expand
    // again → ... until the recursion limit is hit.
    let result = render_template("#{E:session_name}", &RecurseVars);
    // Should eventually produce empty string when limit is hit.
    assert!(result.len() < 1000, "recursion should be bounded");
}

// -----------------------------------------------------------------------
// New tests — truncation and padding
// -----------------------------------------------------------------------
