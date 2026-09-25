/**
 * Which files get scanned before upload (see fileUploadInterceptor.ts). Deliberately narrow:
 * only formats whose bytes *are* the text (no parsing/OCR involved). PDFs, Word documents,
 * images, and other binary formats are a known, documented gap - CLAUDE.md's site-adapter
 * philosophy applies equally here: an honest, narrow scope beats a fragile attempt at parsing
 * formats this engine has no real way to inspect.
 */
const SCANNABLE_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);
const SCANNABLE_EXTENSIONS = [".txt", ".md", ".markdown", ".csv", ".json"];

export function isScannableFile(file: File): boolean {
  if (SCANNABLE_MIME_TYPES.has(file.type)) {
    return true;
  }
  // Falls back to extension when the browser/OS didn't supply a MIME type (common for .md, and
  // for files dragged in from some file managers) - never trusted alone for a positive when a
  // MIME type IS present and doesn't match, only as a fallback when type is empty.
  if (file.type === "") {
    const name = file.name.toLowerCase();
    return SCANNABLE_EXTENSIONS.some((extension) => name.endsWith(extension));
  }
  return false;
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error(`failed to read file: ${file.name}`));
    reader.readAsText(file);
  });
}
