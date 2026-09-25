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

  test("accepts History Type and History Result category aliases", async () => {
    window.ZOHO = {
      CRM: {
        API: {
          getAllRecords: jest.fn().mockResolvedValue({
            data: [
              {
                Name: "Configured type",
                Category: "History Type",
                Parent_Type: null,
                Sort_Order: 10,
                Active: true,
              },
              {
                Name: "Configured result",
                Category: "History Result",
                Parent_Type: "Configured type",
                Sort_Order: 20,
                Active: true,
              },
            ],
            info: { more_records: false },
          }),
        },
      },
    };

    const { fetchPicklistConfig } = require("./picklistConfigService");
    const config = await fetchPicklistConfig();

    expect(config.types).toEqual(["Configured type"]);
    expect(config.results).toEqual({
      "Configured type": ["Configured result"],
    });
  });

  test("does not cache partial SDK pagination after a later page fails", async () => {
    const partialPage = Array.from({ length: 200 }, (_, index) => ({
      Name: `Partial ${index}`,
      Category: "Type",
      Sort_Order: index + 1,
      Active: true,
    }));
    const getAllRecords = jest.fn(({ Entity, page }) => {
      if (Entity === "Widget_Picklist_Config" && page === 1) {
        return Promise.resolve({
          data: partialPage,
          info: { more_records: true },
        });
      }
      if (Entity === "Widget_Picklist_Config" && page === 2) {
        return Promise.reject(new Error("page 2 failed"));
      }
      return Promise.resolve({
        data: [{ code: "INVALID_MODULE", status: "error" }],
      });
    });
    const invoke = jest.fn().mockResolvedValue({
      details: {
        statusMessage: JSON.stringify({
          data: [
            {
              Name: "COQL complete type",
              Category: "Type",
              Sort_Order: 10,
              Active: true,
            },
          ],
        }),
      },
    });
    window.ZOHO = {
      CRM: { API: { getAllRecords }, CONNECTION: { invoke } },
    };

    const { fetchPicklistConfig } = require("./picklistConfigService");
    const config = await fetchPicklistConfig();

    expect(config.types).toEqual(["COQL complete type"]);
    expect(config.types).not.toContain("Partial 0");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  test("keeps earlier pages when NO_DATA terminates SDK pagination", async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) => ({
      Name: `Configured ${index}`,
      Category: "Type",
      Sort_Order: index + 1,
      Active: true,
    }));
    const getAllRecords = jest
      .fn()
      .mockResolvedValueOnce({
        data: firstPage,
        info: { more_records: true },
      })
      .mockResolvedValueOnce({ code: "NO_DATA", status: "error" });
    window.ZOHO = { CRM: { API: { getAllRecords } } };

    const { fetchPicklistConfig } = require("./picklistConfigService");
    const config = await fetchPicklistConfig();

    expect(config.types).toHaveLength(200);
    expect(config.types[0]).toBe("Configured 0");
  });

  test("does not cache a malformed SDK response as authoritative empty", async () => {
    const getAllRecords = jest.fn().mockResolvedValue(undefined);
    window.ZOHO = { CRM: { API: { getAllRecords } } };

    const { fetchPicklistConfig } = require("./picklistConfigService");
    const config = await fetchPicklistConfig();

    expect(config._source).toBe("fallback");
    expect(getAllRecords).toHaveBeenCalledTimes(2);
  });

  test("treats nested COQL NO_CONTENT as authoritative empty", async () => {
    const invoke = jest.fn().mockResolvedValue({
      details: {
        statusMessage: JSON.stringify({
          code: "NO_CONTENT",
          status: "error",
        }),
      },
    });
    window.ZOHO = { CRM: { API: {}, CONNECTION: { invoke } } };

    const { fetchPicklistConfig } = require("./picklistConfigService");
    const config = await fetchPicklistConfig();

    expect(config).toMatchObject({ _source: "custom_module", types: [] });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  test("does not let an empty COQL status message mask an outer data error", async () => {
    const invoke = jest.fn((_, request) =>
      request.parameters.select_query.includes("Widget_Picklist_Config")
        ? Promise.resolve({
            data: { code: "INTERNAL_ERROR", status: "error" },
            details: {
              statusMessage: JSON.stringify({ data: [] }),
            },
          })
        : Promise.resolve({
            details: {
              statusMessage: JSON.stringify({
                data: [
                  {
                    Name: "Alias type",
                    Category: "Type",
                    Sort_Order: 1,
                    Active: true,
                  },
                ],
              }),
            },
          })
    );
    window.ZOHO = { CRM: { API: {}, CONNECTION: { invoke } } };

    const { fetchPicklistConfig } = require("./picklistConfigService");
    const config = await fetchPicklistConfig();

    expect(config.types).toEqual(["Alias type"]);
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  test("continues SDK pagination beyond ten short pages", async () => {
    const getAllRecords = jest.fn(({ page }) =>
      Promise.resolve({
        data: [
          {
            Name: `Configured ${page}`,
            Category: "Type",
            Sort_Order: page,
            Active: true,
          },
        ],
        info: { more_records: page < 12 },
      })
    );
    window.ZOHO = { CRM: { API: { getAllRecords } } };

    const { fetchPicklistConfig } = require("./picklistConfigService");
    const config = await fetchPicklistConfig();

    expect(getAllRecords).toHaveBeenCalledTimes(12);
    expect(config.types).toHaveLength(12);
    expect(config.types[11]).toBe("Configured 12");
  });

  test("uses wrapped SDK records and pagination metadata", async () => {
    const getAllRecords = jest.fn(({ page }) =>
      Promise.resolve({
        data: {
          data: [
            {
              Name: `Wrapped ${page}`,
              Category: "Type",
              Sort_Order: page,
              Active: true,
            },
          ],
          info: { more_records: page === 1 },
        },
      })
    );
    window.ZOHO = { CRM: { API: { getAllRecords } } };

    const { fetchPicklistConfig } = require("./picklistConfigService");
    const config = await fetchPicklistConfig();

    expect(getAllRecords).toHaveBeenCalledTimes(2);
    expect(config.types).toEqual(["Wrapped 1", "Wrapped 2"]);
  });

  test("rejects repeating SDK pages instead of accepting partial config", async () => {
    const getAllRecords = jest.fn().mockResolvedValue({
      data: [
        {
          Name: "Repeated SDK option",
          Category: "Type",
          Sort_Order: 1,
          Active: true,
        },
      ],
      info: { more_records: true },
    });
    window.ZOHO = { CRM: { API: { getAllRecords } } };

    const { fetchPicklistConfig } = require("./picklistConfigService");
    const config = await fetchPicklistConfig();

    expect(config._source).toBe("fallback");
    expect(getAllRecords).toHaveBeenCalledTimes(4);
  });

  test("paginates COQL past the first 2000 records", async () => {
    const firstPage = Array.from({ length: 2000 }, (_, index) => ({
      Name: `COQL ${index}`,
      Category: "Type",
      Sort_Order: index + 1,
      Active: true,
    }));
    const invoke = jest
      .fn()
      .mockResolvedValueOnce({
        details: { statusMessage: JSON.stringify({ data: firstPage }) },
      })
      .mockResolvedValueOnce({
        details: {
          statusMessage: JSON.stringify({
            data: [
              {
                Name: "COQL final",
                Category: "Type",
                Sort_Order: 2001,
                Active: true,
              },
            ],
          }),
        },
      });
    window.ZOHO = { CRM: { API: {}, CONNECTION: { invoke } } };

    const { fetchPicklistConfig } = require("./picklistConfigService");
    const config = await fetchPicklistConfig();

    expect(config.types).toHaveLength(2001);
    expect(config.types[2000]).toBe("COQL final");
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls[1][1].parameters.select_query).toContain(
      "LIMIT 2000, 2000"
    );
  });

  test.each(["statusMessage", "details", "top-level"])(
    "continues a short COQL page when %s info reports more records",
    async (infoLocation) => {
      const statusMessage = {
        data: [
          {
            Name: `Short ${infoLocation}`,
            Category: "Type",
            Sort_Order: 1,
            Active: true,
          },
        ],
      };
      const firstResponse = { details: {} };
      if (infoLocation === "statusMessage") {
        statusMessage.info = { more_records: true };
      } else if (infoLocation === "details") {
        firstResponse.details.info = { more_records: true };
      } else {
        firstResponse.info = { more_records: true };
      }
      firstResponse.details.statusMessage = JSON.stringify(statusMessage);

      const invoke = jest
        .fn()
        .mockResolvedValueOnce(firstResponse)
        .mockResolvedValueOnce({
          details: {
            statusMessage: JSON.stringify({
              data: [
                {
                  Name: `Final ${infoLocation}`,
                  Category: "Type",
                  Sort_Order: 2,
                  Active: true,
                },
              ],
              info: { more_records: false },
            }),
          },
        });
      window.ZOHO = { CRM: { API: {}, CONNECTION: { invoke } } };

      const { fetchPicklistConfig } = require("./picklistConfigService");
      const config = await fetchPicklistConfig();

      expect(config.types).toEqual([
        `Short ${infoLocation}`,
        `Final ${infoLocation}`,
      ]);
      expect(invoke).toHaveBeenCalledTimes(2);
      expect(invoke.mock.calls[1][1].parameters.select_query).toContain(
        "LIMIT 2000, 2000"
      );
    }
  );

  test("discards partial COQL pages after a later-page failure", async () => {
    const firstPage = Array.from({ length: 2000 }, (_, index) => ({
      Name: `Partial COQL ${index}`,
      Category: "Type",
      Sort_Order: index + 1,
      Active: true,
    }));
    const invoke = jest.fn((_, request) => {
      const query = request.parameters.select_query;
      if (
        query.includes("from Widget_Picklist_Config") &&
        query.includes("LIMIT 0, 2000")
      ) {
        return Promise.resolve({
          details: { statusMessage: JSON.stringify({ data: firstPage }) },
        });
      }
      if (query.includes("from Widget_Picklist_Config")) {
        return Promise.resolve({
          details: {
            statusMessage: JSON.stringify({
              code: "INTERNAL_ERROR",
              status: "error",
            }),
          },
        });
      }
      return Promise.resolve({
        details: {
          statusMessage: JSON.stringify({
            data: [
              {
                Name: "Alias complete type",
                Category: "Type",
                Sort_Order: 1,
                Active: true,
              },
            ],
          }),
        },
      });
    });
    window.ZOHO = { CRM: { API: {}, CONNECTION: { invoke } } };

    const { fetchPicklistConfig } = require("./picklistConfigService");
    const config = await fetchPicklistConfig();

    expect(config.types).toEqual(["Alias complete type"]);
    expect(config.types).not.toContain("Partial COQL 0");
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  test("rejects repeating COQL pages instead of accepting partial config", async () => {
    const repeatedPage = Array.from({ length: 2000 }, (_, index) => ({
      Name: `Repeated COQL ${index}`,
      Category: "Type",
      Sort_Order: index + 1,
      Active: true,
    }));
    const invoke = jest.fn((_, request) => {
      const query = request.parameters.select_query;
      if (query.includes("from Widget_Picklist_Config")) {
        return Promise.resolve({
          details: {
            statusMessage: JSON.stringify({ data: repeatedPage }),
          },
        });
      }
      return Promise.resolve({
        details: {
          statusMessage: JSON.stringify({
            code: "INVALID_MODULE",
            status: "error",
          }),
        },
      });
    });
    window.ZOHO = { CRM: { API: {}, CONNECTION: { invoke } } };

    const { fetchPicklistConfig } = require("./picklistConfigService");
    const config = await fetchPicklistConfig();

    expect(config._source).toBe("fallback");
    expect(invoke).toHaveBeenCalledTimes(3);
  });
});
