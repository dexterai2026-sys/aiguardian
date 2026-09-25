/**
 * A permanent, always-visible "protection active" indicator (PR 12), inserted right after the
 * compose box the same way the review panels are (see interceptionPanel.ts) - in normal document
 * flow, not a floating overlay, per CLAUDE.md's "visible, never covert" principle: the person
 * should never have to wonder whether Guardian is doing anything on a given AI site. Unlike the
 * review panels, this is never removed by anything other than the page unloading - it isn't a
 * response to an event, just a constant presence.
 *
 * Styled inline, not via its class name alone - see interceptionPanel.ts's file docs for why: a
 * class name with no backing stylesheet renders using whatever browser defaults happen to survive
 * the host site's own CSS reset, which on a real AI site (unlike this repo's plain fixture pages)
 * can strip it down to nothing worth noticing.
 */
export interface ProtectionBadge {
  element: HTMLElement;
  destroy(): void;
}

const BADGE_STYLE: Partial<CSSStyleDeclaration> = {
  display: "block",
  boxSizing: "border-box",
  margin: "6px 0",
  padding: "4px 10px",
  background: "#eef6ec",
  border: "1px solid #a7d7a0",
  borderRadius: "6px",
  color: "#2e5c2a",
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: "12px",
  fontWeight: "500",
  lineHeight: "1.4",
};

export function createProtectionBadge(composeBox: HTMLElement): ProtectionBadge {
  const ownerDocument = composeBox.ownerDocument;
  const badge = ownerDocument.createElement("div");
  badge.className = "guardian-protection-badge";
  badge.textContent = "Guardian — protection active";
  Object.assign(badge.style, BADGE_STYLE);
  composeBox.insertAdjacentElement("afterend", badge);

  return {
    element: badge,
    destroy(): void {
      badge.remove();
    },
  };
}
