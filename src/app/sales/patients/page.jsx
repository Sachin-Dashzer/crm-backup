"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SalesSidebar from "@/components/Sidebars/SalesSidebar";
import {
  Filter,
  ChevronRight,
  ChevronLeft,
  Search,
  X,
  Calendar,
  User,
} from "lucide-react";

const STATUS_COLORS = {
  NEW: "bg-blue-100 text-blue-800",
  NOT_VISITED: "bg-amber-100 text-amber-800",
  CONSULTED: "bg-purple-100 text-purple-800",
  NOT_CONVERTED: "bg-red-100 text-red-800",
  SURGERY_BOOKED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
};

const STATUS_OPTIONS = [
  "NEW",
  "NOT_VISITED",
  "CONSULTED",
  "NOT_CONVERTED",
  "SURGERY_BOOKED",
  "CLOSED",
];

const LOCATION_OPTIONS = ["Delhi", "Mumbai", "Hyderabad"];

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "N/A";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);

const getInitialFiltersFromURL = (sp) => ({
  search: sp.get("search") || "",
  status: sp.get("status") || "",
  location: sp.get("branch") === "All" ? "" : sp.get("branch") || "",
  counsellor: sp.get("counsellor") || "",
  reference: sp.get("reference") || "",
  technique: sp.get("technique") || "",
  dateFrom: sp.get("dateFrom") || "",
  dateTo: sp.get("dateTo") || "",
  minPackage: sp.get("minPackage") || "",
  maxPackage: sp.get("maxPackage") || "",
  purpose: sp.get("purpose") || "",
});

function Th({ label }) {
  return (
    <th className="px-6 py-4 text-left font-semibold">
      <div className="inline-flex items-center gap-1">{label}</div>
    </th>
  );
}

