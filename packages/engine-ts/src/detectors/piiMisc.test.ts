import { describe, expect, it } from "vitest";
import { detectPiiMisc } from "./piiMisc.js";

describe("detectPiiMisc", () => {
  it("finds a home address", () => {
    const findings = detectPiiMisc("we live at 42 Maple Street");
    expect(findings).toEqual([
      {
        category: "pii.home_address",
        start: 11,
        end: 26,
        confidence: 0.7,
        tier: 1,
        suggestedPlaceholder: "ADDRESS",
      },
    ]);
  });

  it("finds a date of birth only after a birth-context keyword", () => {
    expect(detectPiiMisc("I was born on 3/15/2012 in the city.")).toHaveLength(1);
    expect(
      detectPiiMisc("The meeting is on 3/15/2024, nothing to do with anyone's birthday."),
    ).toEqual([]);
  });

  it("finds a government ID with an explicit label", () => {
    expect(detectPiiMisc("My passport number is A1234567 for the trip.")).toHaveLength(1);
    expect(detectPiiMisc("Please bring a photo ID to the front desk.")).toEqual([]);
  });

  it("finds a bank account number with an explicit label", () => {
    expect(detectPiiMisc("My account number is 123456789012 for the transfer.")).toHaveLength(1);
  });

  it("finds a medical mention via a diagnosis/allergy/medication keyword", () => {
    expect(detectPiiMisc("She has been diagnosed with asthma.")).toHaveLength(1);
    expect(detectPiiMisc("The doctor's office is closed on weekends.")).toEqual([]);
  });
});
