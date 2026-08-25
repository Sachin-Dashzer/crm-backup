// Ageing for payables and receivables. The two concepts are identical — days measured against
// a due date — so the pipeline stages and the bucket boundaries live here once and are spread
// into both aggregations. Building this per-collection would guarantee the two drift.
//
// Nothing here is ever stored. daysOverdue/daysToDue/ageingBucket are derived on read, so a
// payable's age is always correct without a nightly job to re-stamp it.

// Day boundaries are IST, not UTC. A due date stored at 2026-08-08T00:00:00Z is "today" for a
// user in Kolkata until 05:30 UTC the next day; computing in UTC would report it a day overdue
// during that window. Every other date-sensitive path in this codebase already works in IST.
const IST = "Asia/Kolkata";

// Ordered widest-last. `value` is what travels in the query string and is stored in no document.
export const AGEING_BUCKETS = [
  { value: "current", label: "Current (not yet due)", min: null, max: 0 },
  { value: "1-30", label: "1–30 days", min: 1, max: 30 },
  { value: "31-60", label: "31–60 days", min: 31, max: 60 },
  { value: "61-90", label: "61–90 days", min: 61, max: 90 },
  { value: "90+", label: "90+ days", min: 91, max: null },
];

// $addFields stages producing:
//   daysOverdue    — signed, positive when past due. null when no due date is set.
//   daysToDue      — the same number inverted, so callers never have to negate it themselves.
//   ageingBucket   — one of AGEING_BUCKETS[].value, or null when no due date is set.
//
// A row with no dueDate yields null across all three rather than 0. Zero is a real, distinct
// state here ("due today"), so collapsing "unknown" into it would silently mark undated rows
// as due now and float them up an ageing-sorted list.
export function buildAgeingStages() {
  const hasDueDate = { $ne: [{ $ifNull: ["$dueDate", null] }, null] };

  return [
    {
      $addFields: {
        daysOverdue: {
          $cond: [
            hasDueDate,
            { $dateDiff: { startDate: "$dueDate", endDate: "$$NOW", unit: "day", timezone: IST } },
            null,
          ],
        },
      },
    },
    {
      $addFields: {
        daysToDue: {
          $cond: [{ $ne: ["$daysOverdue", null] }, { $multiply: ["$daysOverdue", -1] }, null],
        },
        ageingBucket: {
          $switch: {
            branches: [
              { case: { $eq: ["$daysOverdue", null] }, then: null },
              { case: { $lte: ["$daysOverdue", 0] }, then: "current" },
              { case: { $lte: ["$daysOverdue", 30] }, then: "1-30" },
              { case: { $lte: ["$daysOverdue", 60] }, then: "31-60" },
              { case: { $lte: ["$daysOverdue", 90] }, then: "61-90" },
            ],
            default: "90+",
          },
        },
      },
    },
  ];
}

// Sort spec for "worst offenders first". Undated rows carry null, which MongoDB sorts below
// every number on a descending sort, so they settle at the bottom without a special case.
// createdAt breaks ties so pagination stays stable between requests.
export const AGEING_SORT = { daysOverdue: -1, createdAt: -1 };

// Presentation. Kept next to the buckets so the wording can't disagree with the boundaries.
// Returns null text for undated rows; callers render an em dash.
export function formatAgeing(daysOverdue) {
  if (daysOverdue === null || daysOverdue === undefined) {
    return { text: "—", tone: "none" };
  }
  if (daysOverdue > 0) {
    return { text: `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`, tone: "overdue" };
  }
  if (daysOverdue === 0) return { text: "due today", tone: "today" };
  const inDays = -daysOverdue;
  return { text: `due in ${inDays} day${inDays === 1 ? "" : "s"}`, tone: "upcoming" };
}

export const AGEING_TONE_CLASSES = {
  overdue: "text-red-600 font-semibold",
  today: "text-amber-600 font-semibold",
  upcoming: "text-gray-500",
  none: "text-gray-400",
};
