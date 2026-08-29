"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

/**
 * Searchable, multi-select dropdown for filter panels.
 *
 * Props:
 *  - label:    field label shown above the control
 *  - value:    array of selected option values
 *  - onChange: (nextValues: string[]) => void
 *  - options:  [{ value, label }]  (do NOT include an "All" sentinel option)
 *  - icon:     optional lucide icon component
 *  - allLabel: summary text when nothing is selected (default "All")
 *  - placeholder: search box placeholder
 */
export default function SearchableMultiSelect({
  label,
  value = [],
  onChange,
  options = [],
  icon: Icon,
  allLabel = "All",
  placeholder = "Search…",
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) setTerm("");
  }, [open]);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return options;
    return options.filter((o) => String(o.label).toLowerCase().includes(t));
  }, [options, term]);

  const filteredValues = filtered.map((o) => o.value);
  const allFilteredSelected =
    filteredValues.length > 0 && filteredValues.every((v) => selectedSet.has(v));

  const toggleOne = (v) => {
    onChange(
      selectedSet.has(v) ? value.filter((x) => x !== v) : [...value, v],
    );
  };

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      onChange(value.filter((v) => !filteredValues.includes(v)));
    } else {
      onChange([...new Set([...value, ...filteredValues])]);
    }
  };

  const summary =
    value.length === 0
      ? allLabel
      : value.length === 1
        ? options.find((o) => o.value === value[0])?.label || value[0]
        : `${value.length} selected`;

  return (
    <div className="block" ref={ref}>
      <span className="text-sm font-semibold text-gray-700 mb-2 block">{label}</span>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5 pointer-events-none z-10" />
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`w-full border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 bg-white transition-all text-left text-sm sm:text-base flex items-center justify-between ${
            Icon ? "pl-9 sm:pl-11 pr-8 sm:pr-10" : "px-4 pr-8 sm:pr-10"
          } py-2.5 sm:py-3`}
        >
          <span className={`truncate ${value.length === 0 ? "text-gray-500" : "text-gray-900 font-medium"}`}>
            {summary}
          </span>
        </button>
        {value.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            aria-label={`Clear ${label} filter`}
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        ) : (
          <ChevronDown
            className={`absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5 pointer-events-none transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        )}

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder={placeholder}
                  className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                />
              </div>
            </div>

            {filtered.length > 0 && (
              <button
                type="button"
                onClick={toggleAllFiltered}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold border-b border-gray-100 hover:bg-gray-50 text-left"
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    allFilteredSelected ? "bg-indigo-600 border-indigo-600" : "border-gray-300"
                  }`}
                >
                  {allFilteredSelected && <Check className="w-3 h-3 text-white" />}
                </span>
                {term.trim() ? "Select all matches" : "Select all"}
              </button>
            )}

            <div className="max-h-60 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-sm text-gray-400">No matches</p>
              ) : (
                filtered.map((o) => {
                  const checked = selectedSet.has(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => toggleOne(o.value)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          checked ? "bg-indigo-600 border-indigo-600" : "border-gray-300"
                        }`}
                      >
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span className="truncate">{o.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
