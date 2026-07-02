import { describe, expect, it } from "vitest";
import { sequenceFor, withCtrl } from "./terminal-keys";
import { createStickyModifierState } from "./sticky-modifiers";

describe("terminal key helpers", () => {
  it("maps terminal hardware keys to xterm-compatible sequences", () => {
    expect(sequenceFor("Esc")).toBe("\x1b");
    expect(sequenceFor("Tab")).toBe("\t");
    expect(sequenceFor("Enter")).toBe("\r");
    expect(sequenceFor("ArrowUp")).toBe("\x1b[A");
    expect(sequenceFor("ArrowDown")).toBe("\x1b[B");
    expect(sequenceFor("ArrowLeft")).toBe("\x1b[D");
    expect(sequenceFor("ArrowRight")).toBe("\x1b[C");
    expect(sequenceFor("PgUp")).toBe("\x1b[5~");
    expect(sequenceFor("PgDn")).toBe("\x1b[6~");
  });

  it("transforms Ctrl plus ASCII letters into control bytes", () => {
    expect(withCtrl("c")).toBe("\x03");
    expect(withCtrl("C")).toBe("\x03");
    expect(withCtrl("l")).toBe("\x0c");
    expect(withCtrl("[")).toBe("\x1b");
    expect(withCtrl("1")).toBe("1");
    expect(withCtrl("paste")).toBe("paste");
  });

  it("arms, locks, consumes, and resets sticky modifiers", () => {
    const state = createStickyModifierState();

    state.tap("ctrl", 1000);
    expect(state.snapshot().armed).toEqual(new Set(["ctrl"]));
    expect(state.isActive("ctrl")).toBe(true);

    state.consume();
    expect(state.snapshot().armed).toEqual(new Set());
    expect(state.isActive("ctrl")).toBe(false);

    state.tap("shift", 2000);
    state.tap("shift", 2200);
    expect(state.snapshot().locked).toEqual(new Set(["shift"]));
    expect(state.isActive("shift")).toBe(true);

    state.consume();
    expect(state.isActive("shift")).toBe(true);

    state.tap("shift", 2600);
    expect(state.isActive("shift")).toBe(false);

    state.tap("alt", 3000);
    state.reset();
    expect(state.snapshot()).toEqual({ armed: new Set(), locked: new Set() });
  });
});
