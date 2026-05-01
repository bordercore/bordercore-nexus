// djb2 string hash → stable hue per tag, expressed in OKLCH so each chip
// stays in the same lightness/chroma band as the accent token.
function djb2(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) + hash + input.charCodeAt(i);
    hash |= 0; // force int32
  }
  return Math.abs(hash);
}

export function tagHue(tag: string): number {
  return djb2(tag.toLowerCase()) % 360;
}

export function tagColor(tag: string): string {
  return `oklch(70% 0.13 ${tagHue(tag)})`;
}
