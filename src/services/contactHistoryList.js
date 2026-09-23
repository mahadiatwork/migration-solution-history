/**
 * Stable fields used by the Contact History list.
 *
 * Matter snapshot fields are hydrated from History1 when the edit dialog opens.
 * Keeping them out of this junction query prevents an optional/missing CRM field
 * from making every history row disappear.
 */
export const CONTACT_HISTORY_CORE_SELECT = [
  "Name",
  "id",
  "Contact_History_Info.id",
  "Owner.first_name",
  "Owner.last_name",
  "Contact_Details.Full_Name",
  "Contact_History_Info.History_Type",
  "Contact_History_Info.History_Result",
  "Contact_History_Info.Duration",
  "Contact_History_Info.Regarding",
  "Contact_History_Info.History_Details_Plain",
  "Contact_History_Info.Date",
  "Contact_History_Info.Stakeholder",
].join(",");

// Prefer the owner of History1 rather than the owner of its junction row. The
// core list remains available as a fallback for orgs that reject nested joins.
export const CONTACT_HISTORY_SELECT = [
  CONTACT_HISTORY_CORE_SELECT,
  "Contact_History_Info.Owner.first_name",
  "Contact_History_Info.Owner.last_name",
].join(",");

export const getCoqlOwnerName = (row = {}) => {
  const firstName =
    row["Contact_History_Info.Owner.first_name"] ||
    row["Owner.first_name"] ||
    "";
  const lastName =
    row["Contact_History_Info.Owner.last_name"] ||
    row["Owner.last_name"] ||
    "";
  return `${firstName} ${lastName}`.trim() || "Unknown Owner";
};

export const requireSuccessfulCoqlPage = (page, pageLabel = "history") => {
  if (page?.errorCode) {
    throw new Error(
      `COQL failed for ${pageLabel}: ${page.errorCode}${
        page.errorMessage ? ` ${page.errorMessage}` : ""
      }`
    );
  }
  return Array.isArray(page?.data) ? page.data : [];
};
