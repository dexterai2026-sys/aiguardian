/**
 * Review panels shown when a send or file upload is intercepted (see sendInterceptor.ts and
 * fileUploadInterceptor.ts). Inserted in normal document flow immediately after the intercepted
 * element - not a floating/absolutely-positioned overlay like highlightOverlay.ts - both because
 * it's simpler and more robust (no positioning math to get wrong), and because CLAUDE.md's
 * "visible, never covert" principle is best served by something that visibly pushes the page's
 * own layout, not a subtle floating box easy to miss.
 *
 * Every element here gets real *inline* styles, not just a class name - found necessary via
 * real-world testing on live AI sites, not anticipated up front: a class name alone depends on
 * some stylesheet actually defining it, and this extension never shipped one. That went unnoticed
 * against this repo's plain fixture pages (no CSS reset, so unstyled HTML still renders with
 * reasonable browser-default spacing), but a real site's own CSS reset (e.g. Tailwind's preflight,
 * which most modern chat UIs use in some form) strips exactly the default spacing/display an
 * unstyled `<button>`/`<p>`/`<pre>` relies on, collapsing the whole panel into run-together,
 * unreadable text - which is what ChatGPT and Gemini actually showed. Inline styles (set via
 * `element.style`, not a class) beat essentially any host-page stylesheet selector on
 * specificity, without needing a Shadow DOM boundary - the same reasoning `highlightOverlay.ts`
 * already relies on for its own inline-styled mirror element.
 */
export interface InterceptionPanel {
  element: HTMLElement;
  remove(): void;
}

interface PanelAction {
  label: string;
  className: string;
  /** Primary actions (the recommended, safe choice - e.g. "Send masked") are visually
   * emphasized; secondary actions (e.g. "Edit", "Send anyway") are neutral, not alarming - per
   * CLAUDE.md's "protect and teach, don't restrict" tone, choosing to send anyway isn't treated
   * as a mistake to be scared away from. */
  emphasis: "primary" | "secondary";
  onClick: () => void;
}

const PANEL_STYLE: Partial<CSSStyleDeclaration> = {
  display: "block",
  boxSizing: "border-box",
  margin: "8px 0",
  padding: "12px 16px",
  background: "#fff8e1",
  border: "1px solid #f0c419",
  borderRadius: "8px",
  color: "#1a1a1a",
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: "14px",
  lineHeight: "1.45",
};

const HEADING_STYLE: Partial<CSSStyleDeclaration> = {
  display: "block",
  margin: "0 0 8px 0",
  padding: "0",
  fontWeight: "600",
};

const BODY_STYLE: Partial<CSSStyleDeclaration> = {
  display: "block",
  margin: "0 0 12px 0",
  padding: "8px 10px",
  background: "rgba(0, 0, 0, 0.05)",
  border: "1px solid rgba(0, 0, 0, 0.1)",
  borderRadius: "6px",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "13px",
  color: "#1a1a1a",
};

const ACTIONS_STYLE: Partial<CSSStyleDeclaration> = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  margin: "0",
  padding: "0",
};

