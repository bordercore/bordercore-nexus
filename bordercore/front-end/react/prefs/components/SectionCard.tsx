import React from "react";

interface SectionCardProps {
  title: string;
  meta?: string;
  children: React.ReactNode;
}

export function SectionCard({ title, meta, children }: SectionCardProps) {
  return (
    <section className="prefs-section">
      <div className="prefs-section-head">
        <h2>{title}</h2>
        {meta && <span className="meta">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

export default SectionCard;
