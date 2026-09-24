import type { RestoreMap } from "./types.js";

/**
 * Replaces every placeholder in `text` with the original value it stands for, per
 * `restoreMap`. The inverse of mask(). Not implemented yet — see docs/phase-1-plan.md, PR 10.
 */
export function restore(_text: string, _restoreMap: RestoreMap): string {
  throw new Error("restore() is not implemented yet (see docs/phase-1-plan.md, PR 10)");
}
