import {
  buildMatterSnapshotFields,
  resolveMatterContextForContact,
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
      Matter_No: "MAT-1001",
      Current_Stage: "Open",
      Matter_Progress: "Collecting",
    });
  });

  test("hydrates a sparse related Matter before building the snapshot", async () => {
    const getRelatedRecords = jest.fn().mockResolvedValue({
      data: [
        {
          id: "matter-1",
          Name: "MAT-1001",
          Modified_Time: "2026-09-23T10:00:00+10:00",
        },
      ],
    });
    const getRecord = jest.fn().mockResolvedValue({
      data: [
        {
          id: "matter-1",
          Name: "MAT-1001",
          Current_Stage: "7. Decision",
          Matter_Progress: ["Awaiting decision"],
          $layout_id: { id: "layout-1" },
        },
      ],
    });
    window.ZOHO = { CRM: { API: { getRelatedRecords, getRecord } } };

    await expect(resolveMatterContextForContact("contact-1")).resolves.toEqual({
      matter: expect.objectContaining({
        id: "matter-1",
        $layout_id: { id: "layout-1" },
      }),
      snapshot: {
        Matter_No: "MAT-1001",
        Current_Stage: "7. Decision",
        Matter_Progress: "Awaiting decision",
      },
    });

    expect(getRelatedRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        Entity: "Contacts",
        RelatedList: "Applications",
        fields: "id,Name,Modified_Time,Created_Time",
      })
    );
    expect(getRecord).toHaveBeenCalledWith(
      expect.objectContaining({ Entity: "Applications", RecordID: "matter-1" })
    );
  });
});
