/**
 * Saving files in the browser, shared by every download: the spreadsheets built here today, and files the
 * backend will send later (pass its response to `downloadResponse`).
 */

/** Keeps a file name safe to save: no folders, control characters or characters Windows refuses. */
export function safeFileName(name: string, fallback = "download"): string {
  const cleaned = [...name]
    .filter((ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) !== 0x7f)
    .join("")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 180);
  return cleaned || fallback;
}

/** Starts a download of `data` named `fileName`. */
export function saveFile(data: Blob, fileName: string): void {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFileName(fileName);
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Some browsers read the file after click() returns; revoking at once can cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** The name in a Content-Disposition header (`filename*=UTF-8''…` preferred over `filename="…"`). */
export function fileNameFromDisposition(header: string | null | undefined): string | undefined {
  if (!header) return undefined;
  const star = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header);
  if (star?.[2]) {
    try {
      return decodeURIComponent(star[2].trim().replace(/^"|"$/g, ""));
    } catch {
      // Badly encoded: fall back to the plain filename below.
    }
  }
  const plain = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(header);
  const name = (plain?.[2] ?? plain?.[1])?.trim();
  return name || undefined;
}

/**
 * Saves a file the server sent, e.g. `downloadResponse(await fetch("/api/exports/shipments", {
 * credentials: "include" }), "shipments.xlsx")`. Uses the server's file name when it gives one.
 */
export async function downloadResponse(response: Response, fallbackName: string): Promise<void> {
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const blob = await response.blob();
  saveFile(
    blob,
    fileNameFromDisposition(response.headers.get("content-disposition")) ?? fallbackName,
  );
}
