import axios from "axios";
import {
  conn_name,
  dataCenterMap,
  access_token_api_url,
  access_token_url,
} from "../config/config";

const ZOHO = window.ZOHO;

export const parseAttachmentListResponse = (response, allowMorePages = false) => {
  const raw = response?.details?.statusMessage;
  const statusCodes = [response?.details?.statusCode, response?.statusCode]
    .filter((value) => value != null)
    .map(Number);
  const explicitNoContent =
    statusCodes.includes(204) ||
    String(response?.statusText || "").toLowerCase() === "nocontent" ||
    String(response?.details?.statusText || "").toLowerCase() === "nocontent";
  let payload = raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      payload = JSON.parse(raw);
    } catch {
      if (explicitNoContent && /^no\s+content$/i.test(raw.trim())) {
        payload = { code: "NO_CONTENT" };
      } else {
        throw new Error("Could not parse the attachment response.");
      }
    }
  }
  const failedStatus = statusCodes.find((code) => Number.isFinite(code) && code >= 400);
  if (failedStatus) {
    throw new Error(`Attachment request failed with status ${failedStatus}.`);
  }
  const error = [payload, response?.details, response].find((item) =>
    item && typeof item === "object" &&
    (String(item.status || "").toLowerCase() === "error" ||
      (item.code != null &&
        !["SUCCESS", "200", "NO_CONTENT"].includes(String(item.code).toUpperCase())))
  );
  if (error) {
    throw new Error(error.message || "Attachment request failed.");
  }
  const hasMoreAttachments = [payload, response?.details, response].some(
    (item) => item?.info?.more_records === true ||
      item?.info?.more_records === "true"
  );
  if (hasMoreAttachments && !allowMorePages) {
    throw new Error("Attachment list has more pages; the move was stopped.");
  }
  for (const candidate of [payload, response?.details, response]) {
    if (Array.isArray(candidate)) return candidate;
    if (Array.isArray(candidate?.data)) return candidate.data;
  }
  const noContent = explicitNoContent || payload?.code === "NO_CONTENT";
  if (noContent) return [];
  throw new Error("Attachment response did not contain a verified list.");
};

export const readAttachmentPages = async (invokePage) => {
  const attachments = [];
  const seenIds = new Set();
  for (let page = 1; page <= 50; page += 1) {
    const response = await invokePage(page);
    const rows = parseAttachmentListResponse(response, true);
    const raw = response?.details?.statusMessage;
    const payload = typeof raw === "string" && raw.trim() &&
      !/^no\s+content$/i.test(raw.trim())
      ? JSON.parse(raw)
      : raw;
    const info = [payload, response?.details, response]
      .find((item) => item?.info && typeof item.info === "object")?.info;
    const moreRecords = info?.more_records;
    if (info?.page != null && Number(info.page) !== page) {
      throw new Error("CRM returned the wrong attachment page.");
    }
    if (page > 1 || moreRecords === true || moreRecords === "true") {
      for (const row of rows) {
        const id = row?.id;
        if (!id || seenIds.has(String(id))) {
          throw new Error("CRM returned an incomplete or repeated attachment page.");
        }
      }
    }
    for (const row of rows) {
      if (row?.id) seenIds.add(String(row.id));
    }
    attachments.push(...rows);
    if (moreRecords === false || moreRecords === "false") return attachments;
    if (moreRecords === true || moreRecords === "true") {
      if (rows.length === 0 || page === 50) {
        throw new Error("Attachment pages could not be fully verified.");
      }
      continue;
    }
    if (rows.length < 200) return attachments;
    throw new Error("Attachment pagination was not confirmed by CRM.");
  }
  throw new Error("Attachment pages exceed the supported limit.");
};

