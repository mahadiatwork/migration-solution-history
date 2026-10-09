import { APPLICATIONS_HISTORY_STAKEHOLDER_FIELD } from "../config/config";

const ATTACHMENT_COPY_FUNCTION =
  "copy_attachment_form_contact_history_to_applicatio";

const lookupId = (value) => {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  const id = value.id ?? value.Id ?? value.ID;
  return id == null ? null : String(id);
};

const apiError = (response, fallback) =>
  response?.data?.[0]?.message || response?.message || fallback;

export const requireMoveSuccess = (response, label) => {
  if (response?.data?.[0]?.code !== "SUCCESS") {
    throw new Error(apiError(response, `${label} failed.`));
  }
  return response.data[0];
};

const getRecord = async (zoho, entity, recordId) => {
  const response = await zoho.CRM.API.getRecord({
    Entity: entity,
    RecordID: recordId,
    approved: "both",
  });
  const record = response?.data?.[0];
  if (!record?.id) throw new Error(`Could not load ${entity} ${recordId}.`);
  return record;
};

const getRelatedJunctions = async (
  zoho,
  entity,
  historyId,
  relatedList
) => {
  const junctions = [];
  for (let page = 1; page <= 50; page += 1) {
    const response = await zoho.CRM.API.getRelatedRecords({
      Entity: entity,
      RecordID: historyId,
      RelatedList: relatedList,
      page,
      per_page: 200,
    });
    if (response?.statusText === "nocontent") break;
    if (!Array.isArray(response?.data)) {
      throw new Error(`Could not load all ${entity} Contact links.`);
    }
    junctions.push(...response.data);
    if (
      page === 50 &&
      response.data.length === 200 &&
      response?.info?.more_records !== false
    ) {
      throw new Error("Contact links exceed the supported page limit.");
    }
    if (
      response?.info?.more_records === false ||
      (response?.info?.more_records !== true && response.data.length < 200)
    ) {
      break;
    }
  }
  return junctions;
};

const getContactJunctions = async (zoho, historyId, allowEmpty = false) => {
  const junctions = await getRelatedJunctions(
    zoho,
    "History1",
    historyId,
    "Contacts3"
  );
  if (!allowEmpty && junctions.length === 0) {
    throw new Error("This history has no Contact links to transfer.");
  }
  if (junctions.some((junction) => !junction?.id || !lookupId(junction.Contact_Details))) {
    throw new Error("A source Contact link is incomplete; the move was cancelled.");
  }
  return junctions;
};

const normalizeProgress = (value) => {
  const first = Array.isArray(value) ? value[0] : value;
  if (first == null) return "";
  if (typeof first === "object") {
    return String(
      first.actual_value ?? first.display_value ?? first.value ?? first.name ?? ""
    ).trim();
  }
  return String(first).trim();
};

export const serializeApplicationProgress = (value, fieldType) => {
  const selected = normalizeProgress(value);
  if (!selected) return null;
  return fieldType === "multiselectpicklist" ? [selected] : selected;
};

const getApplicationProgressFieldType = async (zoho, matter) => {
  const fallback = Array.isArray(matter.Matter_Progress)
    ? "multiselectpicklist"
    : "picklist";
  if (typeof zoho.CRM.META?.getFields !== "function") return fallback;
  try {
    const response = await zoho.CRM.META.getFields({
      Entity: "Applications_History",
    });
    const fields = response?.fields || response?.data?.fields || response?.data;
    const field = Array.isArray(fields)
      ? fields.find((item) => item.api_name === "Matter_Progress")
      : null;
    return field?.data_type || fallback;
  } catch {
    return fallback;
  }
};

const readAttachments = async (listAttachments, entity, recordId) => {
  const response = await listAttachments({
    module: entity,
    recordId,
    strict: true,
  });
  if (response?.error || !Array.isArray(response?.data)) {
    throw new Error(`Could not inspect ${entity} attachments.`);
  }
  return response.data;
};

const attachmentsMatch = (source, target) => {
  if (target.length < source.length) return false;
  const names = (records) => records.map((record) => {
    const name = record?.File_Name || record?.file_name;
    if (!name) {
      throw new Error("CRM returned an attachment without a file name.");
    }
    return name;
  });
  const sourceNames = names(source);
  const targetNames = names(target);
  return sourceNames.every((name) => {
    const sourceCount = sourceNames.filter((item) => item === name).length;
    const targetCount = targetNames.filter((item) => item === name).length;
    return targetCount >= sourceCount;
  });
};

