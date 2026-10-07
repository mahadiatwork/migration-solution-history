import dayjs from "dayjs";

export const HIGH_VOLUME_HISTORY_THRESHOLD = 2000;
export const RECENT_HISTORY_MONTHS = 3;

export const isHighVolumeHistory = (totalCount) => {
  const count = Number(totalCount);
  return Number.isFinite(count) && count > HIGH_VOLUME_HISTORY_THRESHOLD;
};

export const getRecentHistoryStart = (now = dayjs()) =>
  dayjs(now).subtract(RECENT_HISTORY_MONTHS, "month").startOf("day");

export const parseHistoryCount = (records) => {
  const countRecord = Array.isArray(records) ? records[0] : null;
  if (!countRecord || typeof countRecord !== "object") return null;

  const countEntry = Object.entries(countRecord).find(([key]) =>
    key.toUpperCase().startsWith("COUNT(")
  );
  if (!countEntry) return null;

  const count = Number(countEntry[1]);
  return Number.isFinite(count) ? count : null;
};
