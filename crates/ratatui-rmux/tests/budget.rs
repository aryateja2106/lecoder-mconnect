//! Enforces the `ratatui-rmux` production source and dependency budget.

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

const EXPECTED_FILES: &[&str] = &["lib.rs", "driver.rs", "state.rs", "widget.rs", "theme.rs"];
const MAX_FILES: usize = 5;
const MAX_SOURCE_LINES: usize = 1500;
const MAX_DIRECT_DEPS: usize = 2;
const REQUIRED_DEPS: &[&str] = &["rmux-sdk"];
const FORBIDDEN_DEPS: &[&str] = &["rmux-client", "rmux-core", "rmux-server", "rmux-pty"];

fn crate_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

#[test]
fn production_source_set_matches_rfc() {
    let src = crate_root().join("src");
    let mut files: BTreeSet<String> = BTreeSet::new();
    for entry in fs::read_dir(&src).expect("read src dir") {
        let entry = entry.expect("dir entry");
        let file_type = entry.file_type().expect("file type");
        if file_type.is_dir() {
            panic!(
                "ratatui-rmux/src must remain flat: found subdirectory {}",
                entry.file_name().to_string_lossy()
            );
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.ends_with(".rs") {
            files.insert(name);
        }
    }

    let expected: BTreeSet<String> = EXPECTED_FILES.iter().map(|s| (*s).to_owned()).collect();
    assert_eq!(
        files, expected,
        "production source set must match the recorded budget"
    );
    assert!(files.len() <= MAX_FILES, "file count exceeds budget");
}

#[test]
fn production_source_lines_within_budget() {
    let src = crate_root().join("src");
    let mut total = 0usize;
    for file in EXPECTED_FILES {
        let contents =
            fs::read_to_string(src.join(file)).unwrap_or_else(|e| panic!("read {file}: {e}"));
        total += contents
            .lines()
            .filter(|line| !line.trim().is_empty())
            .count();
    }
    assert!(
        total <= MAX_SOURCE_LINES,
        "production source lines {total} exceed budget {MAX_SOURCE_LINES}"
    );
}

#[test]
fn lib_rs_keeps_forbid_unsafe_code() {
    let contents = fs::read_to_string(crate_root().join("src/lib.rs")).expect("read lib.rs");
    assert!(
        contents.contains("#![forbid(unsafe_code)]"),
        "lib.rs must keep #![forbid(unsafe_code)]"
    );
}

#[test]
fn manifest_direct_dependencies_within_budget() {
    let manifest = fs::read_to_string(crate_root().join("Cargo.toml")).expect("read Cargo.toml");
    let deps = parse_dependencies(&manifest);

    assert!(
        deps.len() <= MAX_DIRECT_DEPS,
        "direct dependency count {} exceeds budget {MAX_DIRECT_DEPS}: {:?}",
        deps.len(),
        deps
    );

    for required in REQUIRED_DEPS {
        assert!(
            deps.iter().any(|d| d == required),
            "missing required direct dependency `{required}`"
        );
    }

    for forbidden in FORBIDDEN_DEPS {
        assert!(
            !deps.iter().any(|d| d == forbidden),
            "forbidden direct dependency `{forbidden}` present"
        );
    }

    let ratatui = deps.iter().filter(|d| d.starts_with("ratatui")).count();
    assert_eq!(
        ratatui, 1,
        "expected exactly one ratatui* direct dependency, found {ratatui}: {deps:?}"
    );
}

#[test]
fn manifest_has_no_target_specific_dependencies() {
    let manifest = fs::read_to_string(crate_root().join("Cargo.toml")).expect("read Cargo.toml");
    for line in manifest.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("[target.") && trimmed.contains(".dependencies]") {
            panic!("ratatui-rmux must not declare per-target [dependencies]: `{line}`");
        }
    }
}

#[test]
fn enforcement_script_exists() {
    let script = repo_root().join("scripts/ratatui-rmux-budget.sh");
    assert!(
        script.exists(),
        "expected enforcement script at {}",
        script.display()
    );
}

#[test]
fn render_purity_test_file_exists() {
    let tests = crate_root().join("tests");
    for required in ["render.rs", "state.rs"] {
        assert!(
            tests.join(required).exists(),
            "missing recorded test surface tests/{required}",
        );
    }
}

#[test]
fn sync_modules_do_not_use_io_or_runtime_primitives() {
    let src = crate_root().join("src");
    let sync_modules = ["widget.rs", "state.rs", "theme.rs"];
    let banned: &[(&str, &str)] = &[
        ("async fn", "async fn declared outside driver.rs"),
        (".await", ".await reached outside driver.rs"),
        ("tokio::", "tokio path imported outside driver.rs"),
        ("use tokio", "tokio crate imported outside driver.rs"),
        ("Instant::now", "ambient clock read outside driver.rs"),
        ("SystemTime::now", "ambient clock read outside driver.rs"),
        ("std::time", "std::time imported outside driver.rs"),
        ("std::thread", "std::thread imported outside driver.rs"),
        ("std::net", "std::net imported outside driver.rs"),
        ("UnixStream", "socket primitive imported outside driver.rs"),
        ("TcpStream", "socket primitive imported outside driver.rs"),
        ("spawn(", "task spawn outside driver.rs"),
        ("subscribe(", "subscription opened outside driver.rs"),
    ];
    for module in sync_modules {
        let path = src.join(module);
        let contents = fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {module}: {e}"));
        for line in contents.lines() {
            let trimmed = line.trim_start();
            if trimmed.starts_with("//") || trimmed.starts_with("//!") {
                continue;
            }
            for (needle, message) in banned {
                assert!(
                    !line.contains(needle),
                    "{module}: {message} (line: `{}`)",
                    line.trim(),
                );
            }
        }
    }
}

#[test]
fn driver_is_the_only_module_with_async_surface() {
    let driver = fs::read_to_string(crate_root().join("src/driver.rs")).expect("read driver.rs");
    assert!(
        driver.contains("pub async fn refresh"),
        "driver.rs must expose `pub async fn refresh` as the sole async entry point",
    );
}

fn repo_root() -> PathBuf {
    crate_root()
        .ancestors()
        .nth(2)
        .map(Path::to_path_buf)
        .expect("repository root from CARGO_MANIFEST_DIR")
}

fn parse_dependencies(manifest: &str) -> Vec<String> {
    let mut in_block = false;
    let mut deps = Vec::new();
    for line in manifest.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') {
            in_block = trimmed == "[dependencies]";
            continue;
        }
        if !in_block {
            continue;
        }
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Some(eq_idx) = trimmed.find('=') {
            let name = trimmed[..eq_idx].trim();
            if !name.is_empty() {
                deps.push(name.to_owned());
            }
        }
    }
    deps.sort();
    deps.dedup();
    deps
}
