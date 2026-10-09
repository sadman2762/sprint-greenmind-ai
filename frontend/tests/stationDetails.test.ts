import assert from "node:assert/strict";
import { test } from "node:test";
import { formatRecordedTime, formatMeasurement, compassDirection } from "../src/utils/stationDetails.ts";

test("recorded times preserve the supplied wall-clock time and timezone", () => {
  assert.equal(formatRecordedTime("2026-06-19T11:00:00"), "Recorded 19 Jun 2026, 11:00");
  assert.equal(formatRecordedTime("2026-06-19T12:00:00Z"), "Recorded 19 Jun 2026, 12:00 UTC");
  assert.equal(formatRecordedTime("2026-06-19T12:00:00+02:00"), "Recorded 19 Jun 2026, 12:00 UTC+02:00");
});

test("invalid or missing timestamps are not presented as live data", () => {
  for (const value of [undefined, "", "not a date", "2026-02-30T11:00:00", "2026-06-19T25:00:00"]) {
    assert.equal(formatRecordedTime(value), "Recording time unavailable");
  }
});

test("measurements preserve zero and label missing values", () => {
  assert.equal(formatMeasurement(0, "µg/m³"), "0.0 µg/m³");
  assert.equal(formatMeasurement(12, "µg/m³"), "12.0 µg/m³");
  for (const value of [null, undefined, NaN, Infinity, -1]) assert.equal(formatMeasurement(value, "µg/m³"), "—");
});

test("compass labels normalize headings without inventing missing readings", () => {
  assert.equal(compassDirection(116), "ESE");
  assert.equal(compassDirection(-90), "W");
  assert.equal(compassDirection(360), "N");
  assert.equal(compassDirection(null), "");
});
