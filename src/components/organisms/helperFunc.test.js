import { getRegardingOptions, getResultOptions } from "./helperFunc";

describe("authoritative Widget_Picklist_Config helpers", () => {
  const config = {
    _source: "custom_module",
    results: {
      Meeting: ["Configured result"],
    },
    regarding: {
      Meeting: ["Configured regarding"],
    },
  };

  test("uses only configured parent options for new records", () => {
    expect(getResultOptions("Meeting", config)).toEqual(["Configured result"]);
    expect(getRegardingOptions("Meeting", "", config)).toEqual([
      "Configured regarding",
    ]);
  });

  test("does not fall back when a configured parent is empty", () => {
    expect(getResultOptions("Call", config)).toEqual([]);
    expect(getRegardingOptions("Call", "", config)).toEqual([]);
  });

  test("an explicit empty parent does not use configured _default options", () => {
    const scopedConfig = {
      _source: "custom_module",
      results: { Meeting: [], _default: ["Default result"] },
      regarding: { Meeting: [], _default: ["Default regarding"] },
    };

    expect(getResultOptions("Meeting", scopedConfig)).toEqual([]);
    expect(getRegardingOptions("Meeting", "", scopedConfig)).toEqual([]);
  });

  test("keeps only an existing edit value when it is no longer configured", () => {
    expect(getResultOptions("Call", config, "Legacy result")).toEqual([
      "Legacy result",
    ]);
    expect(getRegardingOptions("Call", "Legacy regarding", config)).toEqual([
      "Legacy regarding",
    ]);
  });
});
