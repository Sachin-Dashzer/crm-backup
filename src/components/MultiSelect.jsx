"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, X, Check } from "lucide-react";

export default function MultiSelect({
  values = [],
  onChange,
  options = [],
  placeholder = "All",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = Math.min(options.length * 40 + 56, 280); // estimate
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
    const closeOnScroll = () => setOpen(false);
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
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 bg-gray-50">
            <button
              type="button"
              onClick={() => onChange(options.map((o) => o.value))}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              Select all
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
            ) : (
              options.map((o) => {
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
