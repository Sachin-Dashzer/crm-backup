"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export default function AccountMultiSelect({ options, selected, onChange, label = "Further Mode" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const allSelected = selected.length === options.length;
  const toggleAll = () => onChange(allSelected ? [] : [...options]);
  const toggleOne = (opt) =>
    onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt]);

  const summary = allSelected
    ? "All accounts"
    : selected.length === 0
      ? "No accounts"
      : `${selected.length} selected`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white shadow-sm hover:bg-gray-50"
      >
        <span className="text-gray-500 text-xs font-semibold">{label}:</span>
        <span className="font-medium text-gray-800">{summary}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden right-0">
          <button
            onClick={toggleAll}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold border-b border-gray-100 hover:bg-gray-50 text-left"
          >
            <span
              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                allSelected ? "bg-indigo-600 border-indigo-600" : "border-gray-300"
              }`}
            >
              {allSelected && <Check className="w-3 h-3 text-white" />}
            </span>
            Select All
          </button>
          <div className="max-h-64 overflow-y-auto">
            {options.map((opt) => {
              const checked = selected.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => toggleOne(opt)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      checked ? "bg-indigo-600 border-indigo-600" : "border-gray-300"
                    }`}
                  >
                    {checked && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <span className="truncate">{opt}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