const BUTTON_STYLE_BY_EMPHASIS: Record<PanelAction["emphasis"], Partial<CSSStyleDeclaration>> = {
  primary: {
    display: "inline-block",
    margin: "0",
    padding: "6px 14px",
    borderRadius: "6px",
    border: "1px solid #1d4ed8",
    background: "#2563eb",
    color: "#ffffff",
    fontFamily: "inherit",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  secondary: {
    display: "inline-block",
    margin: "0",
    padding: "6px 14px",
    borderRadius: "6px",
    border: "1px solid #b8b8b8",
    background: "#ffffff",
    color: "#1a1a1a",
    fontFamily: "inherit",
    fontSize: "13px",
    fontWeight: "400",
    cursor: "pointer",
  },
};

function createPanelShell(
  ownerDocument: Document,
  panelClassName: string,
  heading: string,
  bodyText: string,
  bodyClassName: string,
  actions: PanelAction[],
): InterceptionPanel {
  const panel = ownerDocument.createElement("div");
  panel.className = panelClassName;
  Object.assign(panel.style, PANEL_STYLE);

  const headingElement = ownerDocument.createElement("p");
  headingElement.textContent = heading;
  Object.assign(headingElement.style, HEADING_STYLE);
  panel.appendChild(headingElement);

  const body = ownerDocument.createElement("pre");
  body.className = bodyClassName;
  body.textContent = bodyText;
  Object.assign(body.style, BODY_STYLE);
  panel.appendChild(body);

  const actionsElement = ownerDocument.createElement("div");
  actionsElement.className = "guardian-interception-actions";
  Object.assign(actionsElement.style, ACTIONS_STYLE);
  panel.appendChild(actionsElement);

  for (const action of actions) {
    const button = ownerDocument.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.className = action.className;
    Object.assign(button.style, BUTTON_STYLE_BY_EMPHASIS[action.emphasis]);
    button.addEventListener("click", action.onClick);
    actionsElement.appendChild(button);
  }

  return {
    element: panel,
    remove(): void {
      panel.remove();
    },
  };
}

export interface InterceptionPanelCallbacks {
  onSendMasked(): void;
  onEdit(): void;
  onSendAnyway(): void;
}

/** The text-send review panel: masked preview, plus mask/edit/send-anyway (PR 5). */
export function createInterceptionPanel(
  ownerDocument: Document,
  maskedPreview: string,
  callbacks: InterceptionPanelCallbacks,
): InterceptionPanel {
  return createPanelShell(
    ownerDocument,
    "guardian-interception-panel",
    "Guardian found personal info or a security risk in this message. Here's what it would look like masked:",
    maskedPreview,
    "guardian-interception-preview",
    [
      {
        label: "Send masked",
        className: "guardian-btn-send-masked",
        emphasis: "primary",
        onClick: callbacks.onSendMasked,
      },
      {
        label: "Edit",
        className: "guardian-btn-edit",
        emphasis: "secondary",
        onClick: callbacks.onEdit,
      },
      {
        label: "Send anyway",
        className: "guardian-btn-send-anyway",
        emphasis: "secondary",
        onClick: callbacks.onSendAnyway,
      },
    ],
  );
}

export interface FileWarningPanelCallbacks {
  onCancelUpload(): void;
  onUploadAnyway(): void;
}

/**
 * The file-upload review panel (PR 6): unlike a text message, an opaque file's content can't be
 * masked in place, so the only real choices are to cancel the upload or proceed with it
 * unchanged - a plain two-action panel, not a relabeled copy of the text one.
 */
export function createFileWarningPanel(
  ownerDocument: Document,
  summary: string,
  callbacks: FileWarningPanelCallbacks,
): InterceptionPanel {
  return createPanelShell(
    ownerDocument,
    "guardian-file-warning-panel",
    "Guardian found personal info or a security risk in a file you're about to upload:",
    summary,
    "guardian-file-warning-summary",
    [
      {
        label: "Cancel upload",
        className: "guardian-btn-cancel-upload",
        emphasis: "primary",
        onClick: callbacks.onCancelUpload,
      },
      {
        label: "Upload anyway",
        className: "guardian-btn-upload-anyway",
        emphasis: "secondary",
        onClick: callbacks.onUploadAnyway,
      },
    ],
  );
}

export interface HiddenTextWarningCallbacks {
  onDismiss(): void;
}

/**
 * The hidden-injection copy warning (PR 11): unlike the send/file cases, there's nothing to mask,
 * cancel, or retry - the copy already happened (CLAUDE.md: never silently strip or block, the
 * person decides what to do with the warning), so this is purely informational, with the hidden
 * text shown so the person can judge for themselves rather than just being told to trust Guardian.
 */
export function createHiddenTextWarningPanel(
  ownerDocument: Document,
  hiddenTextSummary: string,
  callbacks: HiddenTextWarningCallbacks,
): InterceptionPanel {
  return createPanelShell(
    ownerDocument,
    "guardian-hidden-text-warning",
    "Guardian found text hidden from view in what you just copied. It wasn't visible on the page, but it will be included if you paste - possibly instructions meant to manipulate an AI, not for you to read:",
    hiddenTextSummary,
    "guardian-hidden-text-summary",
    [
      {
        label: "Dismiss",
        className: "guardian-btn-dismiss",
        emphasis: "primary",
        onClick: callbacks.onDismiss,
      },
    ],
  );
}
