import { afterEach, describe, expect, it } from "vitest";
import type { RestoreMap } from "@guardian/engine-ts";
import { attachResponseRestore, type ResponseRestoreHandle } from "./responseRestore.js";

let handle: ResponseRestoreHandle | undefined;

afterEach(() => {
  handle?.destroy();
  handle = undefined;
});

// MutationObserver callbacks fire as a microtask, not synchronously.
function flush(): Promise<void> {
  return Promise.resolve().then(() => Promise.resolve());
}

describe("attachResponseRestore", () => {
  it("restores a placeholder in a text node added after a response renders", async () => {
    document.body.innerHTML = `
      <textarea id="compose"></textarea>
      <div id="response"></div>
    `;
    const composeBox = document.querySelector("#compose")!;
    const response = document.querySelector("#response")!;
    const restoreMap: RestoreMap = new Map([["[EMAIL_1]", "jane@example.com"]]);
    handle = attachResponseRestore({
      root: document.body,
      composeBox,
      getRestoreMap: () => restoreMap,
    });

    response.textContent = "Sure, I'll email [EMAIL_1] about that.";
    await flush();

    expect(response.textContent).toBe("Sure, I'll email jane@example.com about that.");
  });

  it("restores text appended character-by-character (a streamed/typing response)", async () => {
    document.body.innerHTML = `
      <textarea id="compose"></textarea>
      <div id="response"></div>
    `;
    const composeBox = document.querySelector("#compose")!;
    const response = document.querySelector("#response")!;
    const restoreMap: RestoreMap = new Map([["[EMAIL_1]", "jane@example.com"]]);
    handle = attachResponseRestore({
      root: document.body,
      composeBox,
      getRestoreMap: () => restoreMap,
    });

    const textNode = document.createTextNode("email ");
    response.appendChild(textNode);
    await flush();
    textNode.data += "[EMAIL_1]";
    await flush();

    expect(response.textContent).toBe("email jane@example.com");
  });

  it("leaves a placeholder with no matching key untouched", async () => {
    document.body.innerHTML = `
      <textarea id="compose"></textarea>
      <div id="response"></div>
    `;
    const composeBox = document.querySelector("#compose")!;
    const response = document.querySelector("#response")!;
    handle = attachResponseRestore({
      root: document.body,
      composeBox,
      getRestoreMap: () => new Map(),
    });

    response.textContent = "as mentioned, [EMAIL_1]";
    await flush();

    expect(response.textContent).toBe("as mentioned, [EMAIL_1]");
  });

  it("never restores inside the compose box itself", async () => {
    document.body.innerHTML = `
      <div id="compose" contenteditable="true"></div>
      <div id="response"></div>
    `;
    const composeBox = document.querySelector("#compose")!;
    const restoreMap: RestoreMap = new Map([["[EMAIL_1]", "jane@example.com"]]);
    handle = attachResponseRestore({
      root: document.body,
      composeBox,
      getRestoreMap: () => restoreMap,
    });

    // The person types a literal "[EMAIL_1]"-looking string before it's ever been masked - it
    // must not be silently rewritten to a real value they never asked to reveal.
    composeBox.textContent = "please mask [EMAIL_1] for me";
    await flush();

    expect(composeBox.textContent).toBe("please mask [EMAIL_1] for me");
  });

  it("never restores inside Guardian's own UI (e.g. the interception panel's masked preview)", async () => {
    document.body.innerHTML = `<textarea id="compose"></textarea>`;
    const composeBox = document.querySelector("#compose")!;
    const restoreMap: RestoreMap = new Map([["[EMAIL_1]", "jane@example.com"]]);
    handle = attachResponseRestore({
      root: document.body,
      composeBox,
      getRestoreMap: () => restoreMap,
    });

    const preview = document.createElement("pre");
    preview.className = "guardian-interception-preview";
    preview.textContent = "email [EMAIL_1]";
    document.body.appendChild(preview);
    await flush();

    expect(preview.textContent).toBe("email [EMAIL_1]");
  });

  it("stops restoring once destroyed", async () => {
    document.body.innerHTML = `
      <textarea id="compose"></textarea>
      <div id="response"></div>
    `;
    const composeBox = document.querySelector("#compose")!;
    const response = document.querySelector("#response")!;
    const restoreMap: RestoreMap = new Map([["[EMAIL_1]", "jane@example.com"]]);
    const localHandle = attachResponseRestore({
      root: document.body,
      composeBox,
      getRestoreMap: () => restoreMap,
    });
    localHandle.destroy();

    response.textContent = "email [EMAIL_1]";
    await flush();

    expect(response.textContent).toBe("email [EMAIL_1]");
  });

  it("reads the restore map fresh on each mutation, picking up entries added after attaching", async () => {
    document.body.innerHTML = `
      <textarea id="compose"></textarea>
      <div id="response"></div>
    `;
    const composeBox = document.querySelector("#compose")!;
    const response = document.querySelector("#response")!;
    const restoreMap: RestoreMap = new Map();
    handle = attachResponseRestore({
      root: document.body,
      composeBox,
      getRestoreMap: () => restoreMap,
    });

    // Simulates a second masked send happening after this attaches, growing the same map.
    restoreMap.set("[EMAIL_1]", "jane@example.com");
    response.textContent = "email [EMAIL_1]";
    await flush();

    expect(response.textContent).toBe("email jane@example.com");
  });
});
