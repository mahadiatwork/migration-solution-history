import {
  getDurationOptionsFromConfig,
  getResultMappingFromConfig,
  getResultOptionsFromConfig,
  getTypeOptionsFromConfig,
} from "./picklistConfigService";
import {
  durationOptions,
  mandatoryActivityTypes,
  resultMapping,
  typeOptions,
} from "../components/organisms/dialogConstants";

describe("Widget_Picklist_Config selectors", () => {
  const config = {
    types: ["Configured second", "Configured first"],
    results: {
      "Communication & Meetings": ["Configured activity", "Call"],
    },
    resultMapping: {
      "Communication & Meetings": "Configured activity",
    },
    durations: [15, 5],
  };

  test("preserves configured Type membership and Sort_Order", () => {
    expect(getTypeOptionsFromConfig(config)).toEqual([
      "Configured second",
      "Configured first",
    ]);
  });

  test("uses configured Results and configured default mapping", () => {
    expect(
      getResultOptionsFromConfig("Communication & Meetings", config)
    ).toEqual(["Configured activity", "Call"]);
    expect(getResultMappingFromConfig(config)).toEqual({
      "Communication & Meetings": "Configured activity",
    });
  });

  test("preserves configured Duration membership and Sort_Order", () => {
    expect(getDurationOptionsFromConfig(config)).toEqual([15, 5]);
  });

  test("uses hard-coded values only when CRM configuration is unavailable", () => {
    expect(getTypeOptionsFromConfig(null)).toEqual(typeOptions);
    expect(
      getResultOptionsFromConfig("Communication & Meetings", null)
    ).toEqual(mandatoryActivityTypes["Communication & Meetings"]);
    expect(getResultMappingFromConfig(null)).toEqual(resultMapping);
    expect(getDurationOptionsFromConfig(null)).toEqual(durationOptions);
  });

  test("honors intentionally empty groups from a successful CRM load", () => {
    const emptyConfig = {
      _source: "custom_module",
      types: [],
      results: {},
      resultMapping: {},
      durations: [],
    };

    expect(getTypeOptionsFromConfig(emptyConfig)).toEqual([]);
    expect(
      getResultOptionsFromConfig("Communication & Meetings", emptyConfig)
    ).toEqual([]);
    expect(getResultMappingFromConfig(emptyConfig)).toEqual({});
    expect(getDurationOptionsFromConfig(emptyConfig)).toEqual([]);
  });
});
