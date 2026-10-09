jest.mock("axios", () => ({ request: jest.fn() }));

import { file, parseAttachmentListResponse, readAttachmentPages } from "./file";

describe("attachment list response", () => {
  test("accepts an explicit attachment list", () => {
    expect(
      parseAttachmentListResponse({
        details: {
          statusMessage: JSON.stringify({
            data: [{ id: "attachment-1", File_Name: "letter.pdf" }],
          }),
        },
      })
    ).toEqual([{ id: "attachment-1", File_Name: "letter.pdf" }]);
  });

  test("accepts an explicit no-content response", () => {
    expect(parseAttachmentListResponse({ statusText: "nocontent" })).toEqual([]);
    expect(parseAttachmentListResponse({ statusText: "No Content" })).toEqual([]);
    expect(parseAttachmentListResponse({
      details: { statusCode: "204", statusMessage: "No Content" },
    })).toEqual([]);
  });

  test("does not turn a Zoho error into an empty list", () => {
    expect(() =>
      parseAttachmentListResponse({
        details: {
          statusMessage: JSON.stringify({
            code: "INVALID_TOKEN",
            message: "Attachment read denied",
          }),
        },
      })
    ).toThrow("Attachment read denied");
    expect(() => parseAttachmentListResponse({
      data: [{ code: "AUTHORIZATION_FAILED", message: "Record is unavailable" }],
    })).toThrow("Record is unavailable");
  });

  test("rejects an HTTP error even when its wrapper contains an empty list", () => {
    expect(() => parseAttachmentListResponse({
      details: { statusCode: 403, statusMessage: { data: [] } },
    })).toThrow("status 403");
    expect(() => parseAttachmentListResponse({
      statusText: "nocontent",
      details: { statusCode: 403, statusMessage: "No Content" },
    })).toThrow("status 403");
  });

  test("rejects a partial attachment page", () => {
    expect(() => parseAttachmentListResponse({
      details: { statusMessage: JSON.stringify({
        data: [{ id: "file-1", File_Name: "one.pdf" }],
        info: { more_records: true },
      }) },
    })).toThrow("more pages");
  });

  test("does not treat a malformed response as no attachments", () => {
    expect(() => parseAttachmentListResponse({ details: { statusMessage: "" } }))
      .toThrow("verified list");
  });
});

describe("attachment API selection", () => {
  let invoke;

  beforeEach(() => {
    invoke = jest.fn();
    window.ZOHO = { CRM: { CONNECTION: { invoke } } };
  });

  afterEach(() => {
    delete window.ZOHO;
  });

  test("strict move reads use the active CRM environment", async () => {
    const getRelatedRecords = jest.fn().mockResolvedValue({
      data: [{ id: "file-1", File_Name: "letter.pdf" }],
      info: { page: 1, more_records: false },
    });
    window.ZOHO.CRM.API = { getRelatedRecords };

    await expect(file.getAttachments({
      module: "History1",
      recordId: "history-1",
      strict: true,
    })).resolves.toEqual({
      data: [{ id: "file-1", File_Name: "letter.pdf" }],
      error: null,
    });
    expect(getRelatedRecords).toHaveBeenCalledWith({
      Entity: "History1",
      RecordID: "history-1",
      RelatedList: "Attachments",
      page: 1,
      per_page: 200,
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  test("strict move reads accept active CRM no-content responses", async () => {
    const getRelatedRecords = jest.fn().mockResolvedValue({
      statusText: "No Content",
    });
    window.ZOHO.CRM.API = { getRelatedRecords };

    await expect(file.getAttachments({
      module: "History1",
      recordId: "history-1",
      strict: true,
    })).resolves.toEqual({ data: [], error: null });
    expect(invoke).not.toHaveBeenCalled();
  });

  test("strict move reads fail closed when the active CRM API is unavailable", async () => {
    await expect(file.getAttachments({
      module: "History1",
      recordId: "history-1",
      strict: true,
    })).resolves.toEqual({
      data: null,
      error: "The active CRM attachment API is unavailable.",
    });
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("attachment pagination", () => {
  const pageResponse = (rows, moreRecords) => ({
    details: { statusMessage: JSON.stringify({
      data: rows,
      info: { more_records: moreRecords },
    }) },
  });

  test("reads every page before returning attachments", async () => {
    const invokePage = jest.fn(async (page) => page === 1
      ? pageResponse([{ id: "file-1", File_Name: "first.pdf" }], true)
      : pageResponse([{ id: "file-2", File_Name: "second.pdf" }], false));
    await expect(readAttachmentPages(invokePage)).resolves.toEqual([
      { id: "file-1", File_Name: "first.pdf" },
      { id: "file-2", File_Name: "second.pdf" },
    ]);
    expect(invokePage).toHaveBeenCalledTimes(2);
  });

  test("rejects an ambiguous full page or an error on a later page", async () => {
    const fullPage = Array.from({ length: 200 }, (_, index) => ({
      File_Name: `file-${index}.pdf`,
    }));
    await expect(readAttachmentPages(async () => ({ data: fullPage })))
      .rejects.toThrow("pagination was not confirmed");
    await expect(readAttachmentPages(async (page) => page === 1
      ? pageResponse([{ id: "file-1", File_Name: "first.pdf" }], true)
      : { details: { statusCode: 403, statusMessage: { data: [] } } }))
      .rejects.toThrow("status 403");
  });

  test("rejects a repeated attachment page", async () => {
    const repeated = pageResponse([{ id: "file-1", File_Name: "first.pdf" }], true);
    await expect(readAttachmentPages(async () => repeated))
      .rejects.toThrow("repeated attachment page");
  });
});
