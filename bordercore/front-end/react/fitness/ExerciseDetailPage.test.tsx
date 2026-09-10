import { describe, expect, it } from "vitest";
import { defaultLoggedValue } from "./ExerciseDetailPage";

describe("defaultLoggedValue", () => {
  it("uses the first set of the last workout", () => {
    expect(defaultLoggedValue([200, 205, 210, 220])).toBe("200");
  });

  it("falls back to 0 when there are no sets", () => {
    expect(defaultLoggedValue([])).toBe("0");
  });

  it("falls back to 0 when the first set has no value", () => {
    expect(defaultLoggedValue([null as unknown as number, 8])).toBe("0");
  });
});
