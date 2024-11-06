const ZOHO = window.ZOHO;

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
    console.log({ uploadFileError });
    return {
      data: null,
      error: "Something went wrong",
    };
  }
}

async function getAttachments({
  module,
  recordId,
  accessToken,
  dataCenterUrl,
}) {
  try {
    const url = `${dataCenterUrl}/crm/v6/${module}/${recordId}/Attachments?fields=id,File_Name,$file_id`;
    var req_data = {
      url,
      param_type: 1,
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    };

    const getAttachmentsResp = await ZOHO.CRM.HTTP.get(req_data);

    if (getAttachmentsResp === "") {
      return {
        data: [],
        error: null,
      };
    }

    const resp = await JSON.parse(getAttachmentsResp);

    return {
      data: resp?.data,
      error: null,
    };
  } catch (getFileError) {
    console.log({ getFileError });
    return {
      data: null,
      error: "Something went wrong",
    };
  }
}

async function deleteAttachment({
  module,
  recordId,
  attachment_id,
  accessToken,
  dataCenterUrl,
}) {
  try {
    const url = `${dataCenterUrl}/crm/v6/${module}/${recordId}/Attachments/${attachment_id}`;
    var req_data = {
      url,
      param_type: 1,
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    };

    const deleteAttachmentResp2 = await ZOHO.CRM.HTTP.delete(req_data);
    const resp = await JSON.parse(deleteAttachmentResp2);
    return {
      data: resp?.data?.[0]?.details?.id,
      error: null,
    };
  } catch (deleteFileError) {
    console.log({ deleteFileError });
    return {
      data: null,
      error: "Something went wrong",
    };
  }
}

export const file = {
  uploadAttachment,
  getAttachments,
  deleteAttachment,
};
