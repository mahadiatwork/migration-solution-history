import {
  CONTACT_HISTORY_CORE_SELECT,
  CONTACT_HISTORY_SELECT,
  getCoqlOwnerName,
  mergeHistoryListRecord,
  requireSuccessfulCoqlPage,
} from "./contactHistoryList";

describe("Contact History list query", () => {
  test("uses only the stable junction fields", () => {
    expect(CONTACT_HISTORY_CORE_SELECT).toContain("Contact_History_Info.id");
    expect(CONTACT_HISTORY_SELECT).not.toContain("Contact_History_Info.Matter");
    expect(CONTACT_HISTORY_SELECT).not.toContain("Contact_History_Info.Current_Stage");
  });

  test("does not turn a COQL error into an empty history", () => {
    expect(() =>
      requireSuccessfulCoqlPage({
        data: [],
        errorCode: "INVALID_QUERY",
        errorMessage: "invalid column",
      })
    ).toThrow("INVALID_QUERY invalid column");
  });

  test("normalizes the owner returned by the junction query", () => {
    expect(
      getCoqlOwnerName({
        "Owner.first_name": "Maddie",
        "Owner.last_name": "Developer",
      })
    ).toBe("Maddie Developer");
  });

  test("prefers the History1 owner over the junction owner", () => {
    expect(
      getCoqlOwnerName({
        "Contact_History_Info.Owner.first_name": "Selected",
        "Contact_History_Info.Owner.last_name": "Owner",
        "Owner.first_name": "Junction",
        "Owner.last_name": "Creator",
      })
    ).toBe("Selected Owner");
  });

  test("preserves hydrated Matter fields across a sparse list refresh", () => {
    const existing = {
      id: "junction-1",
      matterNo: "MAT-1001",
      currentStage: "2. Strategy & Eligibility",
      matterProgress: "Consultation confirmed",
      billingType: "Billable",
    };
    const incoming = {
      id: "junction-1",
      details: "Updated by the background list refresh",
    };

    expect(mergeHistoryListRecord(existing, incoming)).toEqual({
      ...existing,
      ...incoming,
    });
  });

  test("allows an explicit snapshot clear to replace cached values", () => {
    expect(
      mergeHistoryListRecord(
        { id: "junction-1", currentStage: "Open", matterProgress: "Review" },
        { id: "junction-1", currentStage: "", matterProgress: "" }
      )
    ).toEqual({
      id: "junction-1",
      currentStage: "",
      matterProgress: "",
    });
  });
});
