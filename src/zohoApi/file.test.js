jest.mock("axios", () => ({ request: jest.fn() }));

import { parseAttachmentListResponse, readAttachmentPages } from "./file";

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
