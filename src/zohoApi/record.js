const ZOHO = window.ZOHO;

const flattenObj = (ob, seperator = ".") => {
  // The object which contains the
  // final result
  let result = {};

  // loop through the object "ob"
  for (const i in ob) {
    // We check the type of the i using
    // typeof() function and recursively
    // call the function again
    if (typeof ob[i] === "object") {
      const temp = flattenObj(ob[i], seperator);
      for (const j in temp) {
        // Store temp in result
        result[i + seperator + j] = temp[j];
      }
    }

    // Else store ob[i] in result directly
    else {
      result[i] = ob[i];
    }
  }
  return result;
};

const getCrmFieldNames = async (entity) => {
  const fieldResp = await ZOHO.CRM.META.getFields({
    Entity: entity,
  });

  return fieldResp?.fields;
};

const getCrmRecordData = async (entity, entityId, displayName = false) => {
  const recordResp = await ZOHO.CRM.API.getRecord({
    Entity: entity,
    approved: "both",
    RecordID: entityId,
  });
  if (displayName === true) {
    const fieldNames = await getCrmFieldNames(entity);
    let returnFieldNameValues = {};
    fieldNames.forEach((indvFieldMap) => {
      returnFieldNameValues[indvFieldMap?.field_label] =
        recordResp?.data?.[0]?.[indvFieldMap?.api_name];
    });
    return returnFieldNameValues;
  }
  return recordResp?.data?.[0];
};

const getCrmUsersData = async (entityId, displayName = false) => {
  const recordResp = await ZOHO.CRM.API.getRecord({
    Entity: "users",
    RecordID: entityId,
  });
  if (displayName === true) {
    const fieldNames = await getCrmFieldNames("users");
    let returnFieldNameValues = {};
    fieldNames.forEach((indvFieldMap) => {
      returnFieldNameValues[indvFieldMap?.field_label] =
        recordResp?.users?.[0]?.[indvFieldMap?.api_name];
    });
    return returnFieldNameValues;
  }
  return recordResp?.users?.[0];
};

