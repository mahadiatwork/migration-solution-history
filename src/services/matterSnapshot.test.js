import {
  buildMatterSnapshotFields,
  findRelatedMatter,
  normalizeSingleMultiSelectValue,
  resolveMatterContextForContact,
  serializeMultiSelectPicklist,
  selectPrimaryMatter,
} from "./matterSnapshot";

describe("contact Matter snapshot", () => {
  test("matches an edit Matter by ID before considering its saved number", () => {
    const first = { id: "matter-1", Name: "MAT-1" };
    const second = { id: "matter-2", Name: "MAT-2" };

    expect(
      findRelatedMatter([first, second], {
        matterId: "matter-2",
        matterNo: "MAT-1",
      })
    ).toBe(second);
    expect(
      findRelatedMatter([first], {
        matterId: "missing",
        matterNo: "MAT-1",
      })
    ).toBeNull();
  });

  test("matches a legacy Matter No only when it is unique", () => {
    const unique = { id: "matter-1", Name: "Testing" };
    expect(findRelatedMatter([unique], { matterNo: "Testing" })).toBe(unique);
    expect(
      findRelatedMatter(
        [unique, { id: "matter-2", Name: "Testing" }],
        { matterNo: "Testing" }
      )
    ).toBeNull();
    expect(findRelatedMatter([unique], {})).toBeNull();
  });

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
      Matter_Progress: ["Collecting"],
    });
  });

  test("serializes a selected Matter Progress as a Zoho multi-select value", () => {
    expect(serializeMultiSelectPicklist("Collecting")).toEqual(["Collecting"]);
    expect(
      serializeMultiSelectPicklist(["Collecting", "", "Collecting"])
    ).toEqual(["Collecting"]);
    expect(serializeMultiSelectPicklist("")).toBeNull();
  });

  test("round-trips one valid option when a record contains multiple progress values", () => {
    const selectedValue = normalizeSingleMultiSelectValue(["Collecting", "Review"]);

    expect(selectedValue).toBe("Collecting");
    expect(serializeMultiSelectPicklist(selectedValue)).toEqual(["Collecting"]);
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
        Matter_Progress: ["Awaiting decision"],
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
