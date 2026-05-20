import { useEffect } from "react";

// Locks scrolling on <body> while mounted and pads the body by the scrollbar
// width so removing the scrollbar does not let fixed/flow content reflow into
// the reclaimed gutter (which otherwise causes a one-frame shift of the top
// bar and other layout elements just before the overlay paints).
export function useBodyScrollLock() {
  useEffect(() => {
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
  }, []);
}
