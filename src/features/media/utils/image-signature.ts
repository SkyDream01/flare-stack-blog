/**
 * Whether a file's bytes are the image type it declares. A raster format is
 * recognized by its file signature; an SVG must be text with an `<svg` root.
 * The declared type is what the file is stored and served as, so a mismatch
 * (text declared as PNG, a JPEG declared as GIF) is refused at upload.
 */
export function matchesDeclaredImageType(
  buffer: ArrayBuffer,
  mimeType: string,
): boolean {
  const bytes = new Uint8Array(buffer);
  switch (mimeType) {
    case "image/jpeg":
    case "image/jpg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWith(
        bytes,
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      );
    case "image/gif":
      return (
        startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a"))
      );
    case "image/webp":
      return (
        startsWith(bytes, ascii("RIFF")) &&
        startsWith(bytes.subarray(8), ascii("WEBP"))
      );
    case "image/svg+xml":
      return isSvgText(bytes);
    default:
      return false;
  }
}

function ascii(text: string) {
  return Array.from(text, (char) => char.charCodeAt(0));
}

function startsWith(bytes: Uint8Array, signature: Array<number>) {
  return (
    bytes.length >= signature.length &&
    signature.every((byte, index) => bytes[index] === byte)
  );
}

function isSvgText(bytes: Uint8Array) {
  // Binary data has NUL bytes early on; UTF-8 SVG text has none.
  if (bytes.subarray(0, 1024).includes(0)) return false;
  const text = new TextDecoder().decode(bytes);
  // Before the root element only a BOM, an XML declaration, comments,
  // processing instructions and a doctype may appear.
  const prolog =
    /^\uFEFF?(?:\s|<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>[]*(?:\[[\s\S]*?\])?\s*>)*/i;
  const rest = text.slice(prolog.exec(text)?.[0].length ?? 0);
  return /^<svg[\s>/]/i.test(rest);
}
