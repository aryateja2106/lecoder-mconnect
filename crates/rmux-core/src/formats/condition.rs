use super::{
    format_expand1, format_skip, is_truthy, resolve_variable, ExpandState, FormatVariables,
};

/// Evaluates a tmux multi-pair conditional: `cond1,val1,cond2,val2,...,default`.
pub(super) fn format_conditional<V>(state: &mut ExpandState, body: &str, variables: &V) -> String
where
    V: FormatVariables + ?Sized,
{
    let bytes = body.as_bytes();
    let mut pos = 0;

    loop {
        // Find the condition (up to next `,`).
        let rest = &bytes[pos..];
        let cond_end = match format_skip(rest, b",") {
            Some(off) => off,
            None => {
                // No more commas — this is the final unpaired arg (default).
                return format_expand1(state, &body[pos..], variables);
            }
        };

        let condition_str = &body[pos..pos + cond_end];

        // Evaluate condition: try variable lookup first, then expand.
        let found = resolve_variable(condition_str, variables);
        let condition_value = if found.is_empty() {
            // Try expanding. If expansion has no effect, assume false.
            let expanded = format_expand1(state, condition_str, variables);
            if expanded == condition_str {
                String::new()
            } else {
                expanded
            }
        } else {
            found
        };

        // Advance past condition comma.
        pos += cond_end + 1;

        // Find the value (up to next `,`).
        let rest = &bytes[pos..];
        let val_end = format_skip(rest, b",");

        if is_truthy(&condition_value) {
            // Condition is true — expand and return the value.
            return if let Some(ve) = val_end {
                let value_str = &body[pos..pos + ve];
                format_expand1(state, value_str, variables)
            } else {
                format_expand1(state, &body[pos..], variables)
            };
        }

        // Condition is false — skip the value.
        match val_end {
            Some(ve) => pos += ve + 1,
            None => {
                // No more commas — no default, return empty.
                return String::new();
            }
        }
    }
}

/// N-ary boolean operator: `&&` (and=true) or `||` (and=false).
/// Splits body on `,`, short-circuits.
pub(super) fn format_bool_op_n<V>(
    state: &mut ExpandState,
    body: &str,
    and: bool,
    variables: &V,
) -> String
where
    V: FormatVariables + ?Sized,
{
    let bytes = body.as_bytes();
    let mut result = and;
    let mut pos = 0;

    loop {
        // Should we keep going?
        if and && !result {
            break;
        }
        if !and && result {
            break;
        }

        let rest = &bytes[pos..];
        let end = format_skip(rest, b",");

        let raw = match end {
            Some(off) => &body[pos..pos + off],
            None => &body[pos..],
        };

        let expanded = format_expand1(state, raw, variables);
        if and {
            result = result && is_truthy(&expanded);
        } else {
            result = result || is_truthy(&expanded);
        }

        match end {
            Some(off) => pos += off + 1,
            None => break,
        }
    }

    if result { "1" } else { "0" }.to_owned()
}
