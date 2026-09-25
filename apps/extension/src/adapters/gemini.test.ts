import { describe, expect, it } from "vitest";
import { geminiAdapter } from "./gemini.js";

// Trimmed from a real, saved Gemini snapshot, keeping only the attributes gemini.ts's selectors
// actually key on - not the surrounding Angular/Material scaffolding.
const COMPOSER_HTML = `
  <rich-textarea>
    <div contenteditable="true" role="textbox" aria-label="Enter a prompt for Gemini" data-placeholder="Ask Gemini" class="ql-editor">
      <p>Ok</p>
    </div>
  </rich-textarea>
  <button aria-label="Send message"></button>
`;

const CONVERSATION_HTML = `
  <user-query-content>
    <div class="query-content">What time is it</div>
  </user-query-content>
  <model-response-content>
    <message-content>
      <p>It is 5:45 AM (EDT) on Friday, September 25, 2026.</p>
    </message-content>
  </model-response-content>
`;

describe("geminiAdapter.findComposeBox", () => {
  it("finds the compose box by role and accessible label", () => {
    document.body.innerHTML = COMPOSER_HTML;
    const composeBox = geminiAdapter.findComposeBox(document);
    expect(composeBox).not.toBeNull();
    expect(composeBox!.getAttribute("aria-label")).toBe("Enter a prompt for Gemini");
  });

  it("returns null when the page has no Gemini compose box", () => {
    document.body.innerHTML = "<textarea></textarea>";
    expect(geminiAdapter.findComposeBox(document)).toBeNull();
  });
});

describe("geminiAdapter.findSendButton", () => {
  it("finds the Send button", () => {
    document.body.innerHTML = COMPOSER_HTML;
    const composeBox = geminiAdapter.findComposeBox(document)!;
    const sendButton = geminiAdapter.findSendButton(composeBox);
    expect(sendButton).not.toBeNull();
    expect(sendButton!.getAttribute("aria-label")).toBe("Send message");
  });
});

describe("geminiAdapter.findResponseContainers", () => {
  it("finds only Gemini's own reply, never the person's own sent message", () => {
    document.body.innerHTML = CONVERSATION_HTML;
    const containers = geminiAdapter.findResponseContainers(document);
    expect(containers).toHaveLength(1);
    expect(containers[0]!.textContent).toContain("5:45 AM");
    expect(containers[0]!.closest("user-query-content")).toBeNull();
  });

  it("returns an empty array when there's no conversation yet", () => {
    document.body.innerHTML = COMPOSER_HTML;
    expect(geminiAdapter.findResponseContainers(document)).toEqual([]);
  });
});

describe("geminiAdapter.capabilities", () => {
  it("declares response restore as supported, verified against the real snapshot above", () => {
    expect(geminiAdapter.capabilities.responseRestore).toBe(true);
  });
});
