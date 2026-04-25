import React, { useEffect, useRef } from "react";

// Mounts pre-sanitized HTML by parsing it into a DocumentFragment via
// Range.createContextualFragment, then appending. The caller is responsible
// for sanitizing — in the chatbot that happens in markdown.ts via DOMPurify
// before any string ever reaches this component.
//
// Why a wrapper at all? Routing every HTML mount through one named component
// makes the trust boundary obvious — there is exactly one place in the
// chatbot directory that writes raw HTML to the DOM, and it has a name you
// can grep for.
interface SanitizedHtmlProps {
  html: string;
  className?: string;
}

export function SanitizedHtml({ html, className }: SanitizedHtmlProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
    const range = document.createRange();
    const fragment = range.createContextualFragment(html);
    node.appendChild(fragment);
  }, [html]);
  return <span ref={ref} className={className} />;
}

export default SanitizedHtml;
