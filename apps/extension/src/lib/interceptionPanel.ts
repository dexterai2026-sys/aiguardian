/**
 * Review panels shown when a send or file upload is intercepted (see sendInterceptor.ts and
 * fileUploadInterceptor.ts). Inserted in normal document flow immediately after the intercepted
 * element - not a floating/absolutely-positioned overlay like highlightOverlay.ts - both because
 * it's simpler and more robust (no positioning math to get wrong), and because CLAUDE.md's
 * "visible, never covert" principle is best served by something that visibly pushes the page's
 * own layout, not a subtle floating box easy to miss.
 */
export interface InterceptionPanel {
  element: HTMLElement;
  remove(): void;
}

interface PanelAction {
  label: string;
  className: string;
  onClick: () => void;
}

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

  const headingElement = ownerDocument.createElement("p");
  headingElement.textContent = heading;
  panel.appendChild(headingElement);

  const body = ownerDocument.createElement("pre");
  body.className = bodyClassName;
  body.textContent = bodyText;
  panel.appendChild(body);

  const actionsElement = ownerDocument.createElement("div");
  actionsElement.className = "guardian-interception-actions";
  panel.appendChild(actionsElement);

  for (const action of actions) {
    const button = ownerDocument.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.className = action.className;
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
        onClick: callbacks.onSendMasked,
      },
      { label: "Edit", className: "guardian-btn-edit", onClick: callbacks.onEdit },
      {
        label: "Send anyway",
        className: "guardian-btn-send-anyway",
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
        onClick: callbacks.onCancelUpload,
      },
      {
        label: "Upload anyway",
        className: "guardian-btn-upload-anyway",
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
    [{ label: "Dismiss", className: "guardian-btn-dismiss", onClick: callbacks.onDismiss }],
  );
}
