import { afterEach, describe, expect, it, vi } from "vitest";
import type { Finding } from "@guardian/engine-ts";
import {
  attachFileUploadInterceptor,
  type FileUploadInterceptorHandle,
} from "./fileUploadInterceptor.js";

// The interceptor delegates via a single document-level listener, so each test's instance must be
// torn down afterward - otherwise a stale listener from a prior test (bound to its own now-removed
// input) keeps firing on every subsequent test's "change" events too.
let handle: FileUploadInterceptorHandle | undefined;

afterEach(() => {
  handle?.destroy();
  handle = undefined;
});

// jsdom in this project's test environment doesn't implement DataTransfer, so this defines
// `files` directly rather than going through a DataTransfer to build a real FileList.
function setInputFiles(input: HTMLInputElement, files: File[]): void {
  Object.defineProperty(input, "files", {
    value: Object.assign(files.slice(), {
      item(index: number): File | null {
        return files[index] ?? null;
      },
    }),
    configurable: true,
  });
}

function fireChange(input: HTMLInputElement): void {
  input.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
}

function emailFinding(text: string): Finding[] {
  const start = text.indexOf("jane@example.com");
  if (start === -1) {
    return [];
  }
  return [
    {
      category: "pii.email",
      start,
      end: start + "jane@example.com".length,
      confidence: 0.95,
      tier: 1,
      suggestedPlaceholder: "EMAIL",
    },
  ];
}

// Reading a file is async (and jsdom's FileReader takes more than one macrotask to settle), so
// most assertions here need to wait a few ticks after firing "change".
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("attachFileUploadInterceptor", () => {
  it("lets a non-scannable file through untouched", async () => {
    document.body.innerHTML = "<input type='file' id='upload' />";
    const input = document.querySelector<HTMLInputElement>("#upload")!;
    const siteHandler = vi.fn();
    input.addEventListener("change", siteHandler);
    handle = attachFileUploadInterceptor({ root: document, detect: emailFinding });

    setInputFiles(input, [new File(["a photo"], "photo.jpg", { type: "image/jpeg" })]);
    fireChange(input);
    await flush();

    expect(siteHandler).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".guardian-file-warning-panel")).toBeNull();
  });

  it("lets a scannable file with no findings through untouched", async () => {
    document.body.innerHTML = "<input type='file' id='upload' />";
    const input = document.querySelector<HTMLInputElement>("#upload")!;
    const siteHandler = vi.fn();
    input.addEventListener("change", siteHandler);
    handle = attachFileUploadInterceptor({ root: document, detect: emailFinding });

    setInputFiles(input, [
      new File(["nothing sensitive here"], "notes.txt", { type: "text/plain" }),
    ]);
    fireChange(input);
    await flush();

    expect(siteHandler).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".guardian-file-warning-panel")).toBeNull();
  });

  it("shows the file warning panel and blocks the site's handler when a scannable file has findings", async () => {
    document.body.innerHTML = "<input type='file' id='upload' />";
    const input = document.querySelector<HTMLInputElement>("#upload")!;
    const siteHandler = vi.fn();
    input.addEventListener("change", siteHandler);
    handle = attachFileUploadInterceptor({ root: document, detect: emailFinding });

    setInputFiles(input, [
      new File(["contact jane@example.com"], "notes.txt", { type: "text/plain" }),
    ]);
    fireChange(input);
    await flush();

    expect(siteHandler).not.toHaveBeenCalled();
    const panel = document.querySelector(".guardian-file-warning-panel");
    expect(panel).not.toBeNull();
    expect(panel!.querySelector(".guardian-file-warning-summary")!.textContent).toContain(
      "notes.txt",
    );
    expect(panel!.querySelector(".guardian-file-warning-summary")!.textContent).toContain(
      "pii.email",
    );
  });

  it('"Cancel upload" removes the panel and clears the input, without replaying the change', async () => {
    document.body.innerHTML = "<input type='file' id='upload' />";
    const input = document.querySelector<HTMLInputElement>("#upload")!;
    const siteHandler = vi.fn();
    input.addEventListener("change", siteHandler);
    handle = attachFileUploadInterceptor({ root: document, detect: emailFinding });

    setInputFiles(input, [
      new File(["contact jane@example.com"], "notes.txt", { type: "text/plain" }),
    ]);
    fireChange(input);
    await flush();

    document.querySelector<HTMLButtonElement>(".guardian-btn-cancel-upload")!.click();

    expect(input.value).toBe("");
    expect(document.querySelector(".guardian-file-warning-panel")).toBeNull();
    expect(siteHandler).not.toHaveBeenCalled();
  });

  it('"Upload anyway" replays the change so the site\'s handler receives the original file, without re-intercepting (no infinite loop)', async () => {
    document.body.innerHTML = "<input type='file' id='upload' />";
    const input = document.querySelector<HTMLInputElement>("#upload")!;
    const siteHandler = vi.fn();
    input.addEventListener("change", siteHandler);
    handle = attachFileUploadInterceptor({ root: document, detect: emailFinding });

    setInputFiles(input, [
      new File(["contact jane@example.com"], "notes.txt", { type: "text/plain" }),
    ]);
    fireChange(input);
    await flush();

    document.querySelector<HTMLButtonElement>(".guardian-btn-upload-anyway")!.click();

    expect(siteHandler).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll(".guardian-file-warning-panel")).toHaveLength(0);
  });

  it("calls onFindings once, with every flagged file's findings, when the panel is shown", async () => {
    document.body.innerHTML = "<input type='file' id='upload' />";
    const input = document.querySelector<HTMLInputElement>("#upload")!;
    const onFindings = vi.fn();
    handle = attachFileUploadInterceptor({ root: document, detect: emailFinding, onFindings });

    setInputFiles(input, [
      new File(["contact jane@example.com"], "notes.txt", { type: "text/plain" }),
    ]);
    fireChange(input);
    await flush();

    expect(onFindings).toHaveBeenCalledExactlyOnceWith(emailFinding("contact jane@example.com"));
  });

  it("never calls onFindings when nothing is flagged", async () => {
    document.body.innerHTML = "<input type='file' id='upload' />";
    const input = document.querySelector<HTMLInputElement>("#upload")!;
    const onFindings = vi.fn();
    handle = attachFileUploadInterceptor({ root: document, detect: emailFinding, onFindings });

    setInputFiles(input, [
      new File(["nothing sensitive here"], "notes.txt", { type: "text/plain" }),
    ]);
    fireChange(input);
    await flush();

    expect(onFindings).not.toHaveBeenCalled();
  });
});
