import React from "react";

export type CardProps = {
  title?: string;

  /**
   * Full replacement for the title area.
   * Mirrors the Vue `title-slot`.
   */
  titleSlot?: React.ReactNode;

  /**
   * Content shown on the right side of the default title row.
   * Mirrors the Vue `top-right` slot.
   */
  topRight?: React.ReactNode;

  /**
   * Card body content.
   * Mirrors the Vue `content` slot.
   */
  children?: React.ReactNode;
};

export function Card({ title = "Card Title", titleSlot, topRight, children }: CardProps) {
  return (
    <div className="card-body">
      {titleSlot ??
        (title ? (
          <div className="card-title d-flex">
            {title}
            <div className="ms-auto">{topRight}</div>
          </div>
        ) : null)}

      <div className="card-content">{children ?? "Insert your content here"}</div>
    </div>
  );
}

export default Card;
