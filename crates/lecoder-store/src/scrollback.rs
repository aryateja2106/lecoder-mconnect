//! Append-only, absolutely-numbered scrollback with a bounded in-memory window.
//!
//! This is the spine of the reconnect/daemon-restart guarantee: line numbers are
//! **absolute** (they never reset, even after old lines are dropped from the window),
//! so a client that reconnects can ask for `from_line` and get a stable view.

use std::collections::{BTreeMap, VecDeque};
use std::path::Path;

use serde::{Deserialize, Serialize};

/// One persisted scrollback line with its absolute line number.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct StoredLine {
    line: u64,
    data: String,
}

/// A bounded ring of terminal lines with absolute numbering and a partial-line buffer.
#[derive(Debug, Clone)]
pub struct ScrollbackLog {
    cap: usize,
    lines: VecDeque<String>,
    /// Absolute line number of `lines.front()` (when non-empty).
    first_retained: u64,
    /// Count of all lines ever produced (absolute), including dropped ones.
    total: u64,
    /// Bytes received since the last newline, not yet a complete line.
    pending: String,
}

/// Result of a scrollback slice request.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScrollbackSlice {
    /// Absolute line number of the first returned line (may be clamped up from the request).
    pub from_line: u64,
    /// The returned lines.
    pub lines: Vec<String>,
    /// True if the requested `from_line` pointed below the retained window and was clamped.
    pub truncated: bool,
}

impl ScrollbackLog {
    /// Create a log retaining at most `cap` lines in memory. `cap` of 0 is treated as 1.
    pub fn new(cap: usize) -> Self {
        Self {
            cap: cap.max(1),
            lines: VecDeque::new(),
            first_retained: 0,
            total: 0,
            pending: String::new(),
        }
    }

    /// Total lines ever produced (absolute), excluding any buffered partial line.
    pub fn total_lines(&self) -> u64 {
        self.total
    }

    /// Absolute line number of the earliest line still retained in memory.
    pub fn first_retained_line(&self) -> u64 {
        self.first_retained
    }

    /// Number of lines currently retained in memory.
    pub fn retained_len(&self) -> usize {
        self.lines.len()
    }

    /// Append a completed line (no embedded newline handling).
    pub fn push_line(&mut self, line: impl Into<String>) {
        self.lines.push_back(line.into());
        self.total += 1;
        while self.lines.len() > self.cap {
            self.lines.pop_front();
            self.first_retained += 1;
        }
    }

    /// Append raw output text, splitting on `\n`. Incomplete trailing text is buffered
    /// until a newline arrives. A single trailing `\r` per line is stripped (CRLF -> line).
    pub fn append_str(&mut self, text: &str) {
        self.pending.push_str(text);
        while let Some(nl) = self.pending.find('\n') {
            let mut line: String = self.pending.drain(..=nl).collect();
            line.pop(); // remove '\n'
            if line.ends_with('\r') {
                line.pop();
            }
            self.push_line(line);
        }
    }

    /// Flush any buffered partial line as a final line. Returns its absolute number.
    pub fn flush_pending(&mut self) -> Option<u64> {
        if self.pending.is_empty() {
            return None;
        }
        let mut line = std::mem::take(&mut self.pending);
        if line.ends_with('\r') {
            line.pop();
        }
        let n = self.total;
        self.push_line(line);
        Some(n)
    }

    /// Return up to `count` lines starting at absolute `from`.
    ///
    /// - `from >= total` -> empty.
    /// - `from` below the retained window -> clamped to the earliest retained line,
    ///   with `truncated = true`.
    pub fn slice(&self, from: u64, count: u64) -> ScrollbackSlice {
        if from >= self.total || count == 0 {
            return ScrollbackSlice { from_line: from.min(self.total), lines: Vec::new(), truncated: from < self.first_retained };
        }
        let truncated = from < self.first_retained;
        let effective_from = from.max(self.first_retained);
        let start_idx = (effective_from - self.first_retained) as usize;
        let end = (effective_from + count).min(self.total);
        let take = (end - effective_from) as usize;
        let lines: Vec<String> = self
            .lines
            .iter()
            .skip(start_idx)
            .take(take)
            .cloned()
            .collect();
        ScrollbackSlice { from_line: effective_from, lines, truncated }
    }

    /// Serialize the retained window to JSONL (one `{line,data}` object per line).
    pub fn to_jsonl(&self) -> String {
        let mut out = String::new();
        for (i, data) in self.lines.iter().enumerate() {
            let stored = StoredLine { line: self.first_retained + i as u64, data: data.clone() };
            out.push_str(&serde_json::to_string(&stored).expect("serialize scrollback line"));
            out.push('\n');
        }
        out
    }

    /// Reconstruct from JSONL produced by [`to_jsonl`], preserving absolute numbering.
    ///
    /// Corrupt/garbage lines are skipped (corruption tolerance). The retained window is
    /// taken as the tail (last `cap`) of the valid lines.
    pub fn from_jsonl(cap: usize, jsonl: &str) -> Self {
        let mut log = Self::new(cap);
        let mut parsed: Vec<StoredLine> = jsonl
            .lines()
            .filter(|l| !l.trim().is_empty())
            .filter_map(|l| serde_json::from_str::<StoredLine>(l).ok())
            .collect();
        parsed.sort_by_key(|s| s.line);
        if let Some(last) = parsed.last() {
            log.total = last.line + 1;
        }
        let start = parsed.len().saturating_sub(log.cap);
        if let Some(first) = parsed.get(start) {
            log.first_retained = first.line;
        }
        for s in parsed.into_iter().skip(start) {
            log.lines.push_back(s.data);
        }
        log
    }

    /// Persist retained lines to `path` without dropping older lines already on disk.
    ///
    /// The live pump is expected to save repeatedly as output arrives. On each save, this
    /// merges the current retained window into the existing durable JSONL, so bounded memory
    /// does not erase previously persisted catch-up history.
    pub fn save(&self, path: &Path) -> std::io::Result<()> {
        let mut by_line = BTreeMap::new();
        if let Ok(existing) = std::fs::read_to_string(path) {
            for stored in existing
                .lines()
                .filter(|l| !l.trim().is_empty())
                .filter_map(|l| serde_json::from_str::<StoredLine>(l).ok())
            {
                by_line.insert(stored.line, stored.data);
            }
        }
        for (i, data) in self.lines.iter().enumerate() {
            by_line.insert(self.first_retained + i as u64, data.clone());
        }

        let mut out = String::new();
        for (line, data) in by_line {
            out.push_str(&serde_json::to_string(&StoredLine { line, data }).expect("serialize scrollback line"));
            out.push('\n');
        }
        crate::atomic_write(path, out.as_bytes())
    }

    /// Load from `path`, or an empty log if the file does not exist.
    pub fn load(cap: usize, path: &Path) -> std::io::Result<Self> {
        match std::fs::read_to_string(path) {
            Ok(s) => Ok(Self::from_jsonl(cap, &s)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Self::new(cap)),
            Err(e) => Err(e),
        }
    }
}
