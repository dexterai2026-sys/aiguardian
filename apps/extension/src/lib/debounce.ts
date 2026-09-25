/**
 * Debounces `fn`: only the last call within `waitMs` of the previous one actually runs.
 * CLAUDE.md: detection "must never make typing feel slow" - running detect() on every keystroke
 * would; this delays it until the person pauses.
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
): (...args: Args) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return (...args: Args) => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = undefined;
      fn(...args);
    }, waitMs);
  };
}
