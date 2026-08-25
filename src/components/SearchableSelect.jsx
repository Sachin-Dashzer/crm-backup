// components/SearchableSelect.jsx
"use client";
import { useState, useRef, useEffect } from "react";
import { Search, X, ChevronDown } from "lucide-react";

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "Search...",
  displayKey = "label",
  valueKey = "value",
  formatOption,
  disabled = false,
  onSearch,       // optional: called with search term → parent updates options (server-side search)
  searching = false, // optional: show loading indicator while parent fetches
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // Last option we successfully resolved for the current `value`. In server-search mode the
  // parent replaces `options` on every keystroke, so the selected item drops out of the list
  // as soon as the search term stops matching it — without this the trigger fell back to the
  // placeholder and the selection looked lost even though `value` was still set.
  const [cachedSelected, setCachedSelected] = useState(null);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // When onSearch is provided, skip local filtering — parent provides filtered options
  const filteredOptions = onSearch
    ? options
    : options.filter((option) => {
        const searchString = formatOption
          ? formatOption(option).toLowerCase()
          : String(option[displayKey] || "").toLowerCase();
        return searchString.includes(searchTerm.toLowerCase());
      });

  const resolvedOption = options.find((option) => option[valueKey] === value);

  useEffect(() => {
    if (!value) {
      setCachedSelected(null); // a cleared selection clears the cache
    } else if (resolvedOption) {
      setCachedSelected(resolvedOption);
    }
  }, [value, resolvedOption]);

  // Only trust the cache while it still describes the CURRENT value. If `value` changed to
  // something neither `options` nor the cache knows, fall through to rendering the raw value
  // below — a stale label is worse than an unlovely one, because it names the wrong record.
  const selectedOption =
    resolvedOption || (cachedSelected?.[valueKey] === value ? cachedSelected : null);

  const selectedLabel = selectedOption
    ? formatOption
      ? formatOption(selectedOption)
      : selectedOption[displayKey]
    : value
      ? String(value)
      : null;

  // `onSearch` is a network call in most consumers (patient/employee/vendor lookups), so it is
  // debounced here rather than in each of the ~12 call sites. Before this, typing a 10-character
  // name fired ten requests, and the responses could land out of order — the last keystroke's
  // results were not guaranteed to be the ones displayed.
  //
  // `searchTerm` still updates immediately, so the input itself never feels laggy. 350ms matches
  // the hand-rolled debounces already in admin/transactions/create/page.jsx.
  const onSearchRef = useRef(onSearch);
  useEffect(() => { onSearchRef.current = onSearch; }, [onSearch]);

  const searchDebounceRef = useRef(null);
  useEffect(() => () => clearTimeout(searchDebounceRef.current), []);

  const emitSearch = (val, { immediate = false } = {}) => {
    clearTimeout(searchDebounceRef.current);
    if (!onSearchRef.current) return;
    if (immediate) {
      onSearchRef.current(val);
      return;
    }
    searchDebounceRef.current = setTimeout(() => onSearchRef.current?.(val), 350);
  };

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    emitSearch(val);
  };

  const handleSelect = (option) => {
    onChange(option[valueKey], option);
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("", null);
    setSearchTerm("");
    // Immediate: clearing is a decisive action, and it must also cancel any keystroke debounce
    // still in flight — otherwise that would fire after the clear and repopulate the list.
    emitSearch("", { immediate: true });
  };

  const handleToggle = () => {
    if (disabled) return;
    const opening = !isOpen;
    setIsOpen(opening);
    // Immediate — one deliberate call on open, not a keystroke. Going through emitSearch also
    // cancels any debounce still pending from before the dropdown was closed.
    if (opening) emitSearch(searchTerm, { immediate: true });
  };

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* Trigger */}
      <div
        onClick={handleToggle}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer flex items-center justify-between ${
          disabled ? "opacity-50 cursor-not-allowed" : "hover:border-gray-400"
        }`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          {selectedLabel ? (
            <span className="text-sm truncate">{selectedLabel}</span>
          ) : (
            <span className="text-sm text-gray-400">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-3 h-3 text-gray-500" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-hidden">
          {/* Search Filter */}
          <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Type to search..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-200 focus:outline-none"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-52">
            {searching ? (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                Searching…
              </div>
            ) : filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <div
                  key={option[valueKey] || index}
                  onClick={() => handleSelect(option)}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 ${
                    option[valueKey] === value ? "bg-indigo-100" : ""
                  }`}
                >
                  {formatOption ? formatOption(option) : option[displayKey]}
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
