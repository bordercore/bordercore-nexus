import { useState, useEffect } from "react";

/**
 * Subscribe to a CSS media query and return whether it currently matches.
 *
 * Used to switch component behavior between desktop and mobile layouts (e.g.
 * the bookmark rows render a dropdown menu on desktop but a swipe-to-reveal
 * action tray below 640px). Re-renders when the match state changes.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export default useMediaQuery;
