import dayjs from "dayjs";
import {
  HIGH_VOLUME_HISTORY_THRESHOLD,
  getRecentHistoryStart,
  isHighVolumeHistory,
  parseHistoryCount,
} from "./historyLoadPolicy";

describe("history load policy", () => {
  test("uses one COQL page as the high-volume boundary", () => {
    expect(isHighVolumeHistory(HIGH_VOLUME_HISTORY_THRESHOLD)).toBe(false);
    expect(isHighVolumeHistory(HIGH_VOLUME_HISTORY_THRESHOLD + 1)).toBe(true);
  });

  test("calculates the start of the three-month window", () => {
    expect(
      getRecentHistoryStart(dayjs("2026-10-08T15:30:00+08:00")).format()
    ).toBe("2026-07-08T00:00:00+08:00");
  });

  test("reads aggregate COUNT responses", () => {
    expect(parseHistoryCount([{ "COUNT(Contact_Details)": "13240" }])).toBe(
      13240
    );
    expect(parseHistoryCount([{ count: 3 }])).toBeNull();
  });
});
