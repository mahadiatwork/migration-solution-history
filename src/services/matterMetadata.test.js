import {
  extractMatterDependencyMetadata,
  extractMatterLayoutMetadata,
  getProgressOptions,
  getInvokeError,
  getStageOptions,
  mergeMatterMetadata,
} from "./matterMetadata";

const layoutResponse = {
  layouts: [
    {
      id: "layout-1",
      sections: [
        {
          fields: [
            {
              api_name: "Current_Stage",
              pick_list_values: [
                {
                  actual_value: "Open",
                  type: "used",
                  maps: [
                    { actual_value: "Collecting", type: "used" },
                    { actual_value: "Hidden mapped value", type: "unused" },
                  ],
                },
                { actual_value: "Closed", type: "used", maps: [] },
                { actual_value: "Unused stage", type: "unused", maps: [] },
              ],
            },
            {
              api_name: "Matter_Progress",
              pick_list_values: [
                { actual_value: "Collecting", type: "used" },
                { actual_value: "Lodged", type: "used" },
                { actual_value: "Unused progress", type: "unused" },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("Applications matter metadata", () => {
  test("surfaces connection errors instead of treating them as no dependency", () => {
    expect(
      getInvokeError({
        details: {
          statusMessage: JSON.stringify({
            code: "OAUTH_SCOPE_MISMATCH",
            message: "invalid oauth scope",
            status: "error",
          }),
        },
      })
    ).toEqual({
      code: "OAUTH_SCOPE_MISMATCH",
      message: "invalid oauth scope",
    });
  });

  test("extracts active layout options and embedded dependencies", () => {
    const metadata = extractMatterLayoutMetadata(layoutResponse);

    expect(metadata.layoutId).toBe("layout-1");
    expect(metadata.stages).toEqual(["Open", "Closed"]);
    expect(metadata.progress).toEqual(["Collecting", "Lodged"]);
    expect(metadata.progressByStage).toEqual({
      Open: ["Collecting"],
      Closed: [],
    });
  });

  test("does not treat all-empty layout maps as a dependency", () => {
    const response = JSON.parse(JSON.stringify(layoutResponse));
    response.layouts[0].sections[0].fields[0].pick_list_values[0].maps = [];

    expect(extractMatterLayoutMetadata(response).progressByStage).toEqual({});
  });

  test("parses v8 dependency details and excludes unused values", () => {
    const response = {
      details: {
        statusMessage: JSON.stringify({
          map_dependency: [
            {
              active: true,
              parent: { api_name: "Current_Stage" },
              child: { api_name: "Matter_Progress" },
              pick_list_values: [
                {
                  actual_value: "Open",
                  type: "used",
                  maps: [
                    { actual_value: "Collecting", type: "used" },
                    { actual_value: "Old", type: "unused" },
                  ],
                },
              ],
            },
          ],
        }),
      },
    };

    expect(extractMatterDependencyMetadata(response)).toEqual({
      stages: ["Open"],
      progress: ["Collecting"],
      progressByStage: { Open: ["Collecting"] },
    });
  });

  test("restricts mapped stages and only preserves stored values without a map", () => {
    const layout = extractMatterLayoutMetadata(layoutResponse);
    const metadata = mergeMatterMetadata(layout, {
      stages: ["Open"],
      progress: ["Collecting"],
      progressByStage: { Open: ["Collecting"] },
    });

    expect(getStageOptions(metadata, "Historic stage")).toEqual([
      "Open",
      "Closed",
      "Historic stage",
    ]);
    expect(getProgressOptions(metadata, "Open", "Historic progress")).toEqual([
      "Collecting",
      "Historic progress",
    ]);
    expect(getProgressOptions(metadata, "Closed", "Historic progress")).toEqual([
      "Historic progress",
    ]);
    expect(getProgressOptions(metadata, "Closed")).toEqual([]);
    expect(getProgressOptions(metadata, "", "Historic progress")).toEqual([
      "Collecting",
      "Lodged",
      "Historic progress",
    ]);
  });
});
