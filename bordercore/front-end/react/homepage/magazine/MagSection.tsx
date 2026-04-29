import React from "react";
import type { ReactNode } from "react";

type Accent = "pink" | "cyan" | "purple" | "danger" | "neutral";

interface MagSectionProps {
  accent: Accent;
  kicker: ReactNode;
  children: ReactNode;
  className?: string;
}

export function MagSection({ accent, kicker, children, className }: MagSectionProps) {
  const cls = ["mag-section", `is-${accent}`, className].filter(Boolean).join(" ");
  return (
    <section className={cls}>
      <div className="mag-section-kicker">
        <span className="mag-section-kicker-dot" aria-hidden="true" />
        <span className="mag-section-kicker-label">{kicker}</span>
      </div>
      <div className="mag-section-body">{children}</div>
    </section>
  );
}
