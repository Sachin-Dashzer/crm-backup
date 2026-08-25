"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, X, Check, Search } from "lucide-react";

export default function MultiSelect({
  values = [],
  onChange,
  options = [],
  placeholder = "All",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    // Estimate: options, plus the search box (~52) and the select-all header (~34).
    // Deliberately keyed on the FULL option count, not the filtered one, so the dropdown
    // doesn't re-anchor itself while the user is typing.
    const dropdownHeight = Math.min(options.length * 40 + 90, 346);
    const spaceBelow = viewportHeight - rect.bottom;
    const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
      ...(openUpward
        ? { bottom: viewportHeight - rect.top, top: "auto" }
        : { top: rect.bottom + 2, bottom: "auto" }),
    });
  }, [options.length]);

  useEffect(() => {
    if (open) computePosition();
  }, [open, computePosition]);

  useEffect(() => {
    const closeOnOutside = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    // Capture phase is required: the dropdown is positioned `fixed`, so it has to close when
    // any ancestor container scrolls out from under it, and those events don't bubble. But
    // capture also delivers scrolls from the dropdown's OWN option list — which made reaching
    // an option below the fold close the dropdown instead. Ignore those.
    const closeOnScroll = (e) => {
      if (dropdownRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const closeOnResize = () => setOpen(false);

    if (open) {
      document.addEventListener("mousedown", closeOnOutside);
      document.addEventListener("scroll", closeOnScroll, true);
      window.addEventListener("resize", closeOnResize);
    }
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [open]);

  // A stale search term must not survive into the next open.
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  // Filtering only narrows what is VISIBLE. `values` is never touched here, so a selected
  // option that the current search hides stays selected — the count and the committed
  // filter are unaffected by what happens to be typed in this box.
  const visibleOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => String(o.label ?? o.value ?? "").toLowerCase().includes(q));
  }, [options, search]);

  const toggle = (val) => {
    onChange(
      values.includes(val) ? values.filter((v) => v !== val) : [...values, val]
    );
  };

  const displayLabel =
    values.length === 0
      ? placeholder
      : values.length === 1
      ? (options.find((o) => o.value === values[0])?.label ?? values[0])
      : `${values.length} selected`;

  return (
    <div ref={triggerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-colors"
      >
        <span className={values.length ? "text-gray-900 font-medium truncate" : "text-gray-400"}>
          {displayLabel}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {values.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onChange([]); } }}
              className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center hover:bg-red-100 hover:text-red-500 cursor-pointer transition-colors"
              title="Clear selection"
            >
              <X className="w-2.5 h-2.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Dropdown — fixed positioned to escape overflow:hidden/auto parents */}
      {open && (
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Search — sticky above the scrolling list, same pattern as SearchableSelect */}
          <div className="p-2 border-b border-gray-200 bg-white">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type to search..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 bg-gray-50">
            <button
              type="button"
              // Scoped to the visible list and merged with what's already chosen, so
              // "Select all" under an active search adds those matches without discarding
              // selections the search happens to be hiding.
              onClick={() =>
                onChange([...new Set([...values, ...visibleOptions.map((o) => o.value)])])
              }
              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              {search.trim() ? "Select all matching" : "Select all"}
            </button>
            {values.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-red-500 hover:text-red-600 font-semibold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="max-h-64 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">No options available</p>
            ) : visibleOptions.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">No results found</p>
            ) : (
              visibleOptions.map((o) => {
                const checked = values.includes(o.value);
                return (
                  <div
                    key={o.value}
                    role="option"
                    aria-selected={checked}
                    onClick={() => toggle(o.value)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors select-none ${
                      checked ? "bg-indigo-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        checked
                          ? "bg-indigo-600 border-indigo-600"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </div>
                    <span className="text-sm text-gray-700 leading-snug">{o.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
