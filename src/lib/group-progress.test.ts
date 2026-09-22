import { describe, expect, it } from "vitest";
import {
  flattenOrderedUnits,
  groupProgressSummary,
  mergeUnitProgress,
  nextUnitToUnlock,
  studentVisibleUnits,
} from "./group-progress";

const courses = [
  {
    title: "A1 Start",
    status: "published",
    level: { code: "A1" },
    modules: [
      {
        title: "Mod 1",
        sort_order: 1,
        status: "published",
        units: [
          { id: "u1", title: "Chapitre 1", sort_order: 1, status: "published" },
          { id: "u2", title: "Chapitre 2", sort_order: 2, status: "published" },
          { id: "u3", title: "Chapitre 3", sort_order: 3, status: "published" },
        ],
      },
    ],
  },
];

describe("group-progress", () => {
  it("orders units and unlocks the first by default", () => {
    const ordered = flattenOrderedUnits(courses, "A1");
    expect(ordered.map((u) => u.unitId)).toEqual(["u1", "u2", "u3"]);
    const views = mergeUnitProgress(ordered, []);
    expect(views[0]?.status).toBe("unlocked");
    expect(views[1]?.status).toBe("locked");
    expect(studentVisibleUnits(views)).toHaveLength(1);
  });

  it("unlocks the next chapter after completion", () => {
    const ordered = flattenOrderedUnits(courses, "A1");
    const views = mergeUnitProgress(ordered, [
      { unit_id: "u1", status: "completed", completed_at: "2026-01-01" },
      { unit_id: "u2", status: "unlocked" },
    ]);
    expect(nextUnitToUnlock(views, "u2")).toBe("u3");
    expect(groupProgressSummary(views).completed).toBe(1);
  });
});