async function uploadAttachment({ module, recordId, data }) {
  try {
    const uploadAttachmentResp = await ZOHO.CRM.API.attachFile({
      Entity: module,
      RecordID: recordId,
      File: { Name: data?.name, Content: data },
    });
    return {
      data: uploadAttachmentResp?.data,
      error: null,
    };
  } catch (uploadFileError) {
    return {
      data: null,
      error: "Something went wrong",
    };
  }
}

async function getAttachments({ module, recordId }) {
  try {
    const list = await readAttachmentPages((page) =>
      ZOHO.CRM.CONNECTION.invoke(conn_name, {
        url: `${dataCenterMap.AU}/crm/v6/${module}/${recordId}/Attachments?fields=id,File_Name,$file_id&page=${page}&per_page=200`,
        param_type: 1,
        headers: {},
        method: "GET",
      })
    );
    return { data: list, error: null };
  } catch (getAttachmentsError) {
    console.log({ getAttachmentsError });
    return {
      data: null,
      error: getAttachmentsError?.message || "Something went wrong",
    };
  }
}

async function downloadAttachmentById({
  module,
  recordId,
  attachmentId,
  fileName,
}) {
  function downloadFile(data, filename, mime) {
    // It is necessary to create a new blob object with mime-type explicitly set
    // otherwise only Chrome works like it should
    const blob = new Blob([data], { type: mime || "application/octet-stream" });
    if (typeof window.navigator.msSaveBlob !== "undefined") {
      // IE doesn't allow using a blob object directly as link href.
      // Workaround for "HTML7007: One or more blob URLs were
      // revoked by closing the blob for which they were created.
      // These URLs will no longer resolve as the data backing
      // the URL has been freed."
      window.navigator.msSaveBlob(blob, filename);
      return;
    }
    // Other browsers
    // Create a link pointing to the ObjectURL containing the blob
    const blobURL = window.URL.createObjectURL(blob);
    const tempLink = document.createElement("a");
    tempLink.style.display = "none";
    tempLink.href = blobURL;
    tempLink.setAttribute("download", filename);
    // Safari thinks _blank anchor are pop ups. We only want to set _blank
    // target if the browser does not support the HTML5 download attribute.
    // This allows you to download files in desktop safari if pop up blocking
    // is enabled.
    if (typeof tempLink.download === "undefined") {
      tempLink.setAttribute("target", "_blank");
    }
    document.body.appendChild(tempLink);
    tempLink.click();
    document.body.removeChild(tempLink);
    setTimeout(() => {
      // For Firefox it is necessary to delay revoking the ObjectURL
      window.URL.revokeObjectURL(blobURL);
    }, 100);
  }

  try {
    const config = {
      url: access_token_api_url,
      method: "POST",

      data: {
        recordId,
        moduleName: module,
        attachment_id: attachmentId,
        access_token_url,
        dataCenterUrl: dataCenterMap.AU,
      },
      responseType: "blob",
    };
    const resp = await axios.request(config);
    console.log({ resp });

    downloadFile(resp?.data, fileName);
  } catch (downloadAttachmentByIdError) {
    console.log({ downloadAttachmentByIdError });
    return {
      data: null,
      error: "Something went wrong",
    };
  }
}

async function deleteAttachment({ module, recordId, attachment_id }) {
  try {
    const url = `${dataCenterMap.AU}/crm/v6/${module}/${recordId}/Attachments/${attachment_id}`;

    var req_data = {
      url,
      param_type: 1,
      headers: {},
      method: "DELETE",
    };

    const deleteAttachmentResp = await ZOHO.CRM.CONNECTION.invoke(
      conn_name,
      req_data
    );
    const respId = await deleteAttachmentResp?.details?.statusMessage?.data?.[0]
      ?.details?.id;

    return {
      data: respId,
      error: null,
    };
  } catch (deleteFileError) {
    return {
      data: null,
      error: "Something went wrong",
    };
  }
}

export const file = {
  uploadAttachment,
  getAttachments,
  downloadAttachmentById,
  deleteAttachment,
};
