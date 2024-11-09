const ZOHO = window.ZOHO;

async function getAttachmentsOLD({ module, recordId }) {
  try {
    var conn_name = "test_email_attachment";
    const dataCenterUrl = "https://www.zohoapis.com";
    const url = `${dataCenterUrl}/crm/v6/${module}/${recordId}/Attachments?fields=id,File_Name,$file_id`;
    var req_data = {
      url,
      param_type: 1,
      headers: {},
      method: "GET",
    };
    const getAttachmentsResp = await ZOHO.CRM.CONNECTION.invoke(
      conn_name,
      req_data
    );
    return {
      data: getAttachmentsResp?.details?.statusMessage?.data,
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

export const file = {
  getAttachments,
};
