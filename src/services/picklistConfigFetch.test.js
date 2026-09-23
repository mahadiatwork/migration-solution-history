describe("Widget_Picklist_Config fetch state", () => {
  const originalZoho = window.ZOHO;
  let warnSpy;

  beforeEach(() => {
    jest.resetModules();
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    window.ZOHO = originalZoho;
    warnSpy.mockRestore();
    jest.resetModules();
  });

  test("treats a reachable empty module as authoritative", async () => {
    const getAllRecords = jest.fn().mockResolvedValue({
      data: [],
      info: { more_records: false },
    });
    window.ZOHO = { CRM: { API: { getAllRecords } } };

    const { fetchPicklistConfig } = require("./picklistConfigService");
    const config = await fetchPicklistConfig();

    expect(getAllRecords).toHaveBeenCalledTimes(1);
    expect(config).toMatchObject({
      types: [],
      results: {},
      resultMapping: {},
      durations: [],
      _source: "custom_module",
    });
  });

  test("uses hard-coded fallback when the module cannot be reached", async () => {
    window.ZOHO = {
      CRM: {
        API: {
          getAllRecords: jest.fn().mockRejectedValue(new Error("unavailable")),
        },
      },
    };

    const { fetchPicklistConfig } = require("./picklistConfigService");
    const config = await fetchPicklistConfig();

    expect(config._source).toBe("fallback");
    expect(config.types.length).toBeGreaterThan(0);
    expect(config.durations.length).toBeGreaterThan(0);
  });

  test("retries the module alias after a nested SDK error envelope", async () => {
    const getAllRecords = jest.fn(({ Entity }) => {
      if (Entity === "Widget_Picklist_Config") {
        return Promise.resolve({
          data: [
            {
              code: "INVALID_MODULE",
              status: "error",
              message: "invalid module",
            },
          ],
        });
      }
      return Promise.resolve({ data: [], info: { more_records: false } });
    });
    window.ZOHO = { CRM: { API: { getAllRecords } } };

    const { fetchPicklistConfig } = require("./picklistConfigService");
    const config = await fetchPicklistConfig();

    expect(getAllRecords).toHaveBeenCalledTimes(2);
    expect(getAllRecords.mock.calls[1][0].Entity).toBe("CustomModule15");
    expect(config._source).toBe("custom_module");
    expect(config.types).toEqual([]);
  });
});
