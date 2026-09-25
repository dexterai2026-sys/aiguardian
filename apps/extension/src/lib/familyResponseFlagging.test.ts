import { afterEach, describe, expect, it } from "vitest";
import type { Context } from "@guardian/engine-ts";
import {
  attachFamilyResponseFlagging,
  type FamilyResponseFlaggingHandle,
} from "./familyResponseFlagging.js";

let handle: FamilyResponseFlaggingHandle | undefined;

afterEach(() => {
  handle?.destroy();
  handle = undefined;
});

function familyContext(vault: Context["vault"] = []): Context {
  return {
    appId: "test",
    siteId: "test",
    mode: "family",
    ageProfile: "child",
    vault,
  };
}

// The module debounces scans by 500ms after the last mutation, so tests need to wait past that
// with a real timer, not just a microtask flush.
function waitForScan(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 600));
}

describe("attachFamilyResponseFlagging", () => {
  it("flags a content-category phrase already present when attached", async () => {
    document.body.innerHTML = `<div id="response">Sure, this stays between us.</div>`;
    handle = attachFamilyResponseFlagging({
      root: document.body,
      responseContainerSelector: "#response",
      getContext: async () => familyContext(),
    });

    await waitForScan();

    const mark = document.querySelector(".guardian-family-flag");
    expect(mark).not.toBeNull();
    expect(mark!.getAttribute("data-category")).toBe("content.secrecy_from_parents");
    expect(mark!.textContent).toBe("this stays between us");
    // The surrounding text must survive untouched, not be swallowed by the highlight.
    expect(document.querySelector("#response")!.textContent).toBe("Sure, this stays between us.");
  });

  it("flags a vault entry the AI echoes back, given family mode and a matching vault", async () => {
    document.body.innerHTML = `<div id="response">You mentioned Maple Street earlier.</div>`;
    handle = attachFamilyResponseFlagging({
      root: document.body,
      responseContainerSelector: "#response",
      getContext: async () =>
        familyContext([{ id: "1", category: "pii.home_address", value: "Maple Street" }]),
    });

    await waitForScan();

    const mark = document.querySelector(".guardian-family-flag");
    expect(mark).not.toBeNull();
    expect(mark!.getAttribute("data-category")).toBe("vault.match");
    expect(mark!.textContent).toBe("Maple Street");
  });

  it("flags content in a response added after attaching, not just what was already there", async () => {
    document.body.innerHTML = `<div id="response"></div>`;
    handle = attachFamilyResponseFlagging({
      root: document.body,
      responseContainerSelector: "#response",
      getContext: async () => familyContext(),
    });
    await waitForScan();
    expect(document.querySelectorAll(".guardian-family-flag")).toHaveLength(0);

    document.querySelector("#response")!.textContent = "Our little secret, okay?";
    await waitForScan();

    expect(document.querySelectorAll(".guardian-family-flag")).toHaveLength(1);
  });

  it("never flags anything when getContext returns null (personal mode, or vault unavailable)", async () => {
    document.body.innerHTML = `<div id="response">this stays between us</div>`;
    handle = attachFamilyResponseFlagging({
      root: document.body,
      responseContainerSelector: "#response",
      getContext: async () => null,
    });

    await waitForScan();

    expect(document.querySelectorAll(".guardian-family-flag")).toHaveLength(0);
  });

  it("does not re-flag or duplicate an already-flagged phrase on a later, unrelated mutation", async () => {
    document.body.innerHTML = `<div id="response">this stays between us</div>`;
    handle = attachFamilyResponseFlagging({
      root: document.body,
      responseContainerSelector: "#response",
      getContext: async () => familyContext(),
    });
    await waitForScan();
    expect(document.querySelectorAll(".guardian-family-flag")).toHaveLength(1);

    // An unrelated later mutation (e.g. more of the response streaming in) re-triggers a scan.
    document.querySelector("#response")!.append(" More text.");
    await waitForScan();

    expect(document.querySelectorAll(".guardian-family-flag")).toHaveLength(1);
  });

  it("stops flagging once destroyed", async () => {
    document.body.innerHTML = `<div id="response"></div>`;
    const localHandle = attachFamilyResponseFlagging({
      root: document.body,
      responseContainerSelector: "#response",
      getContext: async () => familyContext(),
    });
    localHandle.destroy();

    document.querySelector("#response")!.textContent = "this stays between us";
    await waitForScan();

    expect(document.querySelectorAll(".guardian-family-flag")).toHaveLength(0);
  });

  it("only flags inside the response container, never elsewhere on the page", async () => {
    document.body.innerHTML = `
      <div id="elsewhere">this stays between us</div>
      <div id="response">nothing concerning here</div>
    `;
    handle = attachFamilyResponseFlagging({
      root: document.body,
      responseContainerSelector: "#response",
      getContext: async () => familyContext(),
    });

    await waitForScan();

    expect(document.querySelectorAll(".guardian-family-flag")).toHaveLength(0);
  });
});
