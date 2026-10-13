import {
  buildApplicationMoveData,
  moveContactHistoryToApplication,
  requireMoveSuccess,
  serializeApplicationProgress,
} from "./contactHistoryMove";

const success = (id) => ({
  data: [{ code: "SUCCESS", details: { id } }],
});

const connectionResponse = (body) => ({
  details: { statusMessage: JSON.stringify(body) },
});

const hasConnectionCall = (zoho, method, suffix) =>
  zoho.CRM.CONNECTION.invoke.mock.calls.some(([, request]) =>
    request.method === method && request.url.endsWith(suffix)
  );

const transformTargetResponse = (zoho, transform) => {
  const originalInvoke = zoho.CRM.CONNECTION.invoke.getMockImplementation();
  zoho.CRM.CONNECTION.invoke.mockImplementation(async (connection, request) => {
    const response = await originalInvoke(connection, request);
    if (request.method !== "GET" || !request.url.includes("/Applications_History/")) {
      return response;
    }
    const payload = JSON.parse(response.details.statusMessage);
    transform(payload.data[0]);
    return connectionResponse(payload);
  });
};

const makeZoho = () => {
  let targetPayload;
  const getRecord = jest.fn(async ({ Entity }) => {
    if (Entity === "History1") {
      return {
        data: [{
          id: "history-1",
          Name: "Call with Contact",
          Owner: { id: "owner-1" },
          Stakeholder: { id: "stakeholder-1" },
          History_Details_Plain: "Details",
          History_Result: "Completed",
          History_Type: "Call",
          Regarding: "Visa",
          Duration: "30",
          Date: "2026-09-27T10:00:00+09:30",
        }],
      };
    }
    if (Entity === "Applications") {
      return { data: [{ id: "matter-2", Name: "MAT-2" }] };
    }
    return {
      data: [{ ...targetPayload, id: "application-history-1" }],
    };
  });
  const getRelatedRecords = jest.fn(async () => ({
    data: [
      { id: "contact-junction-1", Contact_Details: { id: "contact-1" } },
      { id: "contact-junction-2", Contact_Details: { id: "contact-2" } },
    ],
  }));
  const insertRecord = jest.fn(async ({ APIData }) => {
    return success(`application-link-${APIData.Contact.id}`);
  });
  const deleteRecord = jest.fn(async ({ RecordID }) => success(RecordID));
  const invoke = jest.fn(async (_connection, request) => {
    if (request.method === "POST" && request.url.endsWith("/Applications_History")) {
      targetPayload = request.parameters.data[0];
      return connectionResponse(success("application-history-1"));
    }
    if (request.method === "GET" && request.url.includes("/Applications_History/")) {
      return connectionResponse({
        data: [{
          ...targetPayload,
          id: "application-history-1",
          Application: { id: "matter-2" },
        }],
      });
    }
    return connectionResponse(success("connection-record"));
  });
  const execute = jest.fn(async () => ({ code: "SUCCESS" }));
  return {
    CRM: {
      API: { getRecord, getRelatedRecords, insertRecord, deleteRecord },
      CONNECTION: { invoke },
      FUNCTIONS: { execute },
    },
  };
};

const move = (zoho, listAttachments = async () => ({ data: [], error: null })) =>
  moveContactHistoryToApplication({
    zoho,
    sourceHistoryId: "history-1",
    targetMatterId: "matter-2",
    listAttachments,
    delay: async () => {},
  });

