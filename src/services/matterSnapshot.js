/**
 * Fetches the primary Matter (Applications module) for a Contact and builds
 * snapshot fields to store on History1 at creation time.
 */
import {
  CONTACT_MATTERS_RELATED_LIST,
  HISTORY_MATTER_FIELDS,
  MATTER_SOURCE_FIELDS,
} from "../config/config";

const ZOHO = window.ZOHO;

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
    MATTER_SOURCE_FIELDS.currentStage,
    MATTER_SOURCE_FIELDS.matterProgress,
    MATTER_SOURCE_FIELDS.modifiedTime,
    MATTER_SOURCE_FIELDS.createdTime,
  ].join(",");

  const response = await ZOHO.CRM.API.getRelatedRecords({
    Entity: "Contacts",
    RecordID: contactId,
    RelatedList: CONTACT_MATTERS_RELATED_LIST,
    page: 1,
    per_page: 200,
    fields: fieldList,
  });

  return Array.isArray(response?.data) ? response.data : [];
};

const formatMultiSelect = (value) => {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return String(value);
};

/**
 * Build History1 matter snapshot payload from a Matter record.
 */
export const buildMatterSnapshotFields = (matter) => {
  if (!matter?.id) return {};

  const { matterLookup, matterNo, currentStage, matterProgress } =
    HISTORY_MATTER_FIELDS;
  const src = MATTER_SOURCE_FIELDS;

  return {
    [matterLookup]: { id: matter.id },
    [matterNo]: matter[src.matterNo] || null,
    [currentStage]: matter[src.currentStage] || null,
    [matterProgress]: formatMultiSelect(matter[src.matterProgress]),
  };
};

/**
 * Resolve matter snapshot fields for a contact at history creation time.
 */
export const resolveMatterSnapshotForContact = async (contactId) => {
  try {
    const matters = await fetchContactMatters(contactId);
    const matter = selectPrimaryMatter(matters);
    return buildMatterSnapshotFields(matter);
  } catch (error) {
    console.warn("Could not resolve matter snapshot for history create:", error);
    return {};
  }
};
