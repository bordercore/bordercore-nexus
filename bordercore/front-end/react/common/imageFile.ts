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
