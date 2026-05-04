// Source of truth for tag → color mapping (used by SCSS class generation
// and by React for picking the right modifier class).
//
// Keep in sync with the $tag-colors map in static/scss/pages/_collections.scss.

export const TAG_COLORS: Record<string, string> = {
  cyberpunk: "#b36bff",
  fitness: "#3fd29c",
  inspiration: "#f0b840",
  ui: "#4cc2ff",
  reference: "#7c7fff",
  food: "#ff5577",
  travel: "#3fd29c",
  art: "#ff3dbd",
  reading: "#f0b840",
  cosplay: "#ff3dbd",
  retro: "#7c7fff",
  workspace: "#4cc2ff",
  personal: "#b36bff",
  links: "#4cc2ff",
  research: "#7c7fff",
};

export const TAG_COLOR_DEFAULT = "#7c7fff";

/**
 * Return the SCSS-class slug for a tag, or "default" if the tag is not in
 * TAG_COLORS. Used to pick `.cl-tag-color-{slug}` on tag chips and rail rows.
 */
export function tagSlug(tagName: string): string {
  return tagName in TAG_COLORS ? tagName : "default";
}
