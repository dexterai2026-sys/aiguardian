import { describe, expect, it } from "vitest";
import { findComposeBox, readComposeBoxText } from "./findComposeBox.js";

/** jsdom always returns a zero-size rect, so tests stub it per element to simulate real layout. */
function stubRect(element: HTMLElement, width: number, height: number): void {
  element.getBoundingClientRect = () =>
    ({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

describe("findComposeBox", () => {
  it("returns null when there are no candidates", () => {
    document.body.innerHTML = "<div>nothing here</div>";
    expect(findComposeBox(document)).toBeNull();
  });

  it("ignores a hidden/zero-size candidate", () => {
    document.body.innerHTML = '<textarea id="hidden"></textarea>';
    const textarea = document.querySelector<HTMLTextAreaElement>("#hidden")!;
    stubRect(textarea, 0, 0);
    expect(findComposeBox(document)).toBeNull();
  });

  it("picks the larger of two visible textareas", () => {
    document.body.innerHTML = '<textarea id="small"></textarea><textarea id="big"></textarea>';
    const small = document.querySelector<HTMLTextAreaElement>("#small")!;
    const big = document.querySelector<HTMLTextAreaElement>("#big")!;
    stubRect(small, 100, 20);
    stubRect(big, 600, 120);

    expect(findComposeBox(document)).toBe(big);
  });

  it("considers contenteditable elements as candidates too", () => {
    document.body.innerHTML = '<div contenteditable="true" id="editable"></div>';
    const editable = document.querySelector<HTMLElement>("#editable")!;
    stubRect(editable, 500, 200);

    expect(findComposeBox(document)).toBe(editable);
  });

  it("prefers a visible contenteditable over a hidden textarea", () => {
    document.body.innerHTML =
      '<textarea id="hidden"></textarea><div contenteditable="" id="editable"></div>';
    stubRect(document.querySelector("#hidden")!, 0, 0);
    const editable = document.querySelector<HTMLElement>("#editable")!;
    stubRect(editable, 400, 150);

    expect(findComposeBox(document)).toBe(editable);
  });
});

describe("readComposeBoxText", () => {
  it("reads .value from a textarea", () => {
    document.body.innerHTML = "<textarea></textarea>";
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "hello there";
    expect(readComposeBoxText(textarea)).toBe("hello there");
  });

  it("reads .textContent from a contenteditable element", () => {
    document.body.innerHTML = '<div contenteditable="true">hello there</div>';
    const editable = document.querySelector<HTMLElement>("[contenteditable]")!;
    expect(readComposeBoxText(editable)).toBe("hello there");
  });
});
