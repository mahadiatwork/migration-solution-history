import {
  buildMatterSnapshotFields,
  selectPrimaryMatter,
} from "./matterSnapshot";

describe("contact Matter snapshot", () => {
  test("selects the most recently modified related Matter", () => {
    const older = {
      id: "older",
      Modified_Time: "2026-09-20T10:00:00+10:00",
    };
    const newer = {
      id: "newer",
      Modified_Time: "2026-09-22T10:00:00+10:00",
    };

    expect(selectPrimaryMatter([older, newer])).toBe(newer);
  });

  test("builds History1-only Matter snapshot fields", () => {
    expect(
      buildMatterSnapshotFields({
        id: "matter-1",
        Name: "MAT-1001",
        Current_Stage: "Open",
        Matter_Progress: ["Collecting"],
      })
    ).toEqual({
      Matter: { id: "matter-1" },
      Matter_No: "MAT-1001",
      Current_Stage: "Open",
      Matter_Progress: "Collecting",
    });
  });
});
