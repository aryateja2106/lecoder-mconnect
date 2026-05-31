#![allow(dead_code, clippy::extra_unused_type_parameters)]

use std::fmt::Debug;
use std::hash::Hash;

use serde::de::DeserializeOwned;
use serde::Serialize;

use rmux_sdk::{
    PaneAttributes, PaneCell, PaneColor, PaneCursor, PaneGlyph, PaneSnapshot,
    PaneSnapshotShapeError,
};

fn assert_send<T: Send>() {}
fn assert_sync<T: Sync>() {}
fn assert_static<T: 'static>() {}
fn assert_clone<T: Clone>() {}
fn assert_eq_hash<T: Eq + Hash>() {}
fn assert_debug<T: Debug>() {}

fn _assert_bounds() {
    assert_send::<PaneSnapshot>();
    assert_sync::<PaneSnapshot>();
    assert_static::<PaneSnapshot>();
    assert_clone::<PaneSnapshot>();
    assert_eq_hash::<PaneSnapshot>();
    assert_debug::<PaneSnapshot>();

    assert_send::<PaneCell>();
    assert_sync::<PaneCell>();
    assert_static::<PaneCell>();
    assert_clone::<PaneCell>();
    assert_eq_hash::<PaneCell>();
    assert_debug::<PaneCell>();

    assert_send::<PaneGlyph>();
    assert_sync::<PaneGlyph>();
    assert_static::<PaneGlyph>();
    assert_clone::<PaneGlyph>();
    assert_eq_hash::<PaneGlyph>();
    assert_debug::<PaneGlyph>();

    assert_send::<PaneColor>();
    assert_sync::<PaneColor>();
    assert_static::<PaneColor>();
    assert_clone::<PaneColor>();
    assert_eq_hash::<PaneColor>();
    assert_debug::<PaneColor>();

    assert_send::<PaneAttributes>();
    assert_sync::<PaneAttributes>();
    assert_static::<PaneAttributes>();
    assert_clone::<PaneAttributes>();
    assert_eq_hash::<PaneAttributes>();
    assert_debug::<PaneAttributes>();

    assert_send::<PaneCursor>();
    assert_sync::<PaneCursor>();
    assert_static::<PaneCursor>();
    assert_clone::<PaneCursor>();
    assert_eq_hash::<PaneCursor>();
    assert_debug::<PaneCursor>();
}

fn round_trip<T>(value: T) -> T
where
    T: Serialize + DeserializeOwned + PartialEq + Debug,
{
    let json = serde_json::to_string(&value).expect("value serializes as JSON");
    let decoded_json = serde_json::from_str::<T>(&json).expect("value deserializes from JSON");
    assert_eq!(decoded_json, value);

    let bytes = bincode::serialize(&value).expect("value serializes as bincode");
    let decoded = bincode::deserialize::<T>(&bytes).expect("value deserializes from bincode");
    assert_eq!(decoded, value);
    decoded
}

fn cell(text: &str) -> PaneCell {
    PaneCell::new(PaneGlyph::new(text, 1))
}

fn styled_cell(
    text: &str,
    width: u8,
    attributes: PaneAttributes,
    foreground: PaneColor,
    background: PaneColor,
    underline: PaneColor,
) -> PaneCell {
    PaneCell {
        glyph: PaneGlyph::new(text, width),
        attributes,
        foreground,
        background,
        underline,
    }
}

