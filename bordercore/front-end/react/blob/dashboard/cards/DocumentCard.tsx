import React from "react";
import type { DashboardBlob } from "../types";
import DoctypeBadge from "./shared/DoctypeBadge";
import TagChips from "./shared/TagChips";
import CardMeta from "./shared/CardMeta";

interface DocumentCardProps {
  blob: DashboardBlob;
  onTagClick: (tag: string) => void;
}

function ctypeLabel(contentType: string): string | null {
  if (!contentType) return null;
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "text/html": "HTML",
    "application/epub+zip": "EPUB",
    "application/x-mobipocket-ebook": "MOBI",
    "text/plain": "TXT",
  };
  return map[contentType] || contentType.split("/").pop()?.toUpperCase() || null;
}

export function DocumentCard({ blob, onTagClick }: DocumentCardProps) {
  const ctype = ctypeLabel(blob.content_type);
  return (
    <a className="rb-card rb-card-document" href={blob.url}>
      {!blob.content && (
        <div className="rb-card-thumb rb-card-thumb-document">
          <div className="rb-doc-placeholder">
            {blob.external_url && <div className="rb-doc-url">▸ {blob.external_url}</div>}
            {blob.num_pages > 0 && <div className="rb-doc-pages">{blob.num_pages} pages</div>}
          </div>
        </div>
      )}
      <div className="rb-card-body">
        <div className="rb-card-row">
          <DoctypeBadge doctype={blob.doctype} label={blob.doctype.toUpperCase()} />
          {ctype && <span className="rb-card-ctype">{ctype}</span>}
        </div>
        <div className="rb-card-title">{blob.name}</div>
        {blob.content && <div className="rb-note-text">{blob.content}</div>}
        {blob.tags.length > 0 && <TagChips tags={blob.tags} onTagClick={onTagClick} max={2} />}
        <CardMeta
          parts={[
            blob.created_rel,
            blob.size || null,
            blob.back_refs > 0 ? `${blob.back_refs}↩` : null,
          ]}
        />
      </div>
    </a>
  );
}

export default DocumentCard;
