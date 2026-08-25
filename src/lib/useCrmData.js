"use client";

import useSWR from "swr";

/**
 * Shared data-fetching hook for CRM list/detail screens.
 *
 * `swr` was already a dependency but had zero imports anywhere — every page hand-rolled a
 * `useEffect` + `let cancelled = false` + three `useState`s. That works, but it has no cache, so
 * navigating away from a page and back refetched everything from scratch, and every filter change
 * blanked the table to a spinner before the new rows arrived.
 *
 * Defaults chosen for this app:
 *   keepPreviousData    — a filter/page change keeps the old rows visible (dimmed via
 *                         `isValidating`) instead of flashing an empty table. This is the single
 *                         biggest perceived-speed difference on the list screens.
 *   revalidateOnFocus:false — these are back-office screens that sit open in a tab all day;
 *                         refetching every dashboard on every window focus was pure load.
 *   dedupingInterval    — the admin dashboard fires many overlapping requests, and several
 *                         pages request the same summary endpoints twice. Identical keys inside
 *                         this window collapse to one request.
 *   errorRetryCount     — fail visibly after a few tries rather than hammering a struggling API.
 *
 * Pass `null`/`undefined` as the key to skip the request (SWR's standard conditional-fetch form),
 * e.g. while a required parameter is still unresolved.
 */

const jsonFetcher = async (url) => {
  const res = await fetch(url, { credentials: "include" });

  if (!res.ok) {
    // Surface the server's own message when it sent one — these routes return
    // { error } / { message } and those are much more useful than "HTTP 500".
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error || body?.message || "";
    } catch {
      // Non-JSON error body; the status alone will have to do.
    }
    const err = new Error(detail || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }

  return res.json();
};

export const CRM_SWR_DEFAULTS = {
  keepPreviousData: true,
  revalidateOnFocus: false,
  dedupingInterval: 15_000,
  errorRetryCount: 2,
};

export default function useCrmData(key, options = {}) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(key, jsonFetcher, {
    ...CRM_SWR_DEFAULTS,
    ...options,
  });

  return {
    data,
    error,
    // `isLoading` is true only on the FIRST load of a key (no cached data). `isValidating` is true
    // for background refreshes too — use it to dim/annotate, not to blank the screen, or
    // keepPreviousData above buys nothing.
    isLoading,
    isValidating,
    mutate,
  };
}
