import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Anything that exposes a focus() method — covers HTMLInputElement,
 * HTMLSelectElement, HTMLTextAreaElement, and imperative handles
 * (e.g. TagsInputHandle, SelectValueHandle).
 */
interface Focusable {
  focus(): void;
}

/**
 * Attach a global Ctrl-K / Cmd-K shortcut that focuses the input behind
 * `ref`. When the page mounts the listener is registered; when it
 * unmounts the listener is removed, so cross-page conflicts can't occur.
 *
 * If `ref.current` is null when the shortcut fires (e.g. the input is
 * mode-gated and not currently rendered) the hook silently no-ops — this
 * is why callers can safely register multiple hooks against alternative
 * refs and let whichever input is mounted win.
 *
 * For HTMLInputElement-shaped refs we also call .select() so an existing
 * query is highlighted ready to overwrite, matching the GitHub/Linear
 * Ctrl-K convention.
 */
export function useFocusOnCtrlK<T extends Focusable>(ref: RefObject<T | null>): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        const target = ref.current;
        if (!target) return;
        event.preventDefault();
        target.focus();
        // Native text inputs get their value selected so the next
        // keystroke overwrites — imperative handles may not expose
        // select(), so we feature-detect.
        const maybeSelect = (target as { select?: () => void }).select;
        if (typeof maybeSelect === "function") {
          maybeSelect.call(target);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [ref]);
}

export default useFocusOnCtrlK;
