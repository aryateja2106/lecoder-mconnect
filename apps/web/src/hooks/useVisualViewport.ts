"use client";

import { useEffect, useState } from "react";

/**
 * Watches the iOS / mobile-Chrome visual viewport so we can position the
 * hardware-key toolbar exactly above the soft keyboard. window.resize doesn't
 * fire when the keyboard slides in on iOS Safari; visualViewport does.
 */
export interface ViewportInfo {
  /** Visible viewport height (CSS px). */
  height: number;
  /** How far the visual viewport's bottom is from the layout viewport's
   *  bottom — i.e. the keyboard's height when it's open. */
  keyboardOffset: number;
  /** True when keyboardOffset is >0 (heuristic: keyboard is up). */
  keyboardOpen: boolean;
}

export function useVisualViewport(): ViewportInfo {
  const [info, setInfo] = useState<ViewportInfo>({
    height: typeof window === "undefined" ? 0 : window.innerHeight,
    keyboardOffset: 0,
    keyboardOpen: false,
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;

    const update = () => {
      const layoutHeight = window.innerHeight;
      const visibleHeight = vv.height;
      const offset = Math.max(0, layoutHeight - visibleHeight - vv.offsetTop);
      setInfo({
        height: visibleHeight,
        keyboardOffset: offset,
        // 60px threshold filters out URL-bar collapse on Safari from being
        // misread as a keyboard event.
        keyboardOpen: offset > 60,
      });
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return info;
}