const rollbackTarget = async (zoho, targetId, junctionIds) => {
  const errors = [];
  for (const junctionId of junctionIds) {
    try {
      requireMoveSuccess(
        await zoho.CRM.API.deleteRecord({
          Entity: "Application_Hstory",
          RecordID: junctionId,
        }),
        "Target Contact link cleanup"
      );
    } catch (error) {
      errors.push(error.message);
    }
  }
  try {
    requireMoveSuccess(
      await zoho.CRM.API.deleteRecord({
        Entity: "Applications_History",
        RecordID: targetId,
      }),
      "Target history cleanup"
    );
  } catch (error) {
    errors.push(error.message);
  }
  return errors;
};

const restoreSourceLinks = async (zoho, sourceHistoryId, sourceJunctions, source) => {
  const errors = [];
  try {
    await getRecord(zoho, "History1", sourceHistoryId);
    const current = await getContactJunctions(zoho, sourceHistoryId, true);
    const existingIds = new Set(current.map((junction) =>
      lookupId(junction.Contact_Details)
    ));
    for (const junction of sourceJunctions) {
      const contactId = lookupId(junction.Contact_Details);
      if (existingIds.has(contactId)) continue;
      requireMoveSuccess(
        await zoho.CRM.API.insertRecord({
          Entity: "History_X_Contacts",
          APIData: {
            Contact_History_Info: { id: sourceHistoryId },
            Contact_Details: { id: contactId },
            Owner: { id: lookupId(source.Owner) },
            Stakeholder: lookupId(source.Stakeholder)
              ? { id: lookupId(source.Stakeholder) }
              : null,
          },
          Trigger: ["workflow"],
        }),
        `Source Contact link ${contactId} restoration`
      );
      existingIds.add(contactId);
    }
  } catch (error) {
    errors.push(error.message);
  }
  return errors;
};

export const buildApplicationMoveData = (source, matter, progressFieldType) => {
  const ownerId = lookupId(source.Owner);
  if (!ownerId) throw new Error("The source history Owner could not be resolved.");
  const stakeholderId = lookupId(source.Stakeholder);
  return {
    Name: source.Name || matter.Name || "History",
    Application: { id: String(matter.id) },
    History_Details: source.History_Details_Plain ?? "",
    History_Result: source.History_Result ?? null,
    History_Type: source.History_Type ?? null,
    Regarding: source.Regarding ?? null,
    Duration_Min: source.Duration ?? null,
    Date: source.Date ?? null,
    Owner: { id: ownerId },
    [APPLICATIONS_HISTORY_STAKEHOLDER_FIELD]: stakeholderId
      ? { id: stakeholderId }
      : null,
    Matter_No: matter.Name ?? null,
    Current_Stage: matter.Current_Stage ?? null,
    Matter_Progress: serializeApplicationProgress(
      matter.Matter_Progress,
      progressFieldType
    ),
    Billing_Type: source.Billing_Type || "Billable",
  };
};

const sameFieldValue = (field, expected, actual) => {
  if (expected == null || expected === "") {
    return actual == null || actual === "";
  }
  if (field === "Date") {
    const expectedTime = Date.parse(expected);
    const actualTime = Date.parse(actual);
    if (!Number.isNaN(expectedTime) && !Number.isNaN(actualTime)) {
      return expectedTime === actualTime;
    }
  }
  if (field === "Matter_Progress") {
    return normalizeProgress(expected) === normalizeProgress(actual);
  }
  return String(expected) === String(actual);
};

const verifyDestination = async (
  zoho,
  targetId,
  targetMatterId,
  payload,
  contactIds
) => {
  const target = await getRecord(zoho, "Applications_History", targetId);
  if (lookupId(target.Application) !== String(targetMatterId)) {
    throw new Error("Destination Matter association could not be verified.");
  }
  for (const field of [
    "Name",
    "History_Details",
    "History_Result",
    "History_Type",
    "Regarding",
    "Duration_Min",
    "Date",
    "Matter_No",
    "Current_Stage",
    "Matter_Progress",
    "Billing_Type",
  ]) {
    if (!sameFieldValue(field, payload[field], target[field])) {
      throw new Error(`Destination ${field} could not be verified.`);
    }
  }
  if (lookupId(target.Owner) !== lookupId(payload.Owner)) {
    throw new Error("Destination Owner could not be verified.");
  }
  const expectedStakeholder = payload[APPLICATIONS_HISTORY_STAKEHOLDER_FIELD];
  if (lookupId(target[APPLICATIONS_HISTORY_STAKEHOLDER_FIELD]) !==
      lookupId(expectedStakeholder)) {
    throw new Error("Destination Stakeholder could not be verified.");
  }

  const targetJunctions = await getRelatedJunctions(
    zoho,
    "Applications_History",
    targetId,
    "Contacts4"
  );
  const actualContactIds = new Set(targetJunctions.map((junction) =>
    lookupId(junction.Contact ?? junction.Contact_Details)
  ));
  if (actualContactIds.size !== contactIds.length ||
      contactIds.some((id) => !actualContactIds.has(id))) {
    throw new Error("Destination Contact links could not be verified.");
  }
};

