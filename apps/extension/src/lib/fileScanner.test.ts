import { describe, expect, it } from "vitest";
import { isScannableFile, readFileAsText } from "./fileScanner.js";

function makeFile(name: string, type: string, content = ""): File {
  return new File([content], name, { type });
}

describe("isScannableFile", () => {
  it("accepts known text-like MIME types", () => {
    expect(isScannableFile(makeFile("notes.txt", "text/plain"))).toBe(true);
    expect(isScannableFile(makeFile("data.json", "application/json"))).toBe(true);
    expect(isScannableFile(makeFile("sheet.csv", "text/csv"))).toBe(true);
  });

  it("rejects a binary MIME type even with a text-like extension", () => {
    // A mismatched/spoofed extension shouldn't override a real, present MIME type.
    expect(isScannableFile(makeFile("fake.txt", "application/pdf"))).toBe(false);
  });

  it("rejects an unknown MIME type", () => {
    expect(isScannableFile(makeFile("photo.jpg", "image/jpeg"))).toBe(false);
  });

  it("falls back to extension when the browser supplied no MIME type", () => {
    expect(isScannableFile(makeFile("README.md", ""))).toBe(true);
    expect(isScannableFile(makeFile("photo.jpg", ""))).toBe(false);
  });
});

describe("readFileAsText", () => {
  it("resolves with the file's text content", async () => {
    const file = makeFile("notes.txt", "text/plain", "contact jane@example.com please");
    await expect(readFileAsText(file)).resolves.toBe("contact jane@example.com please");
  });
});
