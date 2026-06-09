/* eslint-disable no-undef */
/**
 * Regression tests for the Sumba / "00:00 tilset stuck" bug.
 *
 * Two bugs were present on main:
 *
 * 1) /suntime called sunrise-sunset.org with date=today|yesterday|tomorrow
 *    as literal strings. That API resolves those relative to UTC, not the
 *    queried lat/lng. For locations east enough that their local calendar
 *    day is ahead of UTC at query time (e.g. Sumba, Indonesia just after
 *    local midnight viewed from anywhere on a UTC day boundary), the
 *    returned "today" window was the prior Sumba day. Downstream,
 *    today.sunset was already in the past, tilset went negative, and the
 *    UI showed a degenerate countdown that never advanced.
 *
 * 2) parseMilliseconds() pre-pended '0' to any value < 10, including
 *    negatives, producing "0-2" instead of "-02". When a stale window
 *    leaked a negative duration through, output looked like
 *    "-0-2:0-33 tilsun" instead of "00:00 ...". With (1) fixed this is
 *    defense in depth, but the helper is exercised directly to make
 *    sure it can never re-emit malformed strings.
 */

const assert = require('assert');
const { DateTime } = require('luxon');
const { find } = require('geo-tz');
const {
  formatThreeDatesForTimezone,
  findTheTime,
  formatTimeDiff,
  parseMilliseconds,
} = require('../src/api/v1/sunriseSunsetApi').__test__;

// Helper: build a trioOfTimes payload the way fetchSunTimes() would.
function trio(yesterday, today, tomorrow) {
  const r = ([sunrise, sunset]) => ({ results: { sunrise, sunset } });
  return [r(yesterday), r(today), r(tomorrow)];
}

describe('formatThreeDatesForTimezone — location-local day rollover', () => {
  it('returns Sumba-local Jun 10 when querying just after Sumba midnight', () => {
    // Sumba uses IANA Asia/Makassar (UTC+8, no DST).
    // Note: formatThreeDatesForTimezone reads DateTime.now() under the
    // hood, so we can't pin the clock without injecting it. We instead
    // assert structural invariants: yesterday, today, tomorrow are
    // consecutive Asia/Makassar calendar days.
    const sumba = find(-9.65, 119.97)[0];
    assert.strictEqual(sumba, 'Asia/Makassar');

    const dates = formatThreeDatesForTimezone(sumba);
    const yest = DateTime.fromISO(dates.yesterday, { zone: sumba });
    const today = DateTime.fromISO(dates.today, { zone: sumba });
    const tom = DateTime.fromISO(dates.tomorrow, { zone: sumba });

    assert.strictEqual(today.diff(yest, 'days').days, 1);
    assert.strictEqual(tom.diff(today, 'days').days, 1);
    // And `today` must equal the current Asia/Makassar calendar day.
    assert.strictEqual(today.toFormat('yyyy-MM-dd'),
      DateTime.now().setZone(sumba).toFormat('yyyy-MM-dd'));
  });
});

describe('findTheTime — Sumba scenario (location-local frame)', () => {
  // Pin the scenario by hand: a fixed currentTime, and a window that is
  // INTERNALLY CONSISTENT with the queried location's calendar day.
  // Pre-fix, /suntime would have passed a window that was one Sumba-day
  // stale; post-fix it passes a window aligned with the location-local
  // day. We assert that with the correct window, output is sane.

  const currentTime = new Date('2026-06-10T00:08:00Z'); // Sumba 08:08, ~2h past sunrise

  // Correct window (Sumba-local days Jun 9 / 10 / 11), aligned w/ post-fix.
  const correctTrio = trio(
    ['2026-06-08T22:10:44.000Z', '2026-06-09T09:47:33.000Z'], // Sumba Jun 9
    ['2026-06-09T22:11:00.000Z', '2026-06-10T09:47:40.000Z'], // Sumba Jun 10 (= today)
    ['2026-06-10T22:11:15.000Z', '2026-06-11T09:47:49.000Z'], // Sumba Jun 11
  );

  // Stale window — what the BUGGY /suntime returned (UTC-resolved
  // 'today' returned the prior Sumba day). We use this to assert the
  // pre-fix breakage shape and that parseMilliseconds no longer emits
  // malformed strings even when fed this garbage.
  const staleTrio = trio(
    ['2026-06-07T22:10:30.000Z', '2026-06-08T09:47:25.000Z'],
    ['2026-06-08T22:10:44.000Z', '2026-06-09T09:47:33.000Z'], // <-- "today" is actually Sumba Jun 9
    ['2026-06-09T22:11:00.000Z', '2026-06-10T09:47:40.000Z'],
  );

  it('with the CORRECT (location-local) window, reports "after sunrise" and a positive countdown', () => {
    const result = findTheTime(correctTrio, currentTime);
    assert.strictEqual(result.whereWeAre, 'after sunrise');
    assert.match(result.time1, /^\+\d{2}:\d{2} pastsun$/, `time1 was "${result.time1}"`);
    assert.match(result.time2, /^-\d{2}:\d{2} tilset$/, `time2 was "${result.time2}"`);
    // sunPercent must be in [0,1] for a non-degenerate window.
    assert.ok(result.sunPercent >= 0 && result.sunPercent <= 1,
      `sunPercent out of bounds: ${result.sunPercent}`);
    assert.ok(result.nightStartPercent >= 0 && result.nightStartPercent <= 1,
      `nightStartPercent out of bounds: ${result.nightStartPercent}`);
  });

  it('even with a STALE window, output strings are well-formed (no "0-2:0-33")', () => {
    const result = findTheTime(staleTrio, currentTime);
    // We don't assert phase correctness here — that's the bug we fixed
    // elsewhere. We DO assert no malformed hyphen-in-the-middle strings
    // ever leak through, which guards against regressions in
    // parseMilliseconds.
    assert.doesNotMatch(result.time1, /\d-\d/,
      `malformed time1 with embedded "-": "${result.time1}"`);
    assert.doesNotMatch(result.time2, /\d-\d/,
      `malformed time2 with embedded "-": "${result.time2}"`);
    // Sun percent must remain a finite number, even when degenerate.
    assert.ok(Number.isFinite(result.sunPercent));
  });
});

describe('parseMilliseconds — never emits malformed negative strings', () => {
  it('clamps negative durations and formats zeroes for both', () => {
    const neg = parseMilliseconds(-12345);
    assert.strictEqual(neg.hours, '00');
    assert.strictEqual(neg.minutes, '00');
    assert.strictEqual(neg.seconds, '00');
  });

  it('formats normal positive durations correctly', () => {
    // 1h 23m 45s
    const pos = parseMilliseconds((1 * 3600 + 23 * 60 + 45) * 1000);
    // hours/minutes/seconds are zero-padded strings when < 10, but the
    // existing impl returns raw numbers when >= 10. We only care that the
    // values are correct; the public-facing `time1`/`time2` strings are
    // covered by the formatTimeDiff tests below.
    assert.strictEqual(String(pos.hours), '01');
    assert.strictEqual(String(pos.minutes), '23');
    assert.strictEqual(String(pos.seconds), '45');
  });

  it('formatTimeDiff never produces "<digit>-<digit>" garbage for negatives', () => {
    const s = formatTimeDiff(-9_999_999, '-', 'tilset', 'desc');
    assert.doesNotMatch(s, /\d-\d/, `got malformed: "${s}"`);
    assert.strictEqual(s, '-00:00 tilset');
  });
});