export const getFieldsAndData = async ({
  entity,
  entityId,
  displayName = false,
  apiName = true,
  flatten = ["recordData"],
  returnValues = ["recordData"],
  // ["fields", "recordData"]
  fetchAdditionalFieldTypes = ["entity", "lookup", "ownerlookup"],
  // "entity", "lookup", "ownerlookup", "subform"
}) => {
  // this function uses "flattenObj","getCrmRecordData","getCrmFieldNames","getCrmUsersData"
  try {
    let returnData = { fieldNames: {}, recordData: {} };
    if (entityId) {
      returnData.recordData[entity] = await getCrmRecordData(
        entity,
        entityId,
        displayName
      );
      if (returnData.recordData[entity] === undefined) {
        return { error: "Provided Record ID is wrong.", data: null };
      }
    }

    returnData.fieldNames[entity] = await getCrmFieldNames(entity);

    return Promise.all(
      returnData.fieldNames[entity].map(async (fieldMap, index) => {
        if (
          fieldMap.data_type === "lookup" &&
          fetchAdditionalFieldTypes.includes("lookup")
        ) {
          if (returnValues.includes("fields")) {
            const lookupFields = await getCrmFieldNames(
              fieldMap?.lookup?.module?.api_name
            );
            if (lookupFields !== undefined) {
              const modifiedLookupFields = lookupFields.map(
                (indvField, index) => {
                  return {
                    ...indvField,
                    moduleName: fieldMap.field_label,
                    lookupfield_api_name: `${entity}.${fieldMap.api_name}`,
                    fieldOriginType: "lookupfield",
                  };
                }
              );
              // Using Display Name
              if (displayName) {
                returnData.fieldNames[fieldMap.field_label] =
                  modifiedLookupFields;
              }
              // Using API Name
              if (apiName) {
                returnData.fieldNames[fieldMap.api_name] = modifiedLookupFields;
              }
            }
          }
          if (returnValues.includes("recordData")) {
            const lookupData = await getCrmRecordData(
              fieldMap.lookup.module.api_name,
              returnData?.recordData?.[entity]?.[fieldMap?.api_name]?.id,
              displayName
            );
            if (lookupData !== undefined) {
              // Using Display Name
              if (displayName) {
                returnData.recordData[entity][fieldMap.field_label] =
                  lookupData;
              }

              // Using API Name
              if (apiName) {
                returnData.recordData[entity][fieldMap.api_name] = lookupData;
              }
            }
          }
          /**
           * Return is necessary for Promise.all()
           */
          return "lookupFields";
        } else if (
          fieldMap.data_type === "subform" &&
          fetchAdditionalFieldTypes.includes("subform")
        ) {
          if (returnValues.includes("fields")) {
            const lookupFields = await getCrmFieldNames(
              fieldMap.subform.module
            );
            const modifiedLookupFields = lookupFields.map(
              (indvField, index) => {
                return {
                  ...indvField,
                  moduleName: fieldMap.field_label,
                  fieldOriginType: "subform",
                };
              }
            );
            if (lookupFields !== undefined) {
              // Using Display Name
              if (displayName) {
                returnData.fieldNames[fieldMap.field_label] =
                  modifiedLookupFields;
              }
              // Using API Name
              if (apiName) {
                returnData.fieldNames[fieldMap.api_name] = modifiedLookupFields;
              }
            }
          }

          // const lookupData = await ZOHO.CRM.API.getRecord({
          //     Entity: fieldMap.lookup.module.api_name,
          //     RecordID:
          //         returnData.recordData[entity][fieldMap.lookup.api_name],
          // });
          // if (lookupData !== undefined) {
          //     returnData.recordData[fieldMap.field_label] =
          //         lookupData.data[0];
          // }
          return "lookupFields";
        } else if (
          fieldMap.data_type === "ownerlookup" &&
          fetchAdditionalFieldTypes.includes("ownerlookup")
        ) {
          /**
           * For Owner Lookup Fields
           */

          /**
           * Adding USer Fields
           */
          if (returnValues.includes("fields")) {
            const lookupFields = await getCrmFieldNames("users");
            const modifiedLookupFields = lookupFields.map(
              (indvField, index) => {
                return {
                  ...indvField,
                  moduleName: fieldMap.field_label,
                  lookupfield_api_name: `${entity}.${fieldMap.api_name}`,
                };
              }
            );
            if (lookupFields !== undefined) {
              // Using Display Name
              if (displayName) {
                returnData.fieldNames[fieldMap.field_label] =
                  modifiedLookupFields;
              }

              // Using API Name
              if (apiName) {
                returnData.fieldNames[fieldMap.api_name] = modifiedLookupFields;
              }
            }
          }

          /**
           * Adding User Data
           */
          if (returnValues.includes("recordData")) {
            const lookupData = await getCrmUsersData(
              returnData.recordData[entity][fieldMap.api_name]?.id,
              displayName
            );
            if (lookupData !== undefined) {
              // Using Display Name
              if (displayName) {
                returnData.recordData[entity][fieldMap.field_label] =
                  lookupData;
              }

              // Using API Name
              if (apiName) {
                returnData.recordData[entity][fieldMap.api_name] = lookupData;
              }
            }
          }

          /**
           * Return is necessary
           */
          return "lookupFields";
        } else {
          returnData.fieldNames[entity][index].moduleName = entity;
          returnData.fieldNames[entity][index].fieldOriginType = "entity";
        }
      })
    ).then((data) => {
      /**
       * After all finished return data
       */
      return {
        fieldNames: returnValues.includes("fields")
          ? flatten.includes("fields")
            ? flattenObj(returnData?.fieldNames)
            : returnData?.fieldNames
          : {},
        recordData: returnValues.includes("recordData")
          ? flatten.includes("recordData")
            ? flattenObj(returnData?.recordData)
            : returnData?.recordData
          : {},
      };
    });
  } catch (getFieldsAndDataError) {
    console.log({ getFieldsAndDataError });
  }
};

export async function getRecordDetailsSDK({ module, recordId }) {
  try {
    const recordResp = await ZOHO.CRM.API.getRecord({
      Entity: module,
      RecordID: recordId,
    });

    return { data: recordResp?.data?.[0], error: null };
  } catch (getRecordDetailsSDKError) {
    console.log({ getRecordDetailsSDKError });
    return { data: null, error: "Something went wrong" };
  }
}

export async function getRecordDetailsRestAPI({
  module,
  recordId,
  accessToken,
  dataCenterUrl,
}) {
  try {
    const url = `${dataCenterUrl}/crm/v6/${module}/${recordId}`;
    var req_data = {
      params: {},
      url,
      param_type: 1,
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    };
    const resp = await ZOHO.CRM.HTTP.get(req_data);
    const resp_json = await JSON.parse(resp);

    return {
      data: resp_json.data?.[0],
      error: null,
    };
  } catch (getRecordDetailsRestAPIErroe) {
    console.log({ getRecordDetailsRestAPIErroe });
    return { data: null, error: "Something went wrong" };
  }
}

