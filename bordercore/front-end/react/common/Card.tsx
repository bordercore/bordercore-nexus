import React from "react";

export type CardProps = {
  title?: string;

  /**
   * Additional CSS classes to add to the card-body element.
   */
  className?: string;

  /**
   * Additional CSS classes to add to the outer card wrapper element.
   */
  cardClassName?: string;

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

export function Card({ title = "Card Title", className, cardClassName, titleSlot, topRight, children }: CardProps) {
  const cardClasses = ["card-body", className].filter(Boolean).join(" ");
  const outerCardClasses = ["card", cardClassName].filter(Boolean).join(" ");

  return (
    <div className={outerCardClasses}>
      <div className={cardClasses}>
        {titleSlot ??
          (title ? (
            <div className="card-title d-flex">
              {title}
              <div className="ms-auto">{topRight}</div>
            </div>
          ) : null)}

        {children ?? "Insert your content here"}
      </div>
    </div>
  );
}

export default Card;
