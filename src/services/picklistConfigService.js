/**
 * Picklist Configuration Service
 * 
 * Fetches picklist entries from the Zoho CRM Widget_Picklist_Config custom module.
 * Admin users can manage picklist items (Type, Result, Regarding, Duration)
 * via this module without requiring code changes.
 * 
 * Falls back to hard-coded defaults (from dialogConstants.js / helperFunc.js)
 * if the module doesn't exist or has no records.
 */
import {
  PICKLIST_CONFIG_MODULE,
  PICKLIST_CONFIG_FIELDS,
  PICKLIST_CATEGORIES,
  dataCenterMap,
  conn_name,
} from "../config/config";
import {
  typeOptions as defaultTypeOptions,
  resultMapping as defaultResultMapping,
  durationOptions as defaultDurationOptions,
} from "../components/organisms/dialogConstants";

const ZOHO = window.ZOHO;

// ============================================================================
// In-memory cache — fetched once per widget load
// ============================================================================
let cachedConfig = null;
let fetchPromise = null; // Prevent duplicate concurrent fetches

/**
 * Fetch all active picklist config records from Zoho CRM.
 * Uses COQL v8 for efficient bulk retrieval, with fallback to getRecords.
 * Results are cached in memory for the widget session.
 *
 * @returns {Promise<Object>} Grouped config: { types, results, regarding, durations }
 */
export const fetchPicklistConfig = async () => {
  // Return cached config if already fetched
  if (cachedConfig) return cachedConfig;

  // Prevent duplicate concurrent fetches (e.g. dialog + app both call at once)
  if (fetchPromise) return fetchPromise;

  fetchPromise = _doFetch();

  try {
    cachedConfig = await fetchPromise;
    return cachedConfig;
  } finally {
    fetchPromise = null;
  }
};

/**
 * Force-refresh the cached config (e.g. after admin makes changes).
 */
export const clearPicklistConfigCache = () => {
  cachedConfig = null;
  fetchPromise = null;
};

// ============================================================================
// Internal fetch logic
// ============================================================================
const _doFetch = async () => {
  try {
    const records = await _fetchViaCoql();

    if (!records || records.length === 0) {
      console.info(
        "Widget_Picklist_Config: No records found or module not available. Using hard-coded defaults."
      );
      return _buildFallbackConfig();
    }

    console.info(
      `Widget_Picklist_Config: Loaded ${records.length} picklist config record(s) from Zoho CRM.`
    );

    return _groupRecords(records);
  } catch (error) {
    console.warn(
      "Widget_Picklist_Config: Failed to fetch config. Falling back to defaults.",
      error
    );
    return _buildFallbackConfig();
  }
};

/**
 * Fetch records via COQL v8 API (supports up to 2000 records).
 */
const _fetchViaCoql = async () => {
  const { name, category, parentType, sortOrder, active } =
    PICKLIST_CONFIG_FIELDS;

  const selectQuery = `select ${name}, ${category}, ${parentType}, ${sortOrder}, ${active} from ${PICKLIST_CONFIG_MODULE} where ${active} = true order by ${sortOrder} asc LIMIT 0, 2000`;

  try {
    const req_data = {
      url: `${dataCenterMap.AU}/crm/v8/coql`,
      method: "POST",
      param_type: 2,
      parameters: { select_query: selectQuery },
    };

    const response = await ZOHO.CRM.CONNECTION.invoke(conn_name, req_data);

    // Parse the COQL response (same pattern as App.js parseCoqlV8Response)
    let data = [];

    const rawStatusMessage = response?.details?.statusMessage;
    let parsedStatusMessage = rawStatusMessage;
    if (typeof rawStatusMessage === "string" && rawStatusMessage.trim()) {
      try {
        parsedStatusMessage = JSON.parse(rawStatusMessage);
      } catch {
        parsedStatusMessage = null;
      }
    }

    if (parsedStatusMessage && typeof parsedStatusMessage === "object") {
      if (Array.isArray(parsedStatusMessage.data)) {
        data = parsedStatusMessage.data;
      }
    }

    if (Array.isArray(response?.data) && response.data.length >= data.length) {
      data = response.data;
    }

    return data;
  } catch (coqlError) {
    console.warn("COQL fetch for picklist config failed, trying getRecords fallback:", coqlError);
    return _fetchViaGetRecords();
  }
};

/**
 * Fallback: Fetch records via standard getRecords API.
 */
const _fetchViaGetRecords = async () => {
  try {
    const response = await ZOHO.CRM.API.getRecords({
      Entity: PICKLIST_CONFIG_MODULE,
      sort_order: "asc",
      sort_by: PICKLIST_CONFIG_FIELDS.sortOrder,
      per_page: 200,
      page: 1,
    });

    if (response?.data && Array.isArray(response.data)) {
      // Filter to active records only
      return response.data.filter(
        (r) => r[PICKLIST_CONFIG_FIELDS.active] === true
      );
    }
    return [];
  } catch {
    return [];
  }
};

// ============================================================================
// Record grouping
// ============================================================================

/**
 * Group raw Zoho records into structured config object.
 * @param {Array} records - Raw records from Widget_Picklist_Config
 * @returns {Object} { types, results, regarding, durations, _fromAdmin: true }
 */
