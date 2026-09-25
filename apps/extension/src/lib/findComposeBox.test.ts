import { describe, expect, it, vi } from "vitest";
import {
  findComposeBox,
  findComposeBoxWithFallback,
  readComposeBoxText,
} from "./findComposeBox.js";

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

describe("findComposeBoxWithFallback", () => {
  it("returns the adapter's own result without ever calling the generic heuristic", () => {
    document.body.innerHTML = '<textarea id="generic-candidate"></textarea>';
    stubRect(document.querySelector("#generic-candidate")!, 600, 120);
    const adapterBox = document.createElement("div");
    document.body.appendChild(adapterBox);

    expect(findComposeBoxWithFallback(() => adapterBox)).toBe(adapterBox);
  });

  it("falls back to the generic largest-visible-input heuristic when the adapter finds nothing", () => {
    document.body.innerHTML = '<textarea id="fallback-candidate"></textarea>';
    const fallbackCandidate = document.querySelector<HTMLElement>("#fallback-candidate")!;
    stubRect(fallbackCandidate, 600, 120);

    expect(findComposeBoxWithFallback(() => null)).toBe(fallbackCandidate);
  });

  it("returns null when neither the adapter nor the generic heuristic finds anything", () => {
    document.body.innerHTML = "<div>nothing here</div>";
    expect(findComposeBoxWithFallback(() => null)).toBeNull();
  });

  it("never calls the generic heuristic's DOM search when the adapter already found something", () => {
    const adapterBox = document.createElement("div");
    document.body.appendChild(adapterBox);
    const querySelectorAllSpy = vi.spyOn(document, "querySelectorAll");

    findComposeBoxWithFallback(() => adapterBox);

    expect(querySelectorAllSpy).not.toHaveBeenCalled();
    querySelectorAllSpy.mockRestore();
  });
});
