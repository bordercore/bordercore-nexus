import { afterEach, describe, expect, it, vi } from "vitest";
import { typesetMath } from "./typesetMath";

afterEach(() => {
  delete (window as any).MathJax;
  vi.restoreAllMocks();
});

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe("typesetMath", () => {
  it("calls MathJax.typesetPromise scoped to the given element", async () => {
    const typesetPromise = vi.fn().mockResolvedValue(undefined);
    (window as any).MathJax = { typesetPromise };
    const el = document.createElement("div");

    typesetMath(el);
    await flush();

    expect(typesetPromise).toHaveBeenCalledWith([el]);
  });

  it("waits for MathJax.startup.promise before typesetting", async () => {
    const typesetPromise = vi.fn().mockResolvedValue(undefined);
    let resolveStartup: () => void = () => {};
    const startupPromise = new Promise<void>(r => {
      resolveStartup = r;
    });
    (window as any).MathJax = { startup: { promise: startupPromise }, typesetPromise };
    const el = document.createElement("div");

    typesetMath(el);
    await flush();
    expect(typesetPromise).not.toHaveBeenCalled(); // startup still pending

    resolveStartup();
    await flush();
    expect(typesetPromise).toHaveBeenCalledWith([el]);
  });

  it("falls back to synchronous typeset when typesetPromise is absent", async () => {
    const typeset = vi.fn();
    (window as any).MathJax = { typeset };
    const el = document.createElement("div");

    typesetMath(el);
    await flush();

    expect(typeset).toHaveBeenCalledWith([el]);
  });

  it("is a no-op when MathJax is not loaded", () => {
    const el = document.createElement("div");
    expect(() => typesetMath(el)).not.toThrow();
  });

  it("is a no-op when the element is null", async () => {
    const typesetPromise = vi.fn();
    (window as any).MathJax = { typesetPromise };
    expect(() => typesetMath(null)).not.toThrow();
    await flush();
    expect(typesetPromise).not.toHaveBeenCalled();
  });
});
