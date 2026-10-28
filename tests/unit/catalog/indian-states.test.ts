import { describe, expect, test } from "vitest";

import {
  INDIAN_STATES,
  isStateSlug,
  stateName,
} from "~/modules/catalog/domain/indian-states";

describe("Indian states", () => {
  test("36 states and union territories with unique slugs", () => {
    expect(INDIAN_STATES).toHaveLength(36);
    expect(new Set(INDIAN_STATES.map((state) => state.slug)).size).toBe(36);
    expect(isStateSlug("goa")).toBe(true);
    expect(isStateSlug("atlantis")).toBe(false);
    expect(stateName("jammu-and-kashmir")).toBe("Jammu and Kashmir");
  });

  test("listed alphabetically by name with hyphenated slugs", () => {
    const names = INDIAN_STATES.map((state) => state.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    for (const { slug } of INDIAN_STATES) {
      expect(slug).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    }
    expect(isStateSlug("dadra-and-nagar-haveli-and-daman-and-diu")).toBe(true);
  });
});
