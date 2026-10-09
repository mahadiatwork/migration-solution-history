import {
  buildApplicationMoveData,
  moveContactHistoryToApplication,
  requireMoveSuccess,
  serializeApplicationProgress,
} from "./contactHistoryMove";

const success = (id) => ({
  data: [{ code: "SUCCESS", details: { id } }],
});

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
  const insertRecord = jest.fn(async ({ Entity, APIData }) => {
    if (Entity === "Applications_History") {
      targetPayload = APIData;
      return success("application-history-1");
    }
    return success(`application-link-${APIData.Contact.id}`);
  });
  const deleteRecord = jest.fn(async ({ RecordID }) => success(RecordID));
  const execute = jest.fn(async () => ({ code: "SUCCESS" }));
  return {
    CRM: {
      API: { getRecord, getRelatedRecords, insertRecord, deleteRecord },
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
  test("maps the full source record and deletes it only after destination links succeed", async () => {
    const zoho = makeZoho();
    await expect(move(zoho)).resolves.toEqual({
      sourceHistoryId: "history-1",
      targetHistoryId: "application-history-1",
    });

    const targetCreate = zoho.CRM.API.insertRecord.mock.calls[0][0];
    expect(targetCreate.Entity).toBe("Applications_History");
    expect(targetCreate.APIData).toEqual(expect.objectContaining({
      Application: { id: "matter-2" },
      History_Details: "Details",
      Duration_Min: "30",
      Owner: { id: "owner-1" },
      Stakeholder: { id: "stakeholder-1" },
      Matter_No: "MAT-2",
    }));
    expect(zoho.CRM.API.insertRecord).toHaveBeenCalledTimes(3);
    expect(zoho.CRM.API.deleteRecord).toHaveBeenCalledWith({
      Entity: "History1",
      RecordID: "history-1",
    });
    expect(
      zoho.CRM.API.insertRecord.mock.invocationCallOrder[2]
    ).toBeLessThan(zoho.CRM.API.deleteRecord.mock.invocationCallOrder[0]);
  });

  test("a resolved Zoho link error keeps the source and cleans up the target", async () => {
    const zoho = makeZoho();
    zoho.CRM.API.insertRecord.mockImplementation(async ({ Entity }) =>
      Entity === "Applications_History"
        ? success("application-history-1")
        : { data: [{ code: "INVALID_DATA", message: "Contact link rejected" }] }
    );

    await expect(move(zoho)).rejects.toThrow("Contact link rejected");
    expect(zoho.CRM.API.deleteRecord).toHaveBeenCalledWith({
      Entity: "Applications_History",
      RecordID: "application-history-1",
    });
    expect(zoho.CRM.API.deleteRecord).not.toHaveBeenCalledWith({
      Entity: "History1",
      RecordID: "history-1",
    });
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
    expect(zoho.CRM.FUNCTIONS.execute.mock.invocationCallOrder[0]).toBeLessThan(
      zoho.CRM.API.deleteRecord.mock.invocationCallOrder[0]
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
    expect(zoho.CRM.API.deleteRecord).not.toHaveBeenCalledWith({
      Entity: "History1",
      RecordID: "history-1",
    });
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
    expect(zoho.CRM.API.deleteRecord).not.toHaveBeenCalledWith({
      Entity: "History1",
      RecordID: "history-1",
    });
  });

  test("a destination field or participant link that did not persist keeps the source", async () => {
    const zoho = makeZoho();
    const originalGetRecord = zoho.CRM.API.getRecord.getMockImplementation();
    zoho.CRM.API.getRecord.mockImplementation(async (request) => {
      const response = await originalGetRecord(request);
      if (request.Entity === "Applications_History") {
        response.data[0].History_Details = "";
      }
      return response;
    });

    await expect(move(zoho)).rejects.toThrow("Destination History_Details");
    expect(zoho.CRM.API.deleteRecord).not.toHaveBeenCalledWith({
      Entity: "History1",
      RecordID: "history-1",
    });

    const another = makeZoho();
    const originalLinks = another.CRM.API.getRelatedRecords.getMockImplementation();
    another.CRM.API.getRelatedRecords.mockImplementation(async (request) =>
      request.Entity === "Applications_History"
        ? { data: [] }
        : originalLinks(request)
    );
    await expect(move(another)).rejects.toThrow("Destination Contact links");
    expect(another.CRM.API.deleteRecord).not.toHaveBeenCalledWith({
      Entity: "History1",
      RecordID: "history-1",
    });
  });

  test("a source deletion error restores the source and removes the target", async () => {
    const zoho = makeZoho();
    zoho.CRM.API.deleteRecord.mockImplementation(async ({ Entity, RecordID }) =>
      Entity === "History1"
        ? { data: [{ code: "INVALID_DATA", message: "Deletion denied" }] }
        : success(RecordID)
    );

    await expect(move(zoho)).rejects.toThrow(
      "Move failed: Deletion denied The source was restored."
    );
    expect(zoho.CRM.API.deleteRecord).toHaveBeenCalledWith({
      Entity: "Applications_History",
      RecordID: "application-history-1",
    });
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
      return Entity === "History1"
        ? { data: [{ code: "INVALID_DATA", message: "Deletion denied" }] }
        : success(RecordID);
    });

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
