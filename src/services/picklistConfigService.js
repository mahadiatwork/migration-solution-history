/**
 * Picklist Configuration Service
 *
 * Loads Type, Result, Regarding, and Duration from Widget_Picklist_Config.
 * Hard-coded lists are used only when CRM cannot be read. A reachable module,
 * including an intentionally empty one, is authoritative and cached.
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

const _normalizeCategory = (value) => {
  const rawValue = _fieldValue(value).trim();
  const normalized = rawValue.toLowerCase();
  const { TYPE, RESULT, REGARDING, DURATION } = PICKLIST_CATEGORIES;

  switch (normalized) {
    case TYPE.toLowerCase():
    case "history type":
      return TYPE;
    case RESULT.toLowerCase():
    case "history result":
      return RESULT;
    case REGARDING.toLowerCase():
      return REGARDING;
    case DURATION.toLowerCase():
      return DURATION;
    default:
      return rawValue;
  }
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
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response)) return response;
  return [];
};

const _hasRecordPayload = (response) =>
  Array.isArray(response?.data) ||
  Array.isArray(response?.data?.data) ||
  Array.isArray(response);

const _responseEntries = (response) =>
  [
    response,
    response?.data,
    ...(Array.isArray(response?.data) ? response.data : []),
    ...(Array.isArray(response?.data?.data) ? response.data.data : []),
  ].filter((entry) => entry && typeof entry === "object");

const _hasMoreRecords = (response) => {
  const value =
    response?.info?.more_records ?? response?.data?.info?.more_records;
  return value === true || value === "true";
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
  const perPage = 200;
  const seenPageSignatures = new Set();

  for (let page = 1; ; page += 1) {
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
      // Never accept a partial page set as authoritative. Let the alias/COQL
      // paths retry the complete read instead.
      return { records: [], reached: false };
    }

    const responseEntries = _responseEntries(response);
    const unavailableEntry = responseEntries.find(
      (entry) =>
        entry?.code === "INVALID_MODULE" ||
        entry?.code === "INVALID_MODULE_API_NAME"
    );
    if (unavailableEntry) {
      return { records: [], reached: false };
    }
    const successfulEmptyEntry = responseEntries.find(
      (entry) => entry?.code === "NO_DATA" || entry?.code === "NO_CONTENT"
    );
    if (successfulEmptyEntry) {
      return { records: all, reached: true };
    }
    const errorEntry = responseEntries.find(
      (entry) => {
        const code = typeof entry?.code === "string" ? entry.code : "";
        return (
          entry?.status === "error" ||
          entry?.status === "failure" ||
          Number(entry?.statusCode) >= 400 ||
          (code !== "" &&
            code !== "SUCCESS" &&
            code !== "NO_DATA" &&
            code !== "NO_CONTENT" &&
            code !== "200")
        );
      }
    );
    if (errorEntry) {
      console.warn(`Widget_Picklist_Config SDK error for ${entity}:`, response);
      return { records: [], reached: false };
    }

    if (!_hasRecordPayload(response)) {
      return { records: [], reached: false };
    }

    const chunk = _extractRecordArray(response);
    const more = _hasMoreRecords(response);
    const pageSignature = JSON.stringify(chunk);
    if (
      more &&
      (chunk.length === 0 || seenPageSignatures.has(pageSignature))
    ) {
      console.warn(
        `Widget_Picklist_Config SDK pagination made no progress for ${entity} page ${page}.`
      );
      return { records: [], reached: false };
    }
    seenPageSignatures.add(pageSignature);
    all.push(...chunk);
    if (!more) return { records: all, reached: true };
  }
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

  const candidates = [
    parsedStatusMessage,
    response?.details,
    response?.data &&
    typeof response.data === "object" &&
    !Array.isArray(response.data)
      ? response.data
      : null,
    response,
  ].filter((c) => c && typeof c === "object");

  let data = [];
  let hasPayload = false;
  let successfulEmpty = false;
  let errorCode = null;
  let hasMoreMetadata = false;
  let moreRecords = false;
  for (const candidate of candidates) {
    if (!hasPayload && Array.isArray(candidate.data)) {
      data = candidate.data;
      hasPayload = true;
    }
    if (candidate?.info?.more_records != null) {
      hasMoreMetadata = true;
      moreRecords =
        candidate.info.more_records === true ||
        candidate.info.more_records === "true";
    }
    const entries = [
      candidate,
      ...(Array.isArray(candidate.data) ? candidate.data : []),
    ];
    for (const entry of entries) {
      const code = typeof entry?.code === "string" ? entry.code : "";
      if (code === "NO_DATA" || code === "NO_CONTENT") {
        successfulEmpty = true;
        continue;
      }
      if (
        entry?.status === "error" ||
        entry?.status === "failure" ||
        Number(entry?.statusCode) >= 400 ||
        (code !== "" &&
          code !== "SUCCESS" &&
          code !== "NO_DATA" &&
          code !== "NO_CONTENT" &&
          code !== "200")
      ) {
        errorCode = code || entry.statusCode || "ERROR";
      }
    }
  }

  if (!hasPayload && Array.isArray(response?.data)) {
    data = response.data;
    hasPayload = true;
  }
  return {
    data,
    errorCode,
    hasPayload,
    successfulEmpty,
    hasMoreMetadata,
    moreRecords,
  };
};

const _fetchViaCoql = async () => {
  const { name, category, parentType, sortOrder, active } =
    PICKLIST_CONFIG_FIELDS;
  const pageSize = 2000;

  if (!ZOHO?.CRM?.CONNECTION?.invoke) {
    return { records: [], reached: false };
  }

  for (const moduleApiName of MODULE_API_NAMES) {
    const all = [];
    const seenPageSignatures = new Set();

    for (let offset = 0; ; offset += pageSize) {
      const selectQuery = `select ${name}, ${category}, ${parentType}, ${sortOrder}, ${active} from ${moduleApiName} where ${active} = true order by ${sortOrder} asc LIMIT ${offset}, ${pageSize}`;
      try {
        const req_data = {
          url: `${dataCenterMap.AU}/crm/v8/coql`,
          method: "POST",
          param_type: 2,
          parameters: { select_query: selectQuery },
        };
        const response = await ZOHO.CRM.CONNECTION.invoke(conn_name, req_data);
        const parsed = _parseCoqlResponse(response);

        if (parsed.errorCode) break;
        if (parsed.successfulEmpty) {
          return { records: all, reached: true };
        }
        if (!parsed.hasPayload) break;
        const pageSignature = JSON.stringify(parsed.data);
        const shouldContinue = parsed.hasMoreMetadata
          ? parsed.moreRecords
          : parsed.data.length === pageSize;
        if (
          shouldContinue &&
          (parsed.data.length === 0 ||
            seenPageSignatures.has(pageSignature))
        ) {
          console.warn(
            `Widget_Picklist_Config COQL pagination made no progress for ${moduleApiName} at offset ${offset}.`
          );
          break;
        }
        seenPageSignatures.add(pageSignature);
        all.push(...parsed.data);
        if (!shouldContinue) {
          return { records: all, reached: true };
        }
      } catch (coqlError) {
        console.warn(
          `COQL picklist fetch failed for ${moduleApiName}:`,
          coqlError
        );
        break;
      }
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
    const cat = _normalizeCategory(record[category]);
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
    if (Object.prototype.hasOwnProperty.call(configuredResults, type)) {
      return Array.isArray(configuredResults[type])
        ? configuredResults[type]
        : [];
    }
    if (Object.prototype.hasOwnProperty.call(configuredResults, "_default")) {
      return Array.isArray(configuredResults._default)
        ? configuredResults._default
        : [];
    }
    return [];
  }
  if (mandatoryActivityTypes[type]) {
    return mandatoryActivityTypes[type];
  }
  return null;
};

export const getRegardingOptionsFromConfig = (type, config) => {
  const hasConfiguredRegarding =
    config?._source === "custom_module" ||
    (config?.regarding && typeof config.regarding === "object");
  if (hasConfiguredRegarding) {
    const configuredRegarding = config?.regarding || {};
    if (Object.prototype.hasOwnProperty.call(configuredRegarding, type)) {
      return Array.isArray(configuredRegarding[type])
        ? configuredRegarding[type]
        : [];
    }
    if (Object.prototype.hasOwnProperty.call(configuredRegarding, "_default")) {
      return Array.isArray(configuredRegarding._default)
        ? configuredRegarding._default
        : [];
    }
    return [];
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