/** Move one History1 entry into a Matter's Applications_History. */
export const moveContactHistoryToApplication = async ({
  zoho,
  sourceHistoryId,
  targetMatterId,
  listAttachments,
  delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) => {
  if (!sourceHistoryId || !targetMatterId || !listAttachments) {
    throw new Error("A source history and destination Matter are required.");
  }

  const source = await getRecord(zoho, "History1", sourceHistoryId);
  const matter = await getRecord(zoho, "Applications", targetMatterId);
  const sourceJunctions = await getContactJunctions(zoho, sourceHistoryId);
  const sourceAttachments = await readAttachments(
    listAttachments,
    "History1",
    sourceHistoryId
  );
  const progressFieldType = await getApplicationProgressFieldType(zoho, matter);
  const payload = buildApplicationMoveData(source, matter, progressFieldType);
  let targetId = null;
  const targetJunctionIds = [];
  const contactIds = [...new Set(sourceJunctions.map((junction) =>
    lookupId(junction.Contact_Details)
  ))];

  try {
    const create = requireMoveSuccess(
      await zoho.CRM.API.insertRecord({
        Entity: "Applications_History",
        APIData: payload,
        Trigger: ["workflow"],
      }),
      "Destination history creation"
    );
    targetId = create.details?.id;
    if (!targetId) throw new Error("Destination history ID was not returned.");

    for (const contactId of contactIds) {
      const link = requireMoveSuccess(
        await zoho.CRM.API.insertRecord({
          Entity: "Application_Hstory",
          APIData: {
            Application_Hstory: { id: targetId },
            Contact: { id: contactId },
          },
          Trigger: ["workflow"],
        }),
        `Destination Contact link for ${contactId}`
      );
      if (!link.details?.id) {
        throw new Error("Destination Contact link ID was not returned.");
      }
      targetJunctionIds.push(link.details.id);
    }

    if (sourceAttachments.length > 0) {
      await zoho.CRM.FUNCTIONS.execute(ATTACHMENT_COPY_FUNCTION, {
        arguments: JSON.stringify({
          fromModule: "History1",
          toModule: "Applications_History",
          fromID: sourceHistoryId,
          ToID: targetId,
        }),
      });
      let copied = false;
      for (const waitMs of [0, 250, 750, 1500]) {
        if (waitMs) await delay(waitMs);
        const targetAttachments = await readAttachments(
          listAttachments,
          "Applications_History",
          targetId
        );
        if (attachmentsMatch(sourceAttachments, targetAttachments)) {
          copied = true;
          break;
        }
      }
      if (!copied) throw new Error("Destination attachments could not be verified.");
    }

    let verificationError;
    for (const waitMs of [0, 250, 750, 1500]) {
      if (waitMs) await delay(waitMs);
      try {
        await verifyDestination(
          zoho,
          targetId,
          targetMatterId,
          payload,
          contactIds
        );
        verificationError = null;
        break;
      } catch (error) {
        verificationError = error;
      }
    }
    if (verificationError) throw verificationError;
  } catch (error) {
    if (!targetId) throw error;
    const cleanupErrors = await rollbackTarget(zoho, targetId, targetJunctionIds);
    const suffix = cleanupErrors.length
      ? ` Cleanup needs attention for Applications_History ${targetId}: ${cleanupErrors.join("; ")}`
      : " The source history was kept.";
    throw new Error(`${error.message}${suffix}`);
  }

  try {
    for (const junction of sourceJunctions) {
      requireMoveSuccess(
        await zoho.CRM.API.deleteRecord({
          Entity: "History_X_Contacts",
          RecordID: junction.id,
        }),
        `Source Contact link ${junction.id} deletion`
      );
    }
    requireMoveSuccess(
      await zoho.CRM.API.deleteRecord({
        Entity: "History1",
        RecordID: sourceHistoryId,
      }),
      "Source history deletion"
    );
  } catch (error) {
    const restoreErrors = await restoreSourceLinks(
      zoho,
      sourceHistoryId,
      sourceJunctions,
      source
    );
    const cleanupErrors = restoreErrors.length
      ? []
      : await rollbackTarget(zoho, targetId, targetJunctionIds);
    if (restoreErrors.length === 0 && cleanupErrors.length === 0) {
      throw new Error(`Move failed: ${error.message} The source was restored.`);
    }
    throw new Error(
      `Move incomplete: ${error.message} Source History1 ${sourceHistoryId} and ` +
      `destination Applications_History ${targetId} need review. ` +
      [...restoreErrors, ...cleanupErrors].join("; ")
    );
  }

  return { sourceHistoryId, targetHistoryId: targetId };
};
