import { useEffect } from "react";

// Locks scrolling on <body> while `enabled` and pads the body by the scrollbar
// width so removing the scrollbar does not let fixed/flow content reflow into
// the reclaimed gutter (which otherwise causes a one-frame shift of the top
// bar and other layout elements just before the overlay paints).
//
// `enabled` defaults to true (lock for the component's whole lifetime); pass a
// boolean to lock only while an overlay/drawer is open.
export function useBodyScrollLock(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [enabled]);
}
