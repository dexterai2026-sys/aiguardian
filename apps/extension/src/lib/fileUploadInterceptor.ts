import type { Finding } from "@guardian/engine-ts";
import { isScannableFile, readFileAsText } from "./fileScanner.js";
import { createFileWarningPanel } from "./interceptionPanel.js";

export interface FileUploadInterceptorOptions {
  /** The document to watch for file inputs on - delegated at this level (not per-input),
   * since an AI site's upload `<input type="file">` isn't necessarily inside the compose box's
   * own container, and may not even exist yet at the time this attaches. */
  root: Document;
  detect: (text: string) => Finding[];
}

/**
 * Scans a file's content before letting an `<input type="file">` selection reach the host page,
 * for text-like file types (see fileScanner.ts - binary formats like PDFs/images are a known,
 * documented gap, not silently ignored). Only ever intervenes when a scanned file actually has
 * findings; an unscannable file type, or a scannable one with nothing flagged, passes through
 * untouched.
 *
 * Same capture-phase + bypass-flag pattern as sendInterceptor.ts, and for the same reason: the
 * content script attaches after the host page's own "change" listener, so only a capture-phase
 * listener is guaranteed to run first and get a chance to stop the upload before the site reacts
 * to it. There is no way to *mask* a file's content in place the way a text message can be
 * masked - the person's only options are to cancel the upload or proceed with it unchanged.
 *
 * Drag-and-drop file uploads (as opposed to a file input's own picker) are a separate, harder
 * case - replaying a "drop" event requires reconstructing a DataTransfer, which isn't reliably
 * supported the way replaying a click/keydown is - and are a known, documented gap for a later
 * PR, not attempted here.
 *
 * Returns a handle to detach the listener (same shape as highlightOverlay.ts's destroy()) -
 * mainly so tests can attach a fresh instance per case without leaking a document-level listener
 * into the next one.
 */
export interface FileUploadInterceptorHandle {
  destroy(): void;
}

export function attachFileUploadInterceptor(
  options: FileUploadInterceptorOptions,
): FileUploadInterceptorHandle {
  const { root, detect } = options;
  let bypassNextChange = false;

  function replay(target: HTMLInputElement): void {
    bypassNextChange = true;
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const listener = (event: Event): void => {
    if (bypassNextChange) {
      bypassNextChange = false;
      return;
    }

    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file" || !input.files) {
      return;
    }

    const files = Array.from(input.files);
    const scannable = files.filter(isScannableFile);
    if (scannable.length === 0) {
      return; // nothing this engine can inspect - let it through rather than block blindly
    }

    // Reading files is async, but the "change" event itself must be handled synchronously to
    // preventDefault() in time - so provisionally stop the event now, and only actually show
    // the panel once a scan confirms there's something to review. If nothing turns up, replay
    // immediately to let the original selection through unmodified.
    event.preventDefault();
    event.stopImmediatePropagation();

    void Promise.all(scannable.map(async (file) => ({ file, text: await readFileAsText(file) })))
      .then((scannedFiles) => {
        const flagged = scannedFiles
          .map(({ file, text }) => ({ file, findings: detect(text) }))
          .filter(({ findings }) => findings.length > 0);

        if (flagged.length === 0) {
          replay(input);
          return;
        }

        const fileList = flagged.map(({ file }) => file.name).join(", ");
        const categoryList = [
          ...new Set(flagged.flatMap(({ findings }) => findings.map((f) => f.category))),
        ];
        const panel = createFileWarningPanel(
          root,
          `${fileList}\n\nCategories found: ${categoryList.join(", ")}`,
          {
            onCancelUpload(): void {
              panel.remove();
              input.value = "";
            },
            onUploadAnyway(): void {
              panel.remove();
              replay(input);
            },
          },
        );
        input.insertAdjacentElement("afterend", panel.element);
      })
      .catch(() => {
        // A file read failing (permissions, an unreadable file, etc.) is not a security
        // decision to make silently either way - err toward letting the original selection
        // through rather than leaving the input permanently stuck mid-scan.
        replay(input);
      });
  };

  root.addEventListener("change", listener, { capture: true });

  return {
    destroy(): void {
      root.removeEventListener("change", listener, { capture: true });
    },
  };
}
