// Image extensions accepted by name when the browser reports an empty or
// non-image MIME type. File.type is unreliable: some platforms leave it blank
// for files with uppercase extensions (e.g. "image.JPG"), which would then be
// silently rejected by a MIME-only check on drag-and-drop.
const IMAGE_EXTENSION_RE = /\.(?:jpe?g|png|gif|webp|bmp|tiff?|avif|heic|heif|svg)$/i;

/**
 * Return true if a dropped or selected file looks like an image.
 *
 * Prefers the MIME type but falls back to a case-insensitive filename
 * extension check, so images whose `File.type` the browser leaves empty
 * (notably uppercase extensions) are still accepted.
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || IMAGE_EXTENSION_RE.test(file.name);
}

/**
 * Return the first real URL from a drag `text/uri-list` (or `text/plain`)
 * payload, ignoring blank lines and `#` comments. Returns null if none.
 *
 * Dragging an image out of a browser tab delivers a URL here rather than a
 * File, so this is how we recover what was dragged.
 */
export function parseUriList(text: string): string | null {
  if (!text) return null;
  const line = text
    .split(/\r?\n/)
    .map(s => s.trim())
    .find(s => s.length > 0 && !s.startsWith("#"));
  return line ?? null;
}

/**
 * Pull an image URL out of a drop's DataTransfer.
 *
 * An image dragged from another browser tab is delivered as a URL (in
 * `text/uri-list`, an `<img>` in `text/html`, or `text/plain`) rather than as
 * a File, so a drop handler falls back to this when no file is present.
 *
 * The `<img>` in `text/html` wins over `text/uri-list`. When the dragged
 * image sits inside a link — how images are usually marked up on search
 * results and gallery pages — the browser puts the link's destination in
 * `text/uri-list`, so trusting that first fetches an HTML page instead of the
 * image. Only `text/html` always names the image itself.
 */
export function extractImageUrl(dataTransfer: DataTransfer): string | null {
  const html = dataTransfer.getData("text/html");
  if (html) {
    const match = html.match(/<img[^>]+\bsrc\s*=\s*["']([^"']+)["']/i);
    if (match) return match[1];
  }

  const uriList = parseUriList(dataTransfer.getData("text/uri-list"));
  if (uriList) return uriList;

  const text = dataTransfer.getData("text/plain").trim();
  if (/^https?:\/\//i.test(text)) return text;

  return null;
}

/**
 * Fetch an image URL (e.g. dragged from another browser tab) and wrap it in a
 * File so it can flow through the same path as an uploaded image.
 *
 * Returns null if the URL can't be fetched (cross-origin/CORS or network
 * error) or doesn't resolve to an image.
 */
export async function fetchImageAsFile(url: string): Promise<File | null> {
  let resp: Response;
  try {
    resp = await fetch(url);
  } catch {
    return null; // network error or blocked by CORS
  }
  if (!resp.ok) return null;
  const blob = await resp.blob();
  const name = decodeURIComponent(url.split(/[?#]/)[0].split("/").pop() || "image");
  const file = new File([blob], name, { type: blob.type });
  return isImageFile(file) ? file : null;
}
