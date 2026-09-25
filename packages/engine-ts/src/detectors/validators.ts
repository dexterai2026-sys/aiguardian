import type { ValidatorName } from "../rules/schema.js";

/** Luhn checksum, used to narrow payment-card pattern matches. `raw` may contain spaces/dashes. */
export function luhnCheck(raw: string): boolean {
  const digits = raw.replace(/[ -]/g, "");
  if (digits.length === 0 || !/^\d+$/.test(digits)) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/** Maps a rule's `validation` name (see /rules/README.md) to the function that applies it. */
export const VALIDATORS: Record<ValidatorName, (raw: string) => boolean> = {
  luhn: luhnCheck,
};
