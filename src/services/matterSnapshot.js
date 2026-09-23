/**
 * Fetches the primary Matter (Applications module) for a Contact and builds
 * snapshot fields to store on History1 at creation time.
 */
import {
  CONTACT_MATTERS_RELATED_LIST,
  HISTORY_MATTER_FIELDS,
  MATTERS_MODULE,
  MATTER_SOURCE_FIELDS,
} from "../config/config";

const getZoho = () => window.ZOHO;

/**
 * Pick the most relevant matter when a contact has multiple.
 * Prefers the most recently modified record.
 */
export const selectPrimaryMatter = (matters = []) => {
  if (!Array.isArray(matters) || matters.length === 0) return null;
  if (matters.length === 1) return matters[0];

  const { modifiedTime, createdTime } = MATTER_SOURCE_FIELDS;

  return [...matters].sort((a, b) => {
    const aTime = new Date(a?.[modifiedTime] || a?.[createdTime] || 0).getTime();
    const bTime = new Date(b?.[modifiedTime] || b?.[createdTime] || 0).getTime();
    return bTime - aTime;
  })[0];
};

/**
 * Fetch related Matters (Applications) for a contact.
 */
export const fetchContactMatters = async (contactId) => {
  if (!contactId) return [];

  const fieldList = [
    MATTER_SOURCE_FIELDS.id,
    MATTER_SOURCE_FIELDS.matterNo,
    MATTER_SOURCE_FIELDS.modifiedTime,
    MATTER_SOURCE_FIELDS.createdTime,
  ].join(",");

  const response = await getZoho().CRM.API.getRelatedRecords({
    Entity: "Contacts",
    RecordID: contactId,
    RelatedList: CONTACT_MATTERS_RELATED_LIST,
    page: 1,
    per_page: 200,
    fields: fieldList,
  });

  return Array.isArray(response?.data) ? response.data : [];
};

/** Fetch one Matter record without mutating it. Used to identify its layout. */
export const fetchMatterById = async (matterId) => {
  if (!matterId) return null;

  const response = await getZoho().CRM.API.getRecord({
    Entity: MATTERS_MODULE,
    approved: "both",
    RecordID: matterId,
  });

  return response?.data?.[0] || null;
};

/** Serialize a Zoho multi-select picklist value for create/update requests. */
export const serializeMultiSelectPicklist = (value) => {
  const values = Array.isArray(value) ? value : [value];
  const seen = new Set();
  const serialized = [];

  values.forEach((item) => {
    if (item == null) return;
    const rawValue =
      typeof item === "object"
        ? item.actual_value ?? item.display_value ?? item.value ?? item.name
        : item;
    if (rawValue == null) return;
    const normalized = String(rawValue).trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    serialized.push(normalized);
  });

  return serialized.length > 0 ? serialized : null;
};

/** The Contact History dialog intentionally edits one progress value at a time. */
export const normalizeSingleMultiSelectValue = (value) =>
  serializeMultiSelectPicklist(value)?.[0] || "";

/**
 * Build History1 matter snapshot payload from a Matter record.
 */
export const buildMatterSnapshotFields = (matter) => {
  if (!matter?.id) return {};

  const { matterNo, currentStage, matterProgress } = HISTORY_MATTER_FIELDS;
  const src = MATTER_SOURCE_FIELDS;

  return {
    [matterNo]: matter[src.matterNo] || null,
    [currentStage]: matter[src.currentStage] || null,
    [matterProgress]: serializeMultiSelectPicklist(matter[src.matterProgress]),
  };
};

/**
 * Resolve both the selected source Matter and the History1 snapshot payload.
 * Keeping the record alongside the payload lets the dialog use the source
 * Matter's layout metadata without a second related-list request.
 */
export const resolveMatterContextForContact = async (contactId) => {
  try {
    const matters = await fetchContactMatters(contactId);
    const relatedMatter = selectPrimaryMatter(matters);
    let matter = relatedMatter;
    if (relatedMatter?.id) {
      try {
        matter = (await fetchMatterById(relatedMatter.id)) || relatedMatter;
      } catch (error) {
        console.warn("Could not hydrate related Matter record:", error);
      }
    }
    return {
      matter,
      snapshot: buildMatterSnapshotFields(matter),
    };
  } catch (error) {
    console.warn("Could not resolve matter context for history create:", error);
    return { matter: null, snapshot: {} };
  }
};

/**
 * Resolve matter snapshot fields for a contact at history creation time.
 */
export const resolveMatterSnapshotForContact = async (contactId) => {
  const { snapshot } = await resolveMatterContextForContact(contactId);
  return snapshot;
};