#[test]
fn row_major_shape_is_checked_and_indexed_by_dimensions() {
    let cursor = PaneCursor::new(1, 0, true, 6);
    let snapshot = PaneSnapshot::new(
        2,
        2,
        vec![cell("a"), cell("b"), cell("c"), cell("d")],
        cursor,
    )
    .expect("2x2 snapshot has four cells");

    assert_eq!(snapshot.expected_cell_count(), 4);
    assert!(snapshot.is_row_major_shape());
    assert_eq!(snapshot.cursor, cursor);
    assert_eq!(snapshot.cell(0, 0).expect("cell 0,0").text(), "a");
    assert_eq!(snapshot.cell(0, 1).expect("cell 0,1").text(), "b");
    assert_eq!(snapshot.cell(1, 0).expect("cell 1,0").text(), "c");
    assert_eq!(snapshot.cell(1, 1).expect("cell 1,1").text(), "d");
    assert!(snapshot.cell(2, 0).is_none());
    assert!(snapshot.cell(0, 2).is_none());
    assert_eq!(
        snapshot
            .row_cells(1)
            .expect("second row")
            .iter()
            .map(PaneCell::text)
            .collect::<Vec<_>>(),
        vec!["c", "d"]
    );

    let err = PaneSnapshot::new(3, 2, vec![cell("x"); 5], cursor)
        .expect_err("3x2 snapshot needs six cells");
    assert_eq!(err.cols(), 3);
    assert_eq!(err.rows(), 2);
    assert_eq!(err.actual_cells(), 5);
    assert_eq!(err.expected_cells(), 6);
    assert_eq!(
        err.to_string(),
        "pane snapshot shape mismatch: 3x2 expects 6 cells, got 5"
    );
    let as_error: &(dyn std::error::Error + 'static) = &err;
    assert!(as_error.source().is_none());

    assert_send::<PaneSnapshotShapeError>();
    assert_sync::<PaneSnapshotShapeError>();

    let err = PaneSnapshot::new(1, 1, vec![cell("x"), cell("y")], cursor)
        .expect_err("1x1 snapshot rejects extra row-major cells");
    assert_eq!(err.actual_cells(), 2);
    assert_eq!(err.expected_cells(), 1);
}

#[test]
fn serde_round_trips_preserve_glyphs_colors_attributes_cursor_and_padding() {
    let attributes = PaneAttributes::BOLD
        | PaneAttributes::ITALIC
        | PaneAttributes::UNDERLINE
        | PaneAttributes::from_bits(0x8000);
    let snapshot = PaneSnapshot::new(
        3,
        2,
        vec![
            styled_cell(
                "A",
                1,
                attributes,
                PaneColor::ansi(2),
                PaneColor::indexed(196),
                PaneColor::rgb(10, 20, 30),
            ),
            styled_cell(
                "表",
                2,
                PaneAttributes::REVERSE,
                PaneColor::from_encoded(PaneColor::RGB_FLAG | (200 << 16) | (100 << 8) | 50),
                PaneColor::Terminal,
                PaneColor::None,
            ),
            PaneCell::padding(),
            styled_cell(
                "",
                1,
                PaneAttributes::EMPTY,
                PaneColor::Default,
                PaneColor::bright_ansi(3),
                PaneColor::Encoded { value: 0x0300_0001 },
            ),
            cell(" "),
            styled_cell(
                "\u{7f}",
                1,
                PaneAttributes::NO_ATTRIBUTES,
                PaneColor::from_encoded(-12345),
                PaneColor::from_encoded(PaneColor::INDEXED_FLAG | 33),
                PaneColor::from_encoded(7),
            ),
        ],
        PaneCursor::new(1, 2, false, 3),
    )
    .expect("valid 3x2 snapshot");

    let decoded = round_trip(snapshot.clone());
    assert_eq!(decoded, snapshot);
    assert_eq!(decoded.cursor.row, 1);
    assert_eq!(decoded.cursor.col, 2);
    assert!(!decoded.cursor.visible);
    assert_eq!(decoded.cursor.style, 3);
    assert_eq!(decoded.cells[1].glyph.text, "表");
    assert_eq!(decoded.cells[1].glyph.width, 2);
    assert!(decoded.cells[2].is_padding());
    assert_eq!(decoded.cells[2].glyph.width, 0);
    assert_eq!(decoded.cells[0].attributes.bits(), attributes.bits());
    assert!(decoded.cells[0].attributes.contains(PaneAttributes::BOLD));
    assert!(decoded.cells[0].attributes.contains(PaneAttributes::ITALIC));
    assert_eq!(decoded.cells[0].foreground.encoded(), 2);
    assert_eq!(
        decoded.cells[0].background.encoded(),
        PaneColor::INDEXED_FLAG | 196
    );
    assert_eq!(
        decoded.cells[0].underline.encoded(),
        PaneColor::RGB_FLAG | (10 << 16) | (20 << 8) | 30
    );
    assert_eq!(
        decoded.cells[3].background.encoded(),
        PaneColor::bright_ansi(3).encoded()
    );
    assert_eq!(decoded.cells[5].foreground.encoded(), -12345);

    let invalid = PaneSnapshot {
        cols: 2,
        rows: 2,
        cells: vec![cell("x")],
        cursor: PaneCursor::default(),
        revision: 0,
    };
    let json_err =
        serde_json::to_value(&invalid).expect_err("JSON serialization checks row-major shape");
    assert!(json_err
        .to_string()
        .contains("pane snapshot shape mismatch: 2x2 expects 4 cells, got 1"));

    let bincode_err =
        bincode::serialize(&invalid).expect_err("bincode serialization checks row-major shape");
    assert!(bincode_err
        .to_string()
        .contains("pane snapshot shape mismatch: 2x2 expects 4 cells, got 1"));
}

#[test]
fn visible_text_helpers_match_lossy_grid_rendering_edges() {
    let snapshot = PaneSnapshot::new(
        5,
        2,
        vec![
            cell("A"),
            styled_cell(
                "界",
                2,
                PaneAttributes::EMPTY,
                PaneColor::Default,
                PaneColor::Default,
                PaneColor::Default,
            ),
            PaneCell::padding(),
            cell(" "),
            cell(" "),
            cell(" "),
            styled_cell(
                "",
                1,
                PaneAttributes::EMPTY,
                PaneColor::Default,
                PaneColor::Default,
                PaneColor::Default,
            ),
            cell("\u{0007}"),
            cell("Z"),
            cell(" "),
        ],
        PaneCursor::default(),
    )
    .expect("valid snapshot");

    assert_eq!(snapshot.visible_row_text(0).as_deref(), Some("A界"));
    assert_eq!(snapshot.visible_row_text(1).as_deref(), Some(" \u{0007}Z"));
    assert_eq!(snapshot.owning_cell_col(0, 0), Some(0));
    assert_eq!(snapshot.owning_cell_col(0, 1), Some(1));
    assert_eq!(snapshot.owning_cell_col(0, 2), Some(1));
    assert_eq!(snapshot.owning_cell_col(0, 3), Some(3));
    assert_eq!(snapshot.owning_cell_col(2, 0), None);
    assert_eq!(snapshot.owning_cell_col(0, 5), None);
    assert_eq!(
        snapshot.visible_lines(),
        vec!["A界".to_owned(), " \u{0007}Z".to_owned()]
    );
    assert_eq!(snapshot.visible_text(), "A界\n \u{0007}Z");
    assert_eq!(
        snapshot
            .visible_cells()
            .map(|(row, col, cell)| (row, col, cell.text().to_owned()))
            .collect::<Vec<_>>(),
        vec![
            (0, 0, "A".to_owned()),
            (0, 1, "界".to_owned()),
            (0, 3, " ".to_owned()),
            (0, 4, " ".to_owned()),
            (1, 0, " ".to_owned()),
            (1, 1, "".to_owned()),
            (1, 2, "\u{0007}".to_owned()),
            (1, 3, "Z".to_owned()),
            (1, 4, " ".to_owned()),
        ]
    );
}

#[test]
fn malformed_or_zero_width_snapshots_do_not_panic_in_helpers() {
    let malformed = PaneSnapshot {
        cols: 3,
        rows: 2,
        cells: vec![cell("x"), PaneCell::padding()],
        cursor: PaneCursor::default(),
        revision: 0,
    };

    assert!(!malformed.is_row_major_shape());
    assert!(malformed.row_cells(1).is_none());
    assert_eq!(malformed.row_text(9), "");
    assert_eq!(
        malformed.visible_lines(),
        vec!["x".to_owned(), String::new()]
    );
    assert_eq!(malformed.visible_text(), "x\n");
    assert_eq!(
        malformed
            .visible_cells()
            .map(|(row, col, cell)| (row, col, cell.text().to_owned()))
            .collect::<Vec<_>>(),
        vec![(0, 0, "x".to_owned())]
    );

    let zero_cols = PaneSnapshot {
        cols: 0,
        rows: 2,
        cells: Vec::new(),
        cursor: PaneCursor::new(0, 0, true, 0),
        revision: 0,
    };
    assert!(zero_cols.is_row_major_shape());
    assert_eq!(zero_cols.row_cells(0), Some(&[][..]));
    assert_eq!(
        zero_cols.visible_lines(),
        vec![String::new(), String::new()]
    );
    assert_eq!(zero_cols.visible_text(), "\n");
    assert_eq!(zero_cols.visible_cells().count(), 0);
}

#[test]
fn wide_cell_owner_helper_rejects_dangling_padding() {
    let valid_wide = PaneSnapshot::new(
        4,
        1,
        vec![
            styled_cell(
                "🧪",
                3,
                PaneAttributes::EMPTY,
                PaneColor::Default,
                PaneColor::Default,
                PaneColor::Default,
            ),
            PaneCell::padding(),
            PaneCell::padding(),
            cell("x"),
        ],
        PaneCursor::default(),
    )
    .expect("valid row-major snapshot");

    assert_eq!(valid_wide.visible_row_text(0).as_deref(), Some("🧪x"));
    assert_eq!(valid_wide.owning_cell_col(0, 0), Some(0));
    assert_eq!(valid_wide.owning_cell_col(0, 1), Some(0));
    assert_eq!(valid_wide.owning_cell_col(0, 2), Some(0));
    assert_eq!(valid_wide.owning_cell_col(0, 3), Some(3));

    let dangling = PaneSnapshot::new(
        3,
        1,
        vec![PaneCell::padding(), cell("x"), PaneCell::padding()],
        PaneCursor::default(),
    )
    .expect("valid row-major snapshot with inconsistent padding markers");

    assert_eq!(dangling.visible_row_text(0).as_deref(), Some("x"));
    assert_eq!(dangling.owning_cell_col(0, 0), None);
    assert_eq!(dangling.owning_cell_col(0, 1), Some(1));
    assert_eq!(dangling.owning_cell_col(0, 2), None);
}

#[test]
fn revision_round_trips_through_serde_and_with_revision_builder() {
    let snapshot = PaneSnapshot::new(
        2,
        1,
        vec![cell("R"), cell("V")],
        PaneCursor::new(0, 1, true, 0),
    )
    .expect("valid 2x1 snapshot")
    .with_revision(0xDEAD_BEEF_CAFE_F00D);

    assert_eq!(snapshot.revision, 0xDEAD_BEEF_CAFE_F00D);

    let decoded = round_trip(snapshot.clone());
    assert_eq!(decoded.revision, snapshot.revision);

    let sparse = serde_json::from_value::<PaneSnapshot>(serde_json::json!({}))
        .expect("sparse snapshot defaults including revision");
    assert_eq!(sparse.revision, 0);
}

#[test]
fn fresh_snapshot_recovery_is_state_only_not_output_replay() {
    let before = PaneSnapshot::new(2, 1, vec![cell("o"), cell("l")], PaneCursor::default())
        .expect("valid before snapshot")
        .with_revision(10);
    let after = PaneSnapshot::new(
        2,
        1,
        vec![cell("n"), cell("w")],
        PaneCursor::new(0, 1, true, 1),
    )
    .expect("valid after snapshot")
    .with_revision(27);

    assert!(after.revision > before.revision);
    assert_eq!(after.visible_text(), "nw");
    assert_eq!(after.cursor.col, 1);

    let decoded = round_trip(after.clone());
    assert_eq!(decoded, after);

    let json = serde_json::to_value(&after).expect("snapshot serializes as JSON");
    let object = json.as_object().expect("snapshot is a JSON object");
    assert!(object.contains_key("cells"));
    assert!(object.contains_key("cursor"));
    assert!(object.contains_key("revision"));
    for forbidden in [
        "output_sequence",
        "recent",
        "missed_events",
        "resume_sequence",
        "raw_output",
        "bytes",
        "replayed",
    ] {
        assert!(
            !object.contains_key(forbidden),
            "fresh snapshot must not claim replay of dropped output through `{forbidden}`",
        );
    }
}

#[test]
fn visible_text_helpers_preserve_cell_payloads_verbatim() {
    // The daemon's structured snapshot endpoint hands the SDK already-valid
    // UTF-8 cell text — the rmux-core terminal parser is what folds raw PTY
    // bytes into glyphs, surfacing `\u{FFFD}` for any invalid UTF-8 it sees.
    // The SDK helpers must therefore propagate every code point in
    // `cell.text` without applying any *additional* lossy transformations
    // (other than the documented padding-skip and trailing-space trim).
    let snapshot = PaneSnapshot::new(
        4,
        2,
        vec![
            cell("\u{FFFD}"),
            cell("\u{200B}"),
            cell("\u{1F389}"),
            cell(" "),
            styled_cell(
                "界",
                2,
                PaneAttributes::EMPTY,
                PaneColor::Default,
                PaneColor::Default,
                PaneColor::Default,
            ),
            PaneCell::padding(),
            cell("\u{0008}"),
            cell(" "),
        ],
        PaneCursor::default(),
    )
    .expect("valid 4x2 snapshot");

    assert_eq!(
        snapshot.visible_row_text(0).as_deref(),
        Some("\u{FFFD}\u{200B}\u{1F389}")
    );
    assert_eq!(snapshot.visible_row_text(1).as_deref(), Some("界\u{0008}"));
    assert_eq!(
        snapshot.visible_text(),
        "\u{FFFD}\u{200B}\u{1F389}\n界\u{0008}"
    );
    assert_eq!(snapshot.cell(0, 0).expect("cell 0,0").text(), "\u{FFFD}");
    assert_eq!(snapshot.cell(1, 0).expect("cell 1,0").text(), "界");
    assert!(snapshot.cell(1, 1).expect("padding cell").is_padding());
    // Padding never reaches the rendered text but the owner column is the
    // wide glyph's leading column.
    assert_eq!(snapshot.owning_cell_col(1, 1), Some(0));
}

#[test]
fn wide_glyph_spanning_row_boundary_preserves_owner_for_in_bounds_cells() {
    // The daemon never emits a padding cell whose owner sits past the visible
    // grid — wide glyphs on the right edge of the viewport are clipped at the
    // owner column. We still assert the SDK helpers stay sane when only the
    // leading column is present, since a misbehaving producer could omit the
    // trailing padding column.
    let snapshot = PaneSnapshot::new(
        2,
        1,
        vec![
            cell("a"),
            styled_cell(
                "界",
                2,
                PaneAttributes::EMPTY,
                PaneColor::Default,
                PaneColor::Default,
                PaneColor::Default,
            ),
        ],
        PaneCursor::default(),
    )
    .expect("valid 2x1 snapshot");

    assert_eq!(snapshot.owning_cell_col(0, 0), Some(0));
    assert_eq!(snapshot.owning_cell_col(0, 1), Some(1));
    // Out-of-bounds queries return None rather than panicking, even when the
    // wide glyph would otherwise project a padding column past the grid.
    assert!(snapshot.cell(0, 2).is_none());
    assert_eq!(snapshot.owning_cell_col(0, 2), None);
    assert_eq!(snapshot.visible_row_text(0).as_deref(), Some("a界"));
}

#[test]
fn visible_text_helpers_never_leak_padding_sentinel_text() {
    // Padding cells carry the rmux-core sentinel space character verbatim. The
    // helpers must drop the sentinel rather than splice it into the rendered
    // visible text, even when there are multiple padding columns following a
    // wide glyph (e.g. a 3-cell emoji).
    let snapshot = PaneSnapshot::new(
        5,
        1,
        vec![
            styled_cell(
                "🧪",
                3,
                PaneAttributes::EMPTY,
                PaneColor::Default,
                PaneColor::Default,
                PaneColor::Default,
            ),
            PaneCell::padding(),
            PaneCell::padding(),
            cell("Z"),
            cell(" "),
        ],
        PaneCursor::default(),
    )
    .expect("valid 5x1 snapshot");

    let row = snapshot.visible_row_text(0).expect("row text");
    assert_eq!(row, "🧪Z");
    // The padding cells never reach the rendered text — even though they hold
    // the sentinel space byte for raw round-tripping, the helpers check them
    // out via the explicit `is_padding()` filter.
    assert!(!row.contains("  "));
}

#[test]
fn raw_cell_text_round_trips_independently_of_visible_helpers() {
    // The visible-text helpers are a *display* path: trailing-space trim and
    // padding-skip. The raw `cell.text()` payload is the canonical wire form
    // and must round-trip every byte — this guards against helpers later
    // sneaking transformations onto the underlying cell payload.
    let snapshot = PaneSnapshot::new(
        4,
        1,
        vec![cell(" "), cell("\u{FFFD}"), cell(" "), cell(" ")],
        PaneCursor::default(),
    )
    .expect("valid 4x1 snapshot");

    // Visible helper trims trailing spaces and renders the replacement
    // character verbatim.
    assert_eq!(snapshot.visible_row_text(0).as_deref(), Some(" \u{FFFD}"));

    // Raw cell access still surfaces every original payload byte, including
    // the trailing spaces the visible helper trimmed.
    let raw_row: Vec<&str> = (0..snapshot.cols)
        .map(|col| snapshot.cell(0, col).expect("cell").text())
        .collect();
    assert_eq!(raw_row, vec![" ", "\u{FFFD}", " ", " "]);
}

#[test]
fn sparse_serde_payloads_default_missing_fields() {
    let snapshot = serde_json::from_value::<PaneSnapshot>(serde_json::json!({}))
        .expect("sparse snapshot defaults");
    assert_eq!(snapshot, PaneSnapshot::default());
    assert!(snapshot.is_row_major_shape());
    assert_eq!(snapshot.visible_text(), "");

    let err = serde_json::from_value::<PaneSnapshot>(serde_json::json!({
        "cols": 2,
        "rows": 1
    }))
    .expect_err("missing cells default to empty before shape validation");
    assert!(err
        .to_string()
        .contains("pane snapshot shape mismatch: 2x1 expects 2 cells, got 0"));

    let cell =
        serde_json::from_value::<PaneCell>(serde_json::json!({})).expect("sparse cell defaults");
    assert_eq!(cell, PaneCell::default());

    let glyph = serde_json::from_value::<PaneGlyph>(serde_json::json!({}))
        .expect("sparse glyph defaults to blank");
    assert_eq!(glyph, PaneGlyph::blank());

    let cursor = serde_json::from_value::<PaneCursor>(serde_json::json!({}))
        .expect("sparse cursor defaults");
    assert_eq!(cursor, PaneCursor::default());

    assert_eq!(PaneAttributes::BRIGHT, PaneAttributes::BOLD);
    assert_eq!(PaneAttributes::UNDERSCORE, PaneAttributes::UNDERLINE);
    assert_eq!(PaneAttributes::ITALICS, PaneAttributes::ITALIC);
    assert_eq!(PaneAttributes::NOATTR, PaneAttributes::NO_ATTRIBUTES);
    assert!(PaneAttributes::ALL_UNDERSCORE.contains(PaneAttributes::UNDERLINE));
    assert!(PaneAttributes::ALL_UNDERSCORE.contains(PaneAttributes::DASHED_UNDERLINE));
}
