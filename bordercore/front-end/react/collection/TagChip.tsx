import React from "react";
import { tagSlug } from "./tagColors";

interface TagChipProps {
  name: string;
}

export function TagChip({ name }: TagChipProps) {
  return (
    <span className={`cl-tag cl-tag-color-${tagSlug(name)}`}>
      <span className="cl-tag-dot" />
      <span>{name}</span>
    </span>
  );
}

interface TagDotProps {
  name: string;
}

export function TagDot({ name }: TagDotProps) {
  return <span className={`cl-tag-dot-only cl-tag-color-${tagSlug(name)}`} aria-hidden="true" />;
}

export default TagChip;
