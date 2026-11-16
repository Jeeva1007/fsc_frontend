/**
 * Browser-side hardening helpers. These reduce risk in the UI only; the backend must still
 * validate, authorize, and encode every value it accepts or returns.
 */

const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|bmp|avif);base64,[a-z0-9+/=\s]*$/i;

/**
 * Returns `value` only when it is safe to use as an <img src> or <a href> for a screenshot:
 * an http(s)/blob URL, a same-origin relative path, or a raster image data URL.
 * `javascript:`, `data:text/html`, `data:image/svg+xml`, and other schemes yield undefined.
 */
export function safeImageSrc(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (SAFE_DATA_IMAGE.test(v)) return v;
  if (/^(https?:|blob:)/i.test(v)) {
    try {
      return new URL(v).href;
    } catch {
      return undefined;
    }
  }
  // Relative path ("/x", "./x", "x.png") only when it carries no scheme and is not protocol-relative.
  if (/^(\/(?!\/)|\.\/|\.\.\/)/.test(v) || /^[^:]*$/.test(v))
    return v.startsWith("//") ? undefined : v;
  return undefined;
}

/**
 * Neutralizes spreadsheet formula injection (CSV injection) for text cells: a leading
 * = + - @ tab or CR is prefixed with an apostrophe. Numbers and numeric-looking text are untouched.
 */
export function csvSafeCell(v: string | number): string | number {
  if (typeof v === "number") return v;
  if (/^[=+\-@\t\r]/.test(v) && !/^[-+]?\d+(\.\d+)?$/.test(v)) return `'${v}`;
  return v;
}
