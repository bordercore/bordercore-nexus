// Re-typesets MathJax over a freshly-rendered DOM subtree. MathJax is loaded
// per-page (e.g. drill/question.html loads it from a CDN); where it is absent
// this is a no-op, so the chatbot simply shows the raw delimiters instead of
// throwing. Scoping to a single element keeps each call cheap.
//
// The CDN script loads asynchronously, so a fast chat reply can finish
// rendering before MathJax has initialized. When that happens `typesetPromise`
// does not exist yet; we wait on `startup.promise` and typeset once it
// resolves rather than silently giving up.
interface MathJaxApi {
  startup?: { promise?: Promise<unknown> };
  typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
  typeset?: (elements?: HTMLElement[]) => void;
}

function getMathJax(): MathJaxApi | undefined {
  return (window as unknown as { MathJax?: MathJaxApi }).MathJax;
}

export function typesetMath(el: HTMLElement | null): void {
  if (!el) return;

  const mathJax = getMathJax();
  if (!mathJax) return;

  const run = () => {
    // Re-read MathJax: while we awaited startup it may have been replaced with
    // the fully initialized instance.
    const mj = getMathJax();
    if (mj?.typesetPromise) return mj.typesetPromise([el]);
    if (mj?.typeset) mj.typeset([el]);
    return Promise.resolve();
  };

  const ready = mathJax.startup?.promise ?? Promise.resolve();
  Promise.resolve(ready)
    .then(run)
    .catch((err: unknown) => {
      console.error("MathJax typeset failed:", err);
    });
}

export default typesetMath;
