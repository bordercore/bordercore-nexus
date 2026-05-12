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
   * ID attribute for the outer card wrapper element.
   */
  id?: string;

  /**
   * Full replacement for the title area.
   */
  titleSlot?: React.ReactNode;

  /**
   * Content shown on the right side of the default title row.
   */
  topRight?: React.ReactNode;

  /**
   * Card body content.
   */
  children?: React.ReactNode;
};

// Tailwind utilities below provide every structural style Bootstrap's
// .card / .card-body / .card-title rules contribute (display/flex layout,
// min-width, flex-auto body, title margin). The `card`, `card-body`, and
// `card-title` class names stay on the rendered DOM because project SCSS
// (static/scss/layout/_layout.scss, components/_cards.scss, and a handful
// of page-specific files) targets them for the visual chrome — borders,
// background, padding, dashboard-card hover effects, etc. After Bootstrap
// is removed in migration Phase 4, those class names become inert anchors
// for our own SCSS rather than Bootstrap selectors.
const OUTER_CLASSES = "card relative flex flex-col min-w-0 break-words";
// flex-auto (flex: 1 1 auto) matches Bootstrap's .card-body; Tailwind's
// flex-1 would change flex-basis from auto to 0% and shift cards with a
// fixed height.
const BODY_CLASSES = "card-body flex-auto";
const TITLE_CLASSES = "card-title flex mb-2";

export function Card({
  title = "Card Title",
  className,
  cardClassName,
  id,
  titleSlot,
  topRight,
  children,
}: CardProps) {
  const outerCardClasses = [OUTER_CLASSES, cardClassName].filter(Boolean).join(" ");
  const cardClasses = [BODY_CLASSES, className].filter(Boolean).join(" ");

  return (
    <div className={outerCardClasses} id={id}>
      <div className={cardClasses}>
        {titleSlot ??
          (title ? (
            <div className={TITLE_CLASSES}>
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
