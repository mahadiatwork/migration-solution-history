
/**
 * Helper Functions for Dialog Picklists
 *
 * These functions return picklist options for Result and Regarding dropdowns.
 * They support two modes:
 *   1. Config-driven: When an admin config object is passed, options come from
 *      the Widget_Picklist_Config Zoho CRM module.
 *   2. Hard-coded fallback: When no config is passed (or config has no entries
 *      for the given type), the original ACT-migrated hard-coded values are used.
 */

/**
 * Get result options for a given history type.
 * @param {string} type - The selected history type (e.g. "Meeting")
 * @param {Object|null} [config] - Admin picklist config from picklistConfigService
 * @returns {string[]} Array of result option values
 */
export const getResultOptions = (type, config) => {
  // If admin config is available and has results for this type, use them
  if (config?.results) {
    const typeResults = config.results[type];
    if (typeResults && typeResults.length > 0) {
      return typeResults;
    }
    // Check for default results (entries with no specific parent type)
    const defaultResults = config.results["_default"];
    if (defaultResults && defaultResults.length > 0) {
      return defaultResults;
    }
  }

  // Fall back to hard-coded ACT-migrated values
  switch (type) {
    case "Meeting":
      return ["Meeting Held", "Meeting Not Held"]; // Wrap in an array
    case "To-Do":
      return ["To-do Done", "To-do Not Done"];
    case "Appointment":
      return ["Appointment Completed", "Appointment Not Completed"];
    case "Boardroom":
      return ["Boardroom - Completed","Boardroom - Not Completed"];
    case "Call Billing":
      return ["Call Billing - Completed", "Call Billing - Not Completed"];
    case "Email Billing":
      return ["Email Billing - Completed", "Email Billing - Not Completed"];
    case "Initial Consultation":
      return ["Initial Consultation - Completed", "Initial Consultation - Not Completed"];
    case "Call":
      return ["Call Attempted","Call Completed", "Call Left Message", "Call Received"];
    case "Mail":
      return ["Mail - Completed", "Mail - Not Completed"];
    case "Meeting Billing":
      return ["Meeting Billing - Completed", "Meeting Billing - Not Completed"];
    case "Personal Activity":
      return ["Personal Activity - Completed", "Personal Activity - Not Completed", "Note", "Mail Received", "Mail Sent", "Email Received", "Courier Sent", "Email Sent", "Payment Received"];
    case "To Do Billing":
      return ["To Do Billing - Completed","To Do Billing - Not Completed"];
    case "Vacation":
      return ["Vacation - Completed", "Vacation - Not Completed", "Vacation Cancelled"];
    case "Room 1":
    case "Room 2":
    case "Room 3":
      return [`${type} - Completed`,`${type} - Not Completed`]; // Wrap in an array
    case "Other":
      return ["Attachment", "E-mail Attachment", "E-mail Auto Attached", "E-mail Sent"];
    default:
      return ["Note"]; // Wrap default return in an array
  }
};

/**
 * Get regarding options for a given history type.
 * @param {string} type - The selected history type (e.g. "Call")
 * @param {string} [existingValue] - Existing regarding value (for edit mode)
 * @param {Object|null} [config] - Admin picklist config from picklistConfigService
 * @returns {string[]} Array of regarding option values
 */
export const getRegardingOptions = (type, existingValue, config) => {
  // If admin config is available and has regarding options for this type, use them
  if (config?.regarding) {
    const typeRegarding = config.regarding[type];
    if (typeRegarding && typeRegarding.length > 0) {
      let options = [...typeRegarding];
      // Ensure existing value is included if not already present
      const safeValue = typeof existingValue === "string" ? existingValue : "";
      if (safeValue.trim() !== "" && !options.includes(safeValue)) {
        options = [safeValue, ...options];
      }
      return options;
    }
    // Check for default regarding (entries with no specific parent type)
    const defaultRegarding = config.regarding["_default"];
    if (defaultRegarding && defaultRegarding.length > 0) {
      let options = [...defaultRegarding];
      const safeValue = typeof existingValue === "string" ? existingValue : "";
      if (safeValue.trim() !== "" && !options.includes(safeValue)) {
        options = [safeValue, ...options];
      }
      return options;
    }
  }

  // Fall back to hard-coded ACT-migrated values
  const options = {
    Call: [
      "2nd Followup", "3rd Followup", "4th Followup", "5th Followup",
      "Cold call", "Confirm appointment", "Discuss legal points", "Follow up",
      "New Client", "Nomination and Visa Lodgement", "Payment Made?",
      "Returning call", "Schedule a meeting"
    ],
    Meeting: [
      "Hourly Consult $220", "Initial Consultation Fee $165.00",
      "No appointments today (check with Mark)", "No Appointments Tonight",
      "No clients or appointments 4.00-5.00pm"
    ],
    "To-Do": [
      "Assemble catalogs", "DEADLINE REMINDER", "Deadline to lodge app",
      "Deadline to provide additional docu", "Deadline to respond",
      "DEADLINE TODAY - Email received", "Make travel arrangements",
      "Send contract", "Send follow-up letter", "Send literature",
      "Send proposal", "Send quote", "Send SMS reminder"
    ],
    Appointment: [
      "Appointment", "Call", "Dentist Appointment", "Doctor Appointment",
      "Eye Doctor Appointment", "Make Appointment", "Meeting",
      "Parent-Teacher Conference", "Shopping", "Time Off", "Workout"
    ]
  };

  let predefinedOptions = options[type] || ["General"];

  // Only add existingValue if it's not empty and not already in the options
  const safeValue = typeof existingValue === "string" ? existingValue : "";
  if (safeValue.trim() !== "" && !predefinedOptions.includes(safeValue)) {
    predefinedOptions = [safeValue, ...predefinedOptions];
  }

  return predefinedOptions;
};

