/**
 * Picklist Configuration Service
 *
 * Loads Type, Result, Regarding, and Duration from Widget_Picklist_Config.
 * Hard-coded lists are used only when CRM cannot be read. Failed/empty
 * fetches are not cached, so a retry after ZOHO init can succeed.
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
  mandatoryActivityTypes,
  mergeOrderedUnique,
} from "../components/organisms/dialogConstants";

const ZOHO = window.ZOHO;

let cachedConfig = null;
let fetchPromise = null;

const MODULE_API_NAMES = [PICKLIST_CONFIG_MODULE, "CustomModule15"];

/**
 * Fetch grouped picklist config. Successful CRM loads are cached for the session.
 * @returns {Promise<Object>} { types, results, resultMapping, regarding, durations }
 */
export const fetchPicklistConfig = async () => {
  if (cachedConfig?._source === "custom_module") return cachedConfig;
  if (fetchPromise) return fetchPromise;

  fetchPromise = _doFetch();

  try {
    const config = await fetchPromise;
    if (config?._source === "custom_module") {
      cachedConfig = config;
    }
    return config;
  } finally {
    fetchPromise = null;
  }
};

export const clearPicklistConfigCache = () => {
  cachedConfig = null;
  fetchPromise = null;
};

const _doFetch = async () => {
  try {
    if (!ZOHO?.CRM) {
      console.warn("Widget_Picklist_Config: ZOHO.CRM is not ready yet.");
      return _buildFallbackConfig();
    }

    let fetchResult = await _fetchViaSdk();
    if (!fetchResult.reached) {
      fetchResult = await _fetchViaCoql();
    }

    if (!fetchResult.reached) {
      console.warn(
        "Widget_Picklist_Config: Could not read the module. Using hard-coded defaults."
      );
      return _buildFallbackConfig();
    }

    const activeRecords = fetchResult.records.filter(_isActive);

    console.info(
      `Widget_Picklist_Config: Loaded ${activeRecords.length} option(s) from CRM.`
    );
    return _groupRecords(activeRecords);
  } catch (error) {
    console.warn(
      "Picklist config: failed to fetch. Falling back to defaults.",
      error
    );
    return _buildFallbackConfig();
  }
};

const _fieldValue = (value) => {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    return (
      value.display_value ||
      value.actual_value ||
      value.name ||
      value.Name ||
      ""
    );
  }
  return String(value);
};

const _isActive = (record) => {
  const value = record?.[PICKLIST_CONFIG_FIELDS.active];
  return (
    value === true ||
    value === "true" ||
    value === 1 ||
    value === "1" ||
    value === "Yes"
  );
};

const _extractRecordArray = (response) => {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  return [];
};

const _fetchViaSdk = async () => {
  for (const entity of MODULE_API_NAMES) {
    const result = await _paginateSdk(entity);
    if (result.reached) return result;
  }
  return { records: [], reached: false };
};

const _paginateSdk = async (entity) => {
  const all = [];
  let reached = false;
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    let response;
    try {
      if (typeof ZOHO.CRM.API.getAllRecords === "function") {
        response = await ZOHO.CRM.API.getAllRecords({
          Entity: entity,
          sort_order: "asc",
          per_page: perPage,
          page,
        });
      } else if (typeof ZOHO.CRM.API.getRecords === "function") {
        response = await ZOHO.CRM.API.getRecords({
          Entity: entity,
          sort_order: "asc",
          per_page: perPage,
          page,
        });
      } else {
        return { records: [], reached: false };
      }
    } catch (error) {
      console.warn(
        `Widget_Picklist_Config SDK fetch failed for ${entity} page ${page}:`,
        error
      );
      return { records: all, reached };
    }

    const responseEntries = [
      response,
      ...(Array.isArray(response?.data) ? response.data : []),
    ].filter(Boolean);
    const errorEntry = responseEntries.find(
      (entry) =>
        entry?.status === "error" ||
        (entry?.code &&
          entry.code !== "SUCCESS" &&
          entry?.status !== "success")
    );
    if (errorEntry) {
      console.warn(`Widget_Picklist_Config SDK error for ${entity}:`, response);
      return { records: [], reached: false };
    }

    const chunk = _extractRecordArray(response);
    reached = true;
    all.push(...chunk);
    const more =
      response?.info?.more_records === true ||
      response?.info?.more_records === "true";
    if (chunk.length < perPage || !more) break;
    page += 1;
  }

  return { records: all, reached };
};