const _groupRecords = (records) => {
  const { name, category, parentType, sortOrder } = PICKLIST_CONFIG_FIELDS;
  const { TYPE, RESULT, REGARDING, DURATION } = PICKLIST_CATEGORIES;

  const types = [];
  const results = {}; // { [parentType]: [resultValue, ...] }
  const regarding = {}; // { [parentType]: [regardingValue, ...] }
  const durations = [];

  // Pre-sort by sortOrder (COQL already sorts, but ensure consistent ordering)
  const sorted = [...records].sort(
    (a, b) => (a[sortOrder] || 9999) - (b[sortOrder] || 9999)
  );

  for (const record of sorted) {
    const cat = record[category];
    const value = record[name];
    const parent = record[parentType] || "_default";

    if (!value) continue;

    switch (cat) {
      case TYPE:
        types.push(value);
        break;

      case RESULT:
        if (!results[parent]) results[parent] = [];
        results[parent].push(value);
        break;

      case REGARDING:
        if (!regarding[parent]) regarding[parent] = [];
        regarding[parent].push(value);
        break;

      case DURATION:
        const num = parseInt(value, 10);
        if (!isNaN(num)) durations.push(num);
        break;

      default:
        console.warn(`Unknown picklist category: ${cat} for entry "${value}"`);
    }
  }

  // Build result mapping (type -> default result, first result for each type)
  const resultMapping = {};
  for (const [parent, resultList] of Object.entries(results)) {
    if (parent !== "_default" && resultList.length > 0) {
      resultMapping[parent] = resultList[0];
    }
  }

  return {
    types: types.length > 0 ? types : defaultTypeOptions,
    results: Object.keys(results).length > 0 ? results : null,
    resultMapping:
      Object.keys(resultMapping).length > 0
        ? resultMapping
        : defaultResultMapping,
    regarding: Object.keys(regarding).length > 0 ? regarding : null,
    durations: durations.length > 0 ? durations : defaultDurationOptions,
    _fromAdmin: true,
  };
};

// ============================================================================
// Fallback config (uses existing hard-coded defaults)
// ============================================================================
const _buildFallbackConfig = () => ({
  types: defaultTypeOptions,
  results: null, // null = use hard-coded getResultOptions()
  resultMapping: defaultResultMapping,
  regarding: null, // null = use hard-coded getRegardingOptions()
  durations: defaultDurationOptions,
  _fromAdmin: false,
});

// ============================================================================
// Public helper functions for consuming config
// ============================================================================

/**
 * Get type options from config.
 * @param {Object|null} config - Config from fetchPicklistConfig()
 * @returns {string[]} List of type option values
 */
export const getTypeOptionsFromConfig = (config) => {
  if (config?.types && config.types.length > 0) {
    return config.types;
  }
  return defaultTypeOptions;
};

/**
 * Get result options for a given type from config.
 * Falls back to hard-coded getResultOptions() from helperFunc.js.
 * @param {string} type - The selected type (e.g. "Meeting")
 * @param {Object|null} config - Config from fetchPicklistConfig()
 * @returns {string[]} List of result option values
 */
export const getResultOptionsFromConfig = (type, config) => {
  if (config?.results) {
    // Check for type-specific results
    const typeResults = config.results[type];
    if (typeResults && typeResults.length > 0) {
      return typeResults;
    }
    // Check for default results (entries with no parent type)
    const defaultResults = config.results["_default"];
    if (defaultResults && defaultResults.length > 0) {
      return defaultResults;
    }
  }
  // Fall back to hard-coded
  return null; // Caller should use getResultOptions() from helperFunc.js
};

/**
 * Get regarding options for a given type from config.
 * Falls back to hard-coded getRegardingOptions() from helperFunc.js.
 * @param {string} type - The selected type (e.g. "Call")
 * @param {Object|null} config - Config from fetchPicklistConfig()
 * @returns {string[]|null} List of regarding option values, or null for fallback
 */
export const getRegardingOptionsFromConfig = (type, config) => {
  if (config?.regarding) {
    const typeRegarding = config.regarding[type];
    if (typeRegarding && typeRegarding.length > 0) {
      return typeRegarding;
    }
    const defaultRegarding = config.regarding["_default"];
    if (defaultRegarding && defaultRegarding.length > 0) {
      return defaultRegarding;
    }
  }
  return null; // Caller should use getRegardingOptions() from helperFunc.js
};

/**
 * Get duration options from config.
 * @param {Object|null} config - Config from fetchPicklistConfig()
 * @returns {number[]} List of duration values in minutes
 */
export const getDurationOptionsFromConfig = (config) => {
  if (config?.durations && config.durations.length > 0) {
    return config.durations;
  }
  return defaultDurationOptions;
};

/**
 * Get result mapping (type -> default result) from config.
 * @param {Object|null} config - Config from fetchPicklistConfig()
 * @returns {Object} Mapping of type to default result
 */
export const getResultMappingFromConfig = (config) => {
  if (
    config?.resultMapping &&
    Object.keys(config.resultMapping).length > 0
  ) {
    return config.resultMapping;
  }
  return defaultResultMapping;
};
