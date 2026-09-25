import type { RestoreMap } from "./types.js";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replaces every placeholder in `text` with the original value it stands for, per
 * `restoreMap`. The inverse of mask().
 *
 * Does every replacement in a single regex pass over `text`, rather than one `replaceAll` call
 * per key. Doing it key-by-key would risk a cascade: if one placeholder's original value
 * happens to contain another placeholder's literal text (unlikely but not impossible), an
 * already-restored value could be re-matched and corrupted by a later replacement. A single
 * pass can't do that, since each character of `text` is only ever matched once.
 */
export function restore(text: string, restoreMap: RestoreMap): string {
  if (restoreMap.size === 0) {
    return text;
  }

  const pattern = new RegExp([...restoreMap.keys()].map(escapeRegExp).join("|"), "g");
  return text.replace(pattern, (matched) => restoreMap.get(matched) ?? matched);
}