const _parseCoqlResponse = (response) => {
  const details = response?.details || {};
  const rawStatusMessage =
    details.statusMessage ??
    details.statusMessage ??
    details.statusMessage;
  let parsedStatusMessage = rawStatusMessage;
  if (typeof rawStatusMessage === "string" && rawStatusMessage.trim()) {
    try {
      parsedStatusMessage = JSON.parse(rawStatusMessage);
    } catch {
      parsedStatusMessage = null;
    }
  }

  const candidates = [parsedStatusMessage, response?.details, response].filter(
    (c) => c && typeof c === "object"
  );

  let data = [];
  let errorCode = null;
  for (const candidate of candidates) {
    if (!data.length && Array.isArray(candidate.data)) {
      data = candidate.data;
    }
    if (
      candidate.status === "error" ||
      candidate.code === "INVALID_MODULE" ||
      candidate.code === "INVALID_QUERY" ||
      Number(candidate.statusCode) >= 400
    ) {
      errorCode = candidate.code || candidate.statusCode || "ERROR";
    }
  }

  if (!data.length && Array.isArray(response?.data)) data = response.data;
  return { data, errorCode };
};

const _fetchViaCoql = async () => {
  const { name, category, parentType, sortOrder, active } =
    PICKLIST_CONFIG_FIELDS;

  if (!ZOHO?.CRM?.CONNECTION?.invoke) {
    return { records: [], reached: false };
  }

  for (const moduleApiName of MODULE_API_NAMES) {
    const selectQuery = `select ${name}, ${category}, ${parentType}, ${sortOrder}, ${active} from ${moduleApiName} where ${active} = true order by ${sortOrder} asc LIMIT 0, 2000`;
    try {
      const req_data = {
        url: `${dataCenterMap.AU}/crm/v8/coql`,
        method: "POST",
        param_type: 2,
        parameters: { select_query: selectQuery },
      };
      const response = await ZOHO.CRM.CONNECTION.invoke(conn_name, req_data);
      const parsed = _parseCoqlResponse(response);
      if (!parsed.errorCode && response != null) {
        return { records: parsed.data, reached: true };
      }
    } catch (coqlError) {
      console.warn(
        `COQL picklist fetch failed for ${moduleApiName}:`,
        coqlError
      );
    }
  }
  return { records: [], reached: false };
};

const _pushUnique = (list, value) => {
  if (value && !list.includes(value)) list.push(value);
};

const _groupRecords = (records) => {
  const { name, category, parentType, sortOrder } = PICKLIST_CONFIG_FIELDS;
  const { TYPE, RESULT, REGARDING, DURATION } = PICKLIST_CATEGORIES;

  const types = [];
  const results = {};
  const regarding = {};
  const durations = [];

  const sorted = [...records].sort(
    (a, b) => (Number(a[sortOrder]) || 9999) - (Number(b[sortOrder]) || 9999)
  );

  for (const record of sorted) {
    const cat = _fieldValue(record[category]);
    const value = _fieldValue(record[name]);
    const parent = _fieldValue(record[parentType]) || "_default";

    if (!value) continue;

    switch (cat) {
      case TYPE:
        _pushUnique(types, value);
        break;
      case RESULT:
        if (!results[parent]) results[parent] = [];
        _pushUnique(results[parent], value);
        break;
      case REGARDING:
        if (!regarding[parent]) regarding[parent] = [];
        _pushUnique(regarding[parent], value);
        break;
      case DURATION: {
        const num = parseInt(value, 10);
        if (!isNaN(num) && !durations.includes(num)) durations.push(num);
        break;
      }
      default:
        console.warn(`Unknown picklist category: ${cat} for entry "${value}"`);
    }
  }

  const resultMapping = {};
  for (const [parent, resultList] of Object.entries(results)) {
    if (parent !== "_default" && resultList.length > 0) {
      resultMapping[parent] = resultList[0];
    }
  }

  return {
    types,
    results,
    resultMapping,
    regarding,
    durations,
    _fromAdmin: true,
    _source: "custom_module",
  };
};

const _buildFallbackConfig = () => ({
  types: defaultTypeOptions,
  results: null,
  resultMapping: defaultResultMapping,
  regarding: null,
  durations: defaultDurationOptions,
  _fromAdmin: false,
  _source: "fallback",
});

export const getTypeOptionsFromConfig = (config) => {
  if (Array.isArray(config?.types)) {
    return mergeOrderedUnique(config.types);
  }
  return defaultTypeOptions;
};

export const getResultOptionsFromConfig = (type, config) => {
  const hasConfiguredResults =
    config?._source === "custom_module" ||
    (config?.results && typeof config.results === "object");
  if (hasConfiguredResults) {
    const configuredResults = config?.results || {};
    const typeResults = configuredResults[type];
    if (typeResults && typeResults.length > 0) {
      return typeResults;
    }
    const defaultResults = configuredResults["_default"];
    if (defaultResults && defaultResults.length > 0) {
      return defaultResults;
    }
    return [];
  }
  if (mandatoryActivityTypes[type]) {
    return mandatoryActivityTypes[type];
  }
  return null;
};

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
  return null;
};

export const getDurationOptionsFromConfig = (config) => {
  if (Array.isArray(config?.durations)) {
    return [...config.durations];
  }
  return defaultDurationOptions;
};

export const getResultMappingFromConfig = (config) => {
  if (
    config?.resultMapping &&
    typeof config.resultMapping === "object" &&
    !Array.isArray(config.resultMapping)
  ) {
    return { ...config.resultMapping };
  }
  return defaultResultMapping;
};