function SalesPatientDashboardContent() {
  const searchParams = useSearchParams();

  const [patients, setPatients] = useState([]);
  const [filters, setFilters] = useState(() =>
    getInitialFiltersFromURL(searchParams),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/sales/get-patients");
        if (!res.ok) throw new Error("Failed to fetch patient data");
        const data = await res.json();
        setPatients(data.patients || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const counsellorOptions = useMemo(
    () =>
      [
        ...new Set(patients.map((p) => p?.counselling?.counsellor?.name)),
      ].filter(Boolean),
    [patients],
  );

  const techniqueOptions = useMemo(
    () =>
      [
        ...new Set([
          ...patients.map((p) => p?.counselling?.techniqueSuggested),
          ...patients.map((p) => p?.personal?.techniqueQuoted),
        ]),
      ].filter(Boolean),
    [patients],
  );

  const referenceOptions = useMemo(
    () =>
      [...new Set(patients.map((p) => p?.personal?.reference?.name))].filter(
        Boolean,
      ),
    [patients],
  );

  const purposeOptions = useMemo(
    () =>
      [...new Set(patients.map((p) => p?.personal?.purpose))].filter(Boolean),
    [patients],
  );

  const filtered = useMemo(() => {
    let list = [...patients];
    const includesCI = (a = "", b = "") =>
      a.toLowerCase().includes(b.toLowerCase());

    if (filters.search) {
      list = list.filter(
        (p) =>
          includesCI(p.personal?.name, filters.search) ||
          includesCI(p.personal?.phone, filters.search) ||
          includesCI(p.personal?.email, filters.search),
      );
    }

    if (filters.status) {
      list = list.filter((p) => p.ops?.status === filters.status);
    }

    if (filters.location) {
      list = list.filter((p) => p.personal?.branch === filters.location);
    }

    if (filters.counsellor) {
      list = list.filter(
        (p) => p.counselling?.counsellor?.name === filters.counsellor,
      );
    }

    if (filters.reference) {
      list = list.filter(
        (p) => p.personal?.reference?.name === filters.reference,
      );
    }

    if (filters.technique) {
      list = list.filter(
        (p) =>
          includesCI(p.counselling?.techniqueSuggested, filters.technique) ||
          includesCI(p.personal?.techniqueQuoted, filters.technique),
      );
    }

    if (filters.purpose) {
      list = list.filter((p) => p.personal?.purpose === filters.purpose);
    }

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      list = list.filter((p) => {
        const visitDate = p.personal?.visitDate
          ? new Date(p.personal.visitDate)
          : null;
        return visitDate && visitDate >= fromDate;
      });
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      list = list.filter((p) => {
        const visitDate = p.personal?.visitDate
          ? new Date(p.personal.visitDate)
          : null;
        return visitDate && visitDate <= toDate;
      });
    }

    if (filters.minPackage) {
      const min = Number(filters.minPackage);
      list = list.filter(
        (p) =>
          (p.counselling?.finlpackage || 0) >= min ||
          (p.personal?.packageQuoted || 0) >= min,
      );
    }

    if (filters.maxPackage) {
      const max = Number(filters.maxPackage);
      list = list.filter(
        (p) =>
          (p.counselling?.finlpackage || 0) <= max ||
          (p.personal?.packageQuoted || 0) <= max,
      );
    }

    // Sort by visit date - most recent first
    list.sort((a, b) => {
      const dateA = a.personal?.visitDate ? new Date(a.personal.visitDate) : new Date(0);
      const dateB = b.personal?.visitDate ? new Date(b.personal.visitDate) : new Date(0);
      return dateB - dateA; // Descending order (newest first)
    });

    return list;
  }, [patients, filters]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const startIdx = (page - 1) * perPage;
  const endIdx = Math.min(startIdx + perPage, total);
  const rows = filtered.slice(startIdx, startIdx + perPage);
  const current = page;

  useEffect(() => setPage(1), [filters, perPage]);

  const clearFilters = () => {
    setFilters({
      search: "",
      status: "",
      location: "",
      counsellor: "",
      reference: "",
      technique: "",
      dateFrom: "",
      dateTo: "",
      minPackage: "",
      maxPackage: "",
      purpose: "",
    });
  };

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (filters.status)
      chips.push({ k: "status", label: `Status: ${filters.status}` });
    if (filters.location)
      chips.push({ k: "location", label: `Branch: ${filters.location}` });
    if (filters.counsellor)
      chips.push({
        k: "counsellor",
        label: `Counsellor: ${filters.counsellor}`,
      });
    if (filters.reference)
      chips.push({ k: "reference", label: `Reference: ${filters.reference}` });
    if (filters.technique)
      chips.push({ k: "technique", label: `Technique: ${filters.technique}` });
    if (filters.purpose)
      chips.push({ k: "purpose", label: `Purpose: ${filters.purpose}` });
    if (filters.dateFrom)
      chips.push({
        k: "dateFrom",
        label: `From: ${formatDate(filters.dateFrom)}`,
      });
    if (filters.dateTo)
      chips.push({ k: "dateTo", label: `To: ${formatDate(filters.dateTo)}` });
    if (filters.minPackage)
      chips.push({ k: "minPackage", label: `Min: ₹${filters.minPackage}` });
    if (filters.maxPackage)
      chips.push({ k: "maxPackage", label: `Max: ₹${filters.maxPackage}` });
    return chips;
  }, [filters]);

  const removeChip = (k) => {
    setFilters((f) => ({ ...f, [k]: "" }));
  };

  const hasActiveFilters = activeFilterChips.length > 0;

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">Loading…</div>
    );

  if (error)
    return (
      <div className="flex h-screen items-center justify-center">{error}</div>
    );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SalesSidebar />

      <main className="flex-1 p-6">
        <div className="flex justify-between align-middle mt-3 mb-10">
          <h1 className="text-3xl ml-2 underline font-bold">All Patients data</h1>

          <div className="flex gap-4">
            <div className="flex-1 w-80 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="pl-10 w-full border rounded-lg py-2"
                placeholder="Search name, phone, or email"
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
              />
            </div>

            <button
              onClick={() => setDrawerOpen(true)}
              className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${
                hasActiveFilters
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : ""
              }`}
            >
              <Filter className="w-4 h-4" />
              {hasActiveFilters ? "Filters Active" : "Filters"}
              {hasActiveFilters && (
                <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-indigo-600 text-white text-xs">
                  {activeFilterChips.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {activeFilterChips.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {activeFilterChips.map((chip) => (
              <button
                key={chip.k}
                onClick={() => removeChip(chip.k)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                <span>{chip.label}</span>
                <X className="w-3 h-3" />
              </button>
            ))}
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200 hover:bg-red-100 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700 text-xs uppercase">
                <tr>
                  <Th label="Patient" />
                  <Th label="Contact" />
                  <Th label="Reference" />
                  <Th label="Branch" />
                  <Th label="Purpose" />
                  <Th label="Visit Date" />
                  <Th label="Status" />
                  <Th label="Package" />
                  <Th label="Final" />
                  <Th label="Received" />
                  <Th label="Details" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="py-12 text-center text-gray-500"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <Search className="w-12 h-12 text-gray-300 mb-4" />
                        <p className="text-lg font-medium text-gray-900 mb-2">
                          No patients found
                        </p>
                        <p className="text-gray-500">
                          Try adjusting your search or filters
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((p) => (
                    <tr
                      key={p._id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {p.personal?.name}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        <div className="text-sm">
                          <div>{p.personal?.phone}</div>
                          {p.personal?.email && (
                            <div className="text-gray-500 text-xs">
                              {p.personal?.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {p.personal?.reference?.name || "N/A"}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {p.personal?.branch}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {p.personal?.purpose || "N/A"}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {formatDate(p.personal?.visitDate)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            STATUS_COLORS[p?.ops?.status] ||
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {p?.ops?.status?.replace("_", " ") || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-900 font-medium">
                        {formatCurrency(p.personal?.packageQuoted)}
                      </td>
                      <td className="px-6 py-4 text-orange-600 font-medium">
                        {formatCurrency(p.counselling?.finlpackage)}
                      </td>
                      <td className="px-6 py-4 text-green-600 font-medium">
                        {formatCurrency(p.payments?.amountReceived)}
                      </td>
                      <td className="px-6 py-4 text-green-600 font-medium">
                        <button
                          onClick={() =>
                            window.open(
                              `/sales/patients/${p._id}`,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t bg-gray-50">
            <p className="text-sm text-gray-600">
              Showing <b>{startIdx + 1}</b>–<b>{endIdx}</b> of <b>{total}</b>{" "}
              patients
            </p>

            <div className="flex items-center gap-3">
              <select
                className="text-sm border rounded-lg px-3 py-1.5"
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
              >
                {[20, 50, 100, 200].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={current <= 1}
                  className="p-2 border rounded-lg disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-sm w-16 text-center">
                  {current} / {pages}
                </span>

                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={current >= pages}
                  className="p-2 border rounded-lg disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b bg-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Advanced Filters
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Refine your patient search
                </p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                <Section
                  title="Basic Filters"
                  icon={<Filter className="w-4 h-4" />}
                >
                  <Field label="Status">
                    <Select
                      value={filters.status}
                      onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
                      options={[
                        { label: "All Status", value: "" },
                        ...STATUS_OPTIONS.map((s) => ({
                          label: s.replace("_", " "),
                          value: s,
                        })),
                      ]}
                    />
                  </Field>
                  <Field label="Branch">
                    <Select
                      value={filters.location}
                      onChange={(v) =>
                        setFilters((f) => ({ ...f, location: v }))
                      }
                      options={[
                        { label: "All Branches", value: "" },
                        ...LOCATION_OPTIONS.map((l) => ({
                          label: l,
                          value: l,
                        })),
                      ]}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Date From">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          type="date"
                          value={filters.dateFrom}
                          onChange={(v) =>
                            setFilters((f) => ({ ...f, dateFrom: v }))
                          }
                          className="pl-10"
                        />
                      </div>
                    </Field>
                    <Field label="Date To">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          type="date"
                          value={filters.dateTo}
                          onChange={(v) =>
                            setFilters((f) => ({ ...f, dateTo: v }))
                          }
                          className="pl-10"
                        />
                      </div>
                    </Field>
                  </div>
                </Section>

                <Section
                  title="Staff & Team"
                  icon={<User className="w-4 h-4" />}
                >
                  <Field label="Counsellor">
                    <Select
                      value={filters.counsellor}
                      onChange={(v) =>
                        setFilters((f) => ({ ...f, counsellor: v }))
                      }
                      options={[
                        { label: "All Counsellors", value: "" },
                        ...counsellorOptions.map((c) => ({
                          label: c,
                          value: c,
                        })),
                      ]}
                    />
                  </Field>
                  <Field label="Reference">
                    <Select
                      value={filters.reference}
                      onChange={(v) =>
                        setFilters((f) => ({ ...f, reference: v }))
                      }
                      options={[
                        { label: "All References", value: "" },
                        ...referenceOptions.map((a) => ({
                          label: a,
                          value: a,
                        })),
                      ]}
                    />
                  </Field>
                </Section>

                <Section
                  title="Treatment & Package"
                  icon={<Filter className="w-4 h-4" />}
                >
                  <Field label="Purpose">
                    <Select
                      value={filters.purpose}
                      onChange={(v) =>
                        setFilters((f) => ({ ...f, purpose: v }))
                      }
                      options={[
                        { label: "All Purposes", value: "" },
                        ...purposeOptions.map((p) => ({ label: p, value: p })),
                      ]}
                    />
                  </Field>
                  <Field label="Technique">
                    <Select
                      value={filters.technique}
                      onChange={(v) =>
                        setFilters((f) => ({ ...f, technique: v }))
                      }
                      options={[
                        { label: "All Techniques", value: "" },
                        ...techniqueOptions.map((t) => ({
                          label: t,
                          value: t,
                        })),
                      ]}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Min Package (₹)">
                      <Input
                        type="number"
                        value={filters.minPackage}
                        onChange={(v) =>
                          setFilters((f) => ({ ...f, minPackage: v }))
                        }
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Max Package (₹)">
                      <Input
                        type="number"
                        value={filters.maxPackage}
                        onChange={(v) =>
                          setFilters((f) => ({ ...f, maxPackage: v }))
                        }
                        placeholder="999999"
                      />
                    </Field>
                  </div>
                </Section>
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex items-center gap-3">
              <button
                onClick={clearFilters}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm"
              >
                Reset All
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium text-sm"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesPatientDashboard() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <SalesPatientDashboardContent />
    </Suspense>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold text-gray-800">{title}</span>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      {label && (
        <span className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </span>
      )}
      {children}
    </label>
  );
}

function Input({
  type = "text",
  value,
  onChange,
  placeholder,
  className = "",
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-colors ${className}`}
    />
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-colors bg-white"
    >
      {options.map((o) => (
        <option key={`${o.label}-${o.value}`} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}