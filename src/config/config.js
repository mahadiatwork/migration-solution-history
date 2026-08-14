export const dataCenterMap = {
  US: "https://www.zohoapis.com",
  EU: "https://www.zohoapis.eu",
  AU: "https://www.zohoapis.com.au",
  IN: "https://www.zohoapis.in",
  China: "https://www.zohoapis.com.cn",
  JP: "https://www.zohoapis.jp",
};

export const conn_name = "zoho_crm_conn";

// Applications_History module: API name for the Stakeholder/Account lookup field.
// If stakeholder doesn't transfer when moving history, change to your module's field API name
// (e.g. "Account", "Stakeholder1", "Related_Account"). Check Setup > Developer Hub > API Names.
export const APPLICATIONS_HISTORY_STAKEHOLDER_FIELD = "Stakeholder";

// Related list API name for Applications_History on the Applications module.
// Used when the widget is embedded on Applications to fetch history records.
// Try "Application_History" or "Applications_History" depending on your Zoho setup.
export const APPLICATIONS_RELATED_LIST_HISTORY = "Application_History";

// Module entity names that indicate the widget is on an Application record.
// Zoho returns Entity from PageLoad - add variants if your setup uses different names.
export const APPLICATIONS_MODULE_NAMES = ["Applications", "Applications1", "Deals"];

// Related list on Contacts linking to Matters (Applications module).
export const CONTACT_MATTERS_RELATED_LIST = "Applications";

// History1 custom fields for matter snapshot at creation time.
// Create these fields in Zoho CRM (Setup > Developer Hub > Fields) if not present.
export const HISTORY_MATTER_FIELDS = {
  matterLookup: "Matter",
  matterNo: "Matter_No",
  currentStage: "Current_Stage",
  matterProgress: "Matter_Progress",
};

// Applications (Matters) module fields read when building the snapshot.
export const MATTER_SOURCE_FIELDS = {
  id: "id",
  matterNo: "Name",
  currentStage: "Current_Stage",
  matterProgress: "Matter_Progress",
  modifiedTime: "Modified_Time",
  createdTime: "Created_Time",
};

// ============================================================================
// Admin-Configurable Picklist Config Module
// ============================================================================
// Zoho CRM custom module that stores picklist entries for the widget.
// Admin users can add/edit/remove entries without code changes.
// If this module doesn't exist or has no records, the widget falls back
// to the hard-coded defaults in dialogConstants.js / helperFunc.js.
export const PICKLIST_CONFIG_MODULE = "Widget_Picklist_Config";

// Field API names on the Widget_Picklist_Config module
export const PICKLIST_CONFIG_FIELDS = {
  name: "Name",              // The picklist entry value (e.g. "Meeting", "Call Completed")
  category: "Category",      // Which picklist: "Type", "Result", "Regarding", "Duration"
  parentType: "Parent_Type",  // For Result/Regarding: which Type this belongs to (e.g. "Meeting")
  sortOrder: "Sort_Order",    // Display order (lower = first)
  active: "Active",           // Whether this entry is active/visible (boolean)
};

// Categories used in the Widget_Picklist_Config module
export const PICKLIST_CATEGORIES = {
  TYPE: "Type",
  RESULT: "Result",
  REGARDING: "Regarding",
  DURATION: "Duration",
};

export const access_token_api_url =
  "https://api.easy-pluginz.com.au/admin/v2/data/zoho/crm/downloadattachment";

export const access_token_url =
  "https://www.zohoapis.com.au/crm/v2/functions/getaccesstoken/actions/execute?auth_type=apikey&zapikey=1003.36fcc30cd4dabc6754397103d572d959.45911087afc5315f107424ed9617687b";