export async function getBulkRecordDetailsRestAPI({ accessToken, url }) {
  //url = "https://www.zohoapis.com/crm/v6/Leads?ids=4731441000017895165,4731441000017895072,4731441000017139216,4731441000016814042,4731441000016814018,4731441000016543060,4731441000016023225,4731441000015988066,4731441000015982001,4731441000015981001,4731441000015979036,4731441000015979001,4731441000015964002,4731441000014979008,4731441000014471064,4731441000014471026,4731441000014471010,4731441000014300111,4731441000014300071,4731441000014300031&fields=Full_Name,Testing_Field,test_new_field,Email,Email_3,field_mapping_email,field_mapping_email_1,Company_Email,Client_Email"
  try {
    var req_data = {
      params: {},
      url,
      param_type: 1,
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    };
    const resp = await ZOHO.CRM.HTTP.get(req_data);
    const resp_json = await JSON.parse(resp);
    return {
      data: resp_json.data,
      error: null,
    };
  } catch (getBulkRecordDetailsRestAPIError) {
    console.log({ getBulkRecordDetailsRestAPIError });
    return { data: null, error: "Something went wrong" };
  }
}

export async function getFileFields({ module, accessToken, dataCenterUrl }) {
  const url = `${dataCenterUrl}/crm/v6/settings/fields?module=${module}`;
  try {
    var req_data = {
      url,
      param_type: 1,
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    };
    const resp = await ZOHO.CRM.HTTP.get(req_data);
    const resp_json = await JSON.parse(resp);
    const fields = await resp_json?.fields.filter(
      (el) => el.data_type === "fileupload" || el.data_type === "imageupload"
    );
    return {
      error: null,
      data: fields,
    };
  } catch (getFileFieldsError) {
    console.log({ getFileFieldsError });
    return { data: null, error: "Something went wrong" };
  }
}

export async function getEmailFields({ module, accessToken, dataCenterUrl }) {
  try {
    const url = `${dataCenterUrl}/crm/v6/settings/fields?module=${module}`;
    var req_data = {
      url,
      param_type: 1,
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    };
    const resp = await ZOHO.CRM.HTTP.get(req_data);
    const resp_json = await JSON.parse(resp);
    const emailFields = await resp_json?.fields.filter(
      (el) => el.data_type === "email"
    );
    return {
      error: null,
      data: emailFields,
    };
  } catch (getEmailFieldsError) {
    console.log({ getEmailFieldsError });
    return { data: null, error: "Something went wrong" };
  }
}

export async function getEmailAndFileFields({
  module,
  accessToken,
  dataCenterUrl,
}) {
  try {
    const url = `${dataCenterUrl}/crm/v6/settings/fields?module=${module}`;
    var req_data = {
      url,
      param_type: 1,
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    };
    const resp = await ZOHO.CRM.HTTP.get(req_data);
    const resp_json = await JSON.parse(resp);
    const emailFields = await resp_json?.fields.filter(
      (el) => el.data_type === "email"
    );
    const fileFields = await resp_json?.fields.filter(
      (el) => el.data_type === "fileupload" || el.data_type === "imageupload"
    );
    return {
      error: null,
      data: { emailFields, fileFields },
    };
  } catch (getEmailAndFileFieldsError) {
    console.log({ getEmailAndFileFieldsError });
    return { data: null, error: "Something went wrong" };
  }
}

export async function getRelatedListApis({
  module,
  accessToken,
  dataCenterUrl,
}) {
  try {
    const url = `${dataCenterUrl}/crm/v6/settings/related_lists?module=${module}`;
    var req_data = {
      url,
      param_type: 1,
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    };
    const resp = await ZOHO.CRM.HTTP.get(req_data);
    const resp_json = await JSON.parse(resp);
    const fArr = [
      "Notes",
      "Calls",
      "Tasks",
      "Events",
      "Products",
      "Calls_History",
      "Tasks_History",
      "Events_History",
    ];
    const data = resp_json.related_lists.filter(
      (el) =>
        !!el?.module &&
        !!el.href &&
        !!el.customize_fields &&
        !(el.type === "multiselectlookup") &&
        !fArr.includes(el.api_name) &&
        !el.api_name.includes("Cadences")
    );
    return {
      data,
      error: null,
    };
  } catch (getRelatedListApisError) {
    console.log({ getRelatedListApisError });
    return { data: null, error: "Something went wrong" };
  }
}

export async function getRecordsFromRelatedList({
  module,
  recordId,
  RelatedListAPI,
}) {
  try {
    const relatedListResp = await ZOHO.CRM.API.getRelatedRecords({
      Entity: module,
      RecordID: recordId,
      RelatedList: RelatedListAPI,
    });

    if (relatedListResp.statusText === "nocontent") {
      return { data: [], error: null };
    }

    if (!(relatedListResp.statusText === "nocontent")) {
      return { data: relatedListResp?.data, erroe: null };
    }
  } catch (getRecordsFromRelatedListError) {
    console.log({ getRecordsFromRelatedListError });
    return { data: null, error: "Something went wrong" };
  }
}

export const record = {
  getFieldsAndData,
  getRelatedListApis,
  getRecordDetailsRestAPI,
  getBulkRecordDetailsRestAPI,
  getFileFields,
  getEmailFields,
  getEmailAndFileFields,
  getRecordsFromRelatedList,
};
