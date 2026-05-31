//! Parameter splitting and access matching tmux `input_split` / `input_get`.

use super::PARAM_LIST_MAX;

/// Parameter type discriminant.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ParamType {
    /// No value present (empty between semicolons).
    Missing,
    /// Numeric value.
    Number(i32),
    /// Colon-containing string (for ISO SGR forms like `38:2:r:g:b`).
    Str(String),
}

/// A single parsed parameter.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InputParam {
    /// The parameter type and value.
    pub ptype: ParamType,
}

impl InputParam {
    fn missing() -> Self {
        Self {
            ptype: ParamType::Missing,
        }
    }
}

/// Parsed parameter list.
pub(crate) struct ParamList {
    params: [Option<InputParam>; PARAM_LIST_MAX],
    len: u32,
}

impl ParamList {
    pub(crate) fn new() -> Self {
        Self {
            params: std::array::from_fn(|_| None),
            len: 0,
        }
    }

    pub(crate) fn len(&self) -> u32 {
        self.len
    }

    pub(crate) fn clear(&mut self) {
        for p in &mut self.params {
            *p = None;
        }
        self.len = 0;
    }

    /// Split a raw parameter buffer (semicolon-delimited) into the param list.
    /// Returns `true` on success, `false` on parse error.
    pub(crate) fn split(&mut self, buf: &[u8], len: usize) -> bool {
        self.clear();

        if len == 0 {
            return true;
        }

        let s = match std::str::from_utf8(&buf[..len]) {
            Ok(s) => s,
            Err(_) => return false,
        };

        for part in s.split(';') {
            if self.len as usize >= PARAM_LIST_MAX {
                return false;
            }
            let param = if part.is_empty() {
                InputParam::missing()
            } else if part.contains(':') {
                InputParam {
                    ptype: ParamType::Str(part.to_owned()),
                }
            } else {
                match part.parse::<i32>() {
                    Ok(n) if n >= 0 => InputParam {
                        ptype: ParamType::Number(n),
                    },
                    _ => return false,
                }
            };
            self.params[self.len as usize] = Some(param);
            self.len += 1;
        }

        true
    }

    /// Get parameter at `index` with clamping semantics matching tmux `input_get`.
    ///
    /// - If `index` is out of range: returns `defval`.
    /// - If parameter is Missing: returns `defval`.
    /// - If parameter is Str: returns `-1`.
    /// - If parameter is Number: returns `max(value, minval)`.
    pub(crate) fn get(&self, index: u32, minval: i32, defval: i32) -> i32 {
        if index >= self.len {
            return defval;
        }
        match &self.params[index as usize] {
            None => defval,
            Some(p) => match &p.ptype {
                ParamType::Missing => defval,
                ParamType::Str(_) => -1,
                ParamType::Number(n) => {
                    if *n < minval {
                        minval
                    } else {
                        *n
                    }
                }
            },
        }
    }

    /// Returns the param type at the given index, if any.
    pub(crate) fn param_at(&self, index: u32) -> Option<&InputParam> {
        if index >= self.len {
            return None;
        }
        self.params[index as usize].as_ref()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_empty() {
        let mut pl = ParamList::new();
        assert!(pl.split(b"", 0));
        assert_eq!(pl.len(), 0);
        assert_eq!(pl.get(0, 0, 42), 42);
    }

    #[test]
    fn split_single_number() {
        let mut pl = ParamList::new();
        assert!(pl.split(b"5", 1));
        assert_eq!(pl.len(), 1);
        assert_eq!(pl.get(0, 0, 0), 5);
    }

    #[test]
    fn split_multiple_with_missing() {
        let mut pl = ParamList::new();
        let buf = b";3;;7";
        assert!(pl.split(buf, buf.len()));
        assert_eq!(pl.len(), 4);
        assert_eq!(pl.get(0, 0, 99), 99); // missing
        assert_eq!(pl.get(1, 0, 0), 3);
        assert_eq!(pl.get(2, 0, 99), 99); // missing
        assert_eq!(pl.get(3, 0, 0), 7);
    }

    #[test]
    fn split_colon_string() {
        let mut pl = ParamList::new();
        let buf = b"38:2:255:0:128";
        assert!(pl.split(buf, buf.len()));
        assert_eq!(pl.len(), 1);
        assert_eq!(pl.get(0, 0, 0), -1); // string returns -1
    }

    #[test]
    fn get_clamps_to_minval() {
        let mut pl = ParamList::new();
        assert!(pl.split(b"0", 1));
        assert_eq!(pl.get(0, 1, 1), 1);
    }

    #[test]
    fn get_out_of_range_returns_defval() {
        let mut pl = ParamList::new();
        assert!(pl.split(b"5", 1));
        assert_eq!(pl.get(5, 0, 42), 42);
    }
}
