import { describe, expect, it } from "vitest";
import { findSendButton } from "./findSendButton.js";

describe("findSendButton", () => {
  it("returns null when there is no container button at all", () => {
    document.body.innerHTML = "<textarea></textarea>";
    const compose = document.querySelector("textarea")!;
    expect(findSendButton(compose)).toBeNull();
  });

  it("prefers a button whose aria-label mentions send", () => {
    document.body.innerHTML = `
      <div>
        <button>Cancel</button>
        <textarea id="compose"></textarea>
        <button aria-label="Send message">➤</button>
      </div>
    `;
    const compose = document.querySelector<HTMLElement>("#compose")!;
    expect(findSendButton(compose)?.getAttribute("aria-label")).toBe("Send message");
  });

  it("matches by visible text content when there is no aria-label", () => {
    document.body.innerHTML = `
      <div>
        <textarea id="compose"></textarea>
        <button>Send</button>
      </div>
    `;
    const compose = document.querySelector<HTMLElement>("#compose")!;
    expect(findSendButton(compose)?.textContent).toBe("Send");
  });

  it("falls back to a type=submit button when nothing matches by name", () => {
    document.body.innerHTML = `
      <form id="form">
        <textarea id="compose"></textarea>
        <button type="submit">Go</button>
      </form>
    `;
    const compose = document.querySelector<HTMLElement>("#compose")!;
    expect(findSendButton(compose)?.textContent).toBe("Go");
  });

  it("scopes the search to the nearest form, not the whole page", () => {
    document.body.innerHTML = `
      <button aria-label="Send message">Unrelated, outside the form</button>
      <form id="form">
        <textarea id="compose"></textarea>
        <button type="submit">Post</button>
      </form>
    `;
    const compose = document.querySelector<HTMLElement>("#compose")!;
    // The out-of-form button would win on name alone, but it's out of scope; the in-form
    // type=submit button is the correct match, via the fallback rule, not the name rule.
    expect(findSendButton(compose)?.textContent).toBe("Post");
  });
});
