import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findHiddenTextInSelection } from "./hiddenTextScanner.js";

// jsdom's getBoundingClientRect always returns a zero rect, which this module treats as
// "zero-size, therefore hidden" - the opposite of what most of these tests need. Stubbed per
// element with a real, positive size unless a test is deliberately exercising the zero-size or
// off-screen case.
function stubVisibleRect(element: Element): void {
  element.getBoundingClientRect = () =>
    ({ width: 100, height: 20, top: 0, left: 0, right: 100, bottom: 20 }) as DOMRect;
}

function selectAllOf(element: Element): void {
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

beforeEach(() => {
  document.body.innerHTML = "";
  // jsdom gives every element a zero-size rect by default (no real layout engine), including
  // <html>/<body> themselves - stubbed here to a realistic viewport size so the ancestor walk in
  // isVisuallyHidden doesn't treat every element on the page as hidden just because its root
  // ancestors report zero size. Individual elements are stubbed per test as needed.
  stubVisibleRect(document.documentElement);
  stubVisibleRect(document.body);
});

afterEach(() => {
  window.getSelection()?.removeAllRanges();
});

describe("findHiddenTextInSelection", () => {
  it("returns nothing for a normal, fully visible selection", () => {
    document.body.innerHTML = "<p id='p'>just a normal sentence</p>";
    const p = document.querySelector("#p")!;
    stubVisibleRect(p);
    selectAllOf(p);

    expect(findHiddenTextInSelection(window.getSelection())).toEqual([]);
  });

  it("returns nothing when there is no selection at all", () => {
    expect(findHiddenTextInSelection(null)).toEqual([]);
    expect(findHiddenTextInSelection(window.getSelection())).toEqual([]);
  });

  it("finds text hidden via display:none", () => {
    document.body.innerHTML =
      "<div id='wrap'>visible <span id='hidden' style='display:none'>secret instructions</span></div>";
    const wrap = document.querySelector("#wrap")!;
    const hidden = document.querySelector("#hidden")!;
    stubVisibleRect(wrap);
    stubVisibleRect(hidden);
    selectAllOf(wrap);

    expect(findHiddenTextInSelection(window.getSelection())).toEqual(["secret instructions"]);
  });

  it("finds text hidden via visibility:hidden", () => {
    document.body.innerHTML =
      "<div id='wrap'>visible <span id='hidden' style='visibility:hidden'>secret instructions</span></div>";
    const wrap = document.querySelector("#wrap")!;
    const hidden = document.querySelector("#hidden")!;
    stubVisibleRect(wrap);
    stubVisibleRect(hidden);
    selectAllOf(wrap);

    expect(findHiddenTextInSelection(window.getSelection())).toEqual(["secret instructions"]);
  });

  it("finds text hidden via near-zero opacity", () => {
    document.body.innerHTML =
      "<div id='wrap'>visible <span id='hidden' style='opacity:0.01'>secret instructions</span></div>";
    const wrap = document.querySelector("#wrap")!;
    const hidden = document.querySelector("#hidden")!;
    stubVisibleRect(wrap);
    stubVisibleRect(hidden);
    selectAllOf(wrap);

    expect(findHiddenTextInSelection(window.getSelection())).toEqual(["secret instructions"]);
  });

  it("finds text hidden via near-zero font size", () => {
    document.body.innerHTML =
      "<div id='wrap'>visible <span id='hidden' style='font-size:0px'>secret instructions</span></div>";
    const wrap = document.querySelector("#wrap")!;
    const hidden = document.querySelector("#hidden")!;
    stubVisibleRect(wrap);
    stubVisibleRect(hidden);
    selectAllOf(wrap);

    expect(findHiddenTextInSelection(window.getSelection())).toEqual(["secret instructions"]);
  });

  it("finds text hidden via matching foreground/background color", () => {
    document.body.innerHTML =
      "<div id='wrap'>visible <span id='hidden' style='color:rgb(255, 255, 255);background-color:rgb(255, 255, 255)'>secret instructions</span></div>";
    const wrap = document.querySelector("#wrap")!;
    const hidden = document.querySelector("#hidden")!;
    stubVisibleRect(wrap);
    stubVisibleRect(hidden);
    selectAllOf(wrap);

    expect(findHiddenTextInSelection(window.getSelection())).toEqual(["secret instructions"]);
  });

  it("finds text hidden via a zero-size (clipped) box", () => {
    document.body.innerHTML =
      "<div id='wrap'>visible <span id='hidden'>secret instructions</span></div>";
    const wrap = document.querySelector("#wrap")!;
    const hidden = document.querySelector("#hidden")!;
    stubVisibleRect(wrap);
    hidden.getBoundingClientRect = () =>
      ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }) as DOMRect;
    selectAllOf(wrap);

    expect(findHiddenTextInSelection(window.getSelection())).toEqual(["secret instructions"]);
  });

  it("finds text positioned off-screen", () => {
    document.body.innerHTML =
      "<div id='wrap'>visible <span id='hidden'>secret instructions</span></div>";
    const wrap = document.querySelector("#wrap")!;
    const hidden = document.querySelector("#hidden")!;
    stubVisibleRect(wrap);
    hidden.getBoundingClientRect = () =>
      ({ width: 100, height: 20, top: -9999, left: -9999, right: -9899, bottom: -9979 }) as DOMRect;
    selectAllOf(wrap);

    expect(findHiddenTextInSelection(window.getSelection())).toEqual(["secret instructions"]);
  });

  it("is hidden if any ancestor is hidden, even when the text node's own element isn't styled", () => {
    document.body.innerHTML =
      "<div id='wrap'>visible <span id='hiddenAncestor' style='display:none'><em id='inner'>secret instructions</em></span></div>";
    const wrap = document.querySelector("#wrap")!;
    const hiddenAncestor = document.querySelector("#hiddenAncestor")!;
    const inner = document.querySelector("#inner")!;
    stubVisibleRect(wrap);
    stubVisibleRect(hiddenAncestor);
    stubVisibleRect(inner);
    selectAllOf(wrap);

    expect(findHiddenTextInSelection(window.getSelection())).toEqual(["secret instructions"]);
  });

  it("only reports text actually within the selected range, not hidden text elsewhere on the page", () => {
    document.body.innerHTML = `
      <p id="selected">just a normal sentence</p>
      <p id="elsewhere">visible <span id="hidden" style="display:none">not selected</span></p>
    `;
    const selected = document.querySelector("#selected")!;
    const elsewhere = document.querySelector("#elsewhere")!;
    const hidden = document.querySelector("#hidden")!;
    stubVisibleRect(selected);
    stubVisibleRect(elsewhere);
    stubVisibleRect(hidden);
    selectAllOf(selected);

    expect(findHiddenTextInSelection(window.getSelection())).toEqual([]);
  });

  it("dedupes identical hidden text found more than once", () => {
    document.body.innerHTML = `
      <div id="wrap">
        <span class="h" style="display:none">repeat me</span>
        <span class="h" style="display:none">repeat me</span>
      </div>
    `;
    const wrap = document.querySelector("#wrap")!;
    stubVisibleRect(wrap);
    for (const el of document.querySelectorAll(".h")) {
      stubVisibleRect(el);
    }
    selectAllOf(wrap);

    expect(findHiddenTextInSelection(window.getSelection())).toEqual(["repeat me"]);
  });
});
