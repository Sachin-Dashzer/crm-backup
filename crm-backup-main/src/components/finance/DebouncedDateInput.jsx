"use client";

import { useState, useEffect, useRef } from "react";

/**
 * A `type="date"` input that commits on a debounce instead of on every change event.
 *
 * WHY: a native date input fires onChange per SEGMENT as the user types — day, then month, then
 * year. On the finance pages each committed change re-runs a fetch, and on Assets/Liabilities,
 * where scope is lifted to the page, it re-runs the header's fetches AND every sibling
 * DrillDownTable. So entering a single date could cost three full rounds of 6-10 requests, two of
 * them for half-typed dates like 0002-01-01 that the server then scanned for.
 *
 * The displayed value is local state, so typing never feels laggy — only propagation is delayed.
 *
 * Props:
 *   value    string  the committed value (YYYY-MM-DD or "")
 *   onCommit (v) => void   called once the user pauses
 *   delay    number  ms, default 400
 */
export default function DebouncedDateInput({ value, onCommit, className, delay = 400, ...rest }) {
  const [local, setLocal] = useState(value || "");
  const timerRef = useRef(null);

  // Re-sync when the committed value changes from outside — a Reset button, a deep link, or a
  // parent scope change. Comparing against `value` means this does not fight the debounce: when
  // our own commit lands, `value` becomes what `local` already is and nothing visibly changes.
  useEffect(() => { setLocal(value || ""); }, [value]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleChange = (next) => {
    setLocal(next);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onCommit(next), delay);
  };

  return (
    <input
      type="date"
      value={local}
      onChange={(e) => handleChange(e.target.value)}
      className={className}
      {...rest}
    />
  );
}
