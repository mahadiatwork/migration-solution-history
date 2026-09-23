import {
  buildViewOwner,
  DEFAULT_ACTIVITY_TYPE,
  DEFAULT_CATEGORY,
  durationOptions,
  mandatoryActivityTypes,
  mandatoryCategoryOptions,
  mergeCategoryOptions,
  mergeDurationOptions,
  serializeDuration,
} from "./dialogConstants";
import { getResultOptions } from "./helperFunc";

describe("matter history required options", () => {
  test("preserves the selected owner name for the immediate UI update", () => {
    expect(
      buildViewOwner({
        id: "owner-1",
        first_name: "Maddie",
        last_name: "Developer",
      })
    ).toEqual({ id: "owner-1", full_name: "Maddie Developer" });
  });

  test("keeps the five required categories first and removes duplicates", () => {
    expect(
      mergeCategoryOptions(["Legacy", "Other", "Communication & Meetings"])
    ).toEqual([
      ...mandatoryCategoryOptions,
      "Legacy",
      "Meeting",
      "To-Do",
      "Appointment",
      "Boardroom",
      "Call Billing",
      "Email Billing",
      "Initial Consultation",
      "Call",
      "Mail",
      "Meeting Billing",
      "Personal Activity",
      "Room 1",
      "Room 2",
      "Room 3",
      "To Do Billing",
      "Vacation",
    ]);
  });

  test("uses CRM Category to Activity Type dependencies before fallback", () => {
    const conflictingConfig = {
      results: { [DEFAULT_CATEGORY]: ["Configured override"] },
    };

    expect(getResultOptions(DEFAULT_CATEGORY, conflictingConfig)).toEqual(
      ["Configured override"]
    );
    expect(DEFAULT_ACTIVITY_TYPE).toBe(
      mandatoryActivityTypes[DEFAULT_CATEGORY][0]
    );
  });

  test("retains a historical Activity Type as an edit-only fallback", () => {
    expect(
      getResultOptions(
        "Other",
        { results: { Other: ["Training", "Business Development"] } },
        "Attachment"
      )
    ).toEqual([
      "Training",
      "Business Development",
      "Attachment",
    ]);
  });

  test("does not resurrect deactivated Results after CRM loads", () => {
    expect(
      getResultOptions(
        DEFAULT_CATEGORY,
        { _source: "custom_module", results: {} }
      )
    ).toEqual([]);
  });

  test("retains a historical legacy Result when CRM is unavailable", () => {
    expect(getResultOptions("Meeting", null, "Configured historical result"))
      .toEqual([
        "Meeting Held",
        "Meeting Not Held",
        "Configured historical result",
      ]);
  });

  test("always supplies 0 through 240 in five-minute order", () => {
    expect(durationOptions).toHaveLength(49);
    expect(durationOptions[0]).toBe(0);
    expect(durationOptions[48]).toBe(240);
    expect(mergeDurationOptions([60, "0", 300])).toEqual([
      ...durationOptions,
      300,
    ]);
    expect(serializeDuration(0)).toBe("0");
    expect(serializeDuration("0")).toBe("0");
    expect(serializeDuration(null)).toBeNull();
  });
});
