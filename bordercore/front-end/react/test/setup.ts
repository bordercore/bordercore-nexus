import "@testing-library/jest-dom/vitest";

// jsdom does not implement AnimationEvent. React probes for it when it builds
// its event registry, and without it falls back to the vendor-prefixed
// "webkitAnimationEnd" — so onAnimationEnd handlers never fire under test and
// fireEvent.animationEnd silently does nothing. Defining it here, before any
// test file imports React, restores the browser behaviour.
class AnimationEventPolyfill extends Event {
  readonly animationName: string;
  readonly elapsedTime: number;
  readonly pseudoElement: string;

  constructor(type: string, init: AnimationEventInit = {}) {
    super(type, init);
    this.animationName = init.animationName ?? "";
    this.elapsedTime = init.elapsedTime ?? 0;
    this.pseudoElement = init.pseudoElement ?? "";
  }
}

// Cast through a loose record: lib.dom declares AnimationEvent, so TypeScript
// treats the runtime absence check as impossible and narrows window to never.
const globalScope = globalThis as unknown as Record<string, unknown>;
if (typeof globalScope.AnimationEvent === "undefined") {
  globalScope.AnimationEvent = AnimationEventPolyfill;
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).AnimationEvent = AnimationEventPolyfill;
  }
}