describe("Contact History to Application History move", () => {
  beforeEach(() => {
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "https://crm.zoho.com.au/",
    });
  });

  test("maps the full source record and deletes it only after destination links succeed", async () => {
    const zoho = makeZoho();
    await expect(move(zoho)).resolves.toEqual({
      sourceHistoryId: "history-1",
      targetHistoryId: "application-history-1",
    });

    const createIndex = zoho.CRM.CONNECTION.invoke.mock.calls.findIndex(
      ([, request]) => request.method === "POST" && request.url.endsWith("/Applications_History")
    );
    const targetCreate = zoho.CRM.CONNECTION.invoke.mock.calls[createIndex][1];
    expect(targetCreate.headers).toEqual({ "Content-Type": "application/json" });
    expect(targetCreate.parameters.data[0]).toEqual(expect.objectContaining({
      Application: { id: "matter-2" },
      History_Details: "Details",
      Duration_Min: "30",
      Owner: { id: "owner-1" },
      Stakeholder: { id: "stakeholder-1" },
      Matter_No: "MAT-2",
    }));
    expect(zoho.CRM.API.insertRecord).toHaveBeenCalledTimes(2);
    const sourceDeleteIndex = zoho.CRM.CONNECTION.invoke.mock.calls.findIndex(
      ([, request]) => request.method === "DELETE" && request.url.endsWith("/History1/history-1")
    );
    expect(zoho.CRM.CONNECTION.invoke.mock.invocationCallOrder[createIndex])
      .toBeLessThan(zoho.CRM.CONNECTION.invoke.mock.invocationCallOrder[sourceDeleteIndex]);
  });

  test("sends imported SharePoint URL text unchanged in the JSON destination request", async () => {
    const zoho = makeZoho();
    const sharePointUrl =
      "https://example.sharepoint.com/sites/archive/Shared%20Documents/Email%20Attachment.msg";
    zoho.CRM.API.getRecord.mockImplementation(async ({ Entity }) => ({
      data: [Entity === "History1"
        ? {
          id: "history-1",
          Name: "Imported email",
          Owner: { id: "owner-1" },
          History_Details_Plain: sharePointUrl,
        }
        : { id: "matter-2", Name: "MAT-2" }],
    }));

    await move(zoho);

    const createRequest = zoho.CRM.CONNECTION.invoke.mock.calls.find(
      ([, request]) => request.method === "POST" &&
        request.url.endsWith("/Applications_History")
    )[1];
    expect(createRequest.parameters.data[0].History_Details).toBe(sharePointUrl);
    expect(createRequest.headers["Content-Type"]).toBe("application/json");
  });

  test("does not use the production connection from a Zoho CRM Sandbox", async () => {
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "https://crmsandbox.zoho.com/",
    });
    const zoho = makeZoho();

    await expect(move(zoho)).rejects.toThrow("Sandbox");
    expect(zoho.CRM.CONNECTION.invoke).not.toHaveBeenCalled();
    expect(zoho.CRM.API.deleteRecord).not.toHaveBeenCalled();
  });

  test("a resolved Zoho link error keeps the source and cleans up the target", async () => {
    const zoho = makeZoho();
    zoho.CRM.API.insertRecord.mockImplementation(async ({ Entity }) =>
      Entity === "Applications_History"
        ? success("application-history-1")
        : { data: [{ code: "INVALID_DATA", message: "Contact link rejected" }] }
    );

    await expect(move(zoho)).rejects.toThrow("Contact link rejected");
    expect(zoho.CRM.CONNECTION.invoke.mock.calls.some(([, request]) =>
      request.method === "DELETE" &&
      request.url.endsWith("/Applications_History/application-history-1")
    )).toBe(true);
    expect(zoho.CRM.CONNECTION.invoke.mock.calls.some(([, request]) =>
      request.method === "DELETE" && request.url.endsWith("/History1/history-1")
    )).toBe(false);
  });

  test("copies existing attachments and verifies them before deleting the source", async () => {
    const zoho = makeZoho();
    const listAttachments = jest.fn(async ({ module }) => ({
      data: module === "History1"
        ? [{ File_Name: "letter.pdf" }]
        : [{ File_Name: "letter.pdf" }],
      error: null,
    }));

    await move(zoho, listAttachments);
    expect(zoho.CRM.FUNCTIONS.execute).toHaveBeenCalledTimes(1);
    expect(listAttachments).toHaveBeenCalledWith({
      module: "Applications_History",
      recordId: "application-history-1",
      strict: true,
    });
    const sourceDeleteIndex = zoho.CRM.CONNECTION.invoke.mock.calls.findIndex(
      ([, request]) => request.method === "DELETE" && request.url.endsWith("/History1/history-1")
    );
    expect(zoho.CRM.FUNCTIONS.execute.mock.invocationCallOrder[0]).toBeLessThan(
      zoho.CRM.CONNECTION.invoke.mock.invocationCallOrder[sourceDeleteIndex]
    );
  });

  test("an unverified attachment copy keeps the source", async () => {
    const zoho = makeZoho();
    const listAttachments = jest.fn(async ({ module }) => ({
      data: module === "History1" ? [{ File_Name: "letter.pdf" }] : [],
      error: null,
    }));

    await expect(move(zoho, listAttachments)).rejects.toThrow(
      "Destination attachments could not be verified"
    );
    expect(hasConnectionCall(zoho, "DELETE", "/History1/history-1")).toBe(false);
  });

  test("an attachment without a file name cannot be treated as copied", async () => {
    const zoho = makeZoho();
    const listAttachments = jest.fn(async ({ module }) => ({
      data: module === "History1"
        ? [{ id: "file-1" }]
        : [{ id: "file-2" }],
      error: null,
    }));

    await expect(move(zoho, listAttachments)).rejects.toThrow(
      "attachment without a file name"
    );
    expect(hasConnectionCall(zoho, "DELETE", "/History1/history-1")).toBe(false);
  });

  test("a destination field or participant link that did not persist keeps the source", async () => {
    const zoho = makeZoho();
    transformTargetResponse(zoho, (target) => { target.History_Details = ""; });

    await expect(move(zoho)).rejects.toThrow("Destination History_Details");
    expect(hasConnectionCall(zoho, "DELETE", "/History1/history-1")).toBe(false);

    const another = makeZoho();
    const originalLinks = another.CRM.API.getRelatedRecords.getMockImplementation();
    another.CRM.API.getRelatedRecords.mockImplementation(async (request) =>
      request.Entity === "Applications_History"
        ? { data: [] }
        : originalLinks(request)
    );
    await expect(move(another)).rejects.toThrow("Destination Contact links");
    expect(hasConnectionCall(another, "DELETE", "/History1/history-1")).toBe(false);
  });

  test("accepts Zoho newline normalization in destination history details", async () => {
    const zoho = makeZoho();
    const originalGetRecord = zoho.CRM.API.getRecord.getMockImplementation();
    zoho.CRM.API.getRecord.mockImplementation(async (request) => {
      const response = await originalGetRecord(request);
      if (request.Entity === "History1") {
        response.data[0].History_Details_Plain = "First line\r\nSecond line";
      }
      return response;
    });
    transformTargetResponse(zoho, (target) => {
      target.History_Details = "First line\nSecond line";
    });

    await expect(move(zoho)).resolves.toMatchObject({
      targetHistoryId: "application-history-1",
    });
    expect(hasConnectionCall(zoho, "DELETE", "/History1/history-1")).toBe(true);
  });

  test("accepts harmless imported-email whitespace normalization", async () => {
    const zoho = makeZoho();
    const originalGetRecord = zoho.CRM.API.getRecord.getMockImplementation();
    zoho.CRM.API.getRecord.mockImplementation(async (request) => {
      const response = await originalGetRecord(request);
      if (request.Entity === "History1") {
        response.data[0].History_Details_Plain =
          "\uFEFFFirst line\r\n\tSecond line  \r\n";
      }
      return response;
    });
    transformTargetResponse(zoho, (target) => {
      target.History_Details = "First line\n    Second line\n";
    });

    await expect(move(zoho)).resolves.toMatchObject({
      targetHistoryId: "application-history-1",
    });
    expect(hasConnectionCall(zoho, "DELETE", "/History1/history-1")).toBe(true);
  });

  test("a source deletion error restores the source and removes the target", async () => {
    const zoho = makeZoho();
    const originalInvoke = zoho.CRM.CONNECTION.invoke.getMockImplementation();
    zoho.CRM.CONNECTION.invoke.mockImplementation(async (connection, request) =>
      request.method === "DELETE" && request.url.endsWith("/History1/history-1")
        ? connectionResponse({
          data: [{ code: "INVALID_DATA", message: "Deletion denied" }],
        })
        : originalInvoke(connection, request)
    );

    await expect(move(zoho)).rejects.toThrow(
      "Move failed: Deletion denied The source was restored."
    );
    expect(hasConnectionCall(zoho, "DELETE", "/Applications_History/application-history-1"))
      .toBe(true);
  });

  test("restores deleted source links when the source record cannot be deleted", async () => {
    const zoho = makeZoho();
    const remainingLinks = new Set(["contact-junction-1", "contact-junction-2"]);
    const originalGetLinks = zoho.CRM.API.getRelatedRecords.getMockImplementation();
    zoho.CRM.API.getRelatedRecords.mockImplementation(async (request) => {
      const response = await originalGetLinks(request);
      if (request.Entity === "History1") {
        return {
          data: response.data.filter((link) => remainingLinks.has(link.id)),
        };
      }
      return response;
    });
    const restored = [];
    const originalInsert = zoho.CRM.API.insertRecord.getMockImplementation();
    zoho.CRM.API.insertRecord.mockImplementation(async (request) => {
      if (request.Entity === "History_X_Contacts") {
        restored.push(request.APIData.Contact_Details.id);
        return success(`restored-${restored.length}`);
      }
      return originalInsert(request);
    });
    zoho.CRM.API.deleteRecord.mockImplementation(async ({ Entity, RecordID }) => {
      if (Entity === "History_X_Contacts") {
        remainingLinks.delete(RecordID);
      }
      return success(RecordID);
    });
    const originalInvoke = zoho.CRM.CONNECTION.invoke.getMockImplementation();
    zoho.CRM.CONNECTION.invoke.mockImplementation(async (connection, request) =>
      request.method === "DELETE" && request.url.endsWith("/History1/history-1")
        ? connectionResponse({
          data: [{ code: "INVALID_DATA", message: "Deletion denied" }],
        })
        : originalInvoke(connection, request)
    );

    await expect(move(zoho)).rejects.toThrow("The source was restored");
    expect(restored).toEqual(["contact-1", "contact-2"]);
  });

  test("validates Zoho responses and preserves the source owner", () => {
    expect(() => requireMoveSuccess({ data: [{ code: "ERROR" }] }, "Create"))
      .toThrow("Create failed");
    expect(() => buildApplicationMoveData({ Owner: null }, { id: "matter-2" }))
      .toThrow("Owner could not be resolved");
    expect(serializeApplicationProgress(["In review"], "picklist"))
      .toBe("In review");
    expect(serializeApplicationProgress("In review", "multiselectpicklist"))
      .toEqual(["In review"]);
  });
});
