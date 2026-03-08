"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebars/Sidebar";
import {
  Filter, X, ChevronRight, ChevronLeft,
  Eye, SquarePen, Search, Calendar,
  Download, ArrowLeft, Phone, MapPin,
  User, Scissors,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const STATUS_OPTIONS = ["NEW","NOT_VISITED","CONSULTED","NOT_CONVERTED","SURGERY_BOOKED","CLOSED"];

const STATUS_COLORS = {
  NEW:            "bg-blue-50 text-blue-700 border-blue-200",
  NOT_VISITED:    "bg-amber-50 text-amber-700 border-amber-200",
  CONSULTED:      "bg-purple-50 text-purple-700 border-purple-200",
  NOT_CONVERTED:  "bg-red-50 text-red-700 border-red-200",
  SURGERY_BOOKED: "bg-green-50 text-green-700 border-green-200",
  CLOSED:         "bg-gray-50 text-gray-700 border-gray-200",
};

const LOCATION_OPTIONS = ["Delhi", "Mumbai", "Hyderabad"];

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";

/* ─────────────────────────────────────────────
   Inner component (uses useSearchParams)
───────────────────────────────────────────── */
function PatientDashboardContent() {
  const searchParams = useSearchParams();

  /* ── State ── */
  const [patients, setPatients]         = useState([]);
  const [total, setTotal]               = useState(0);
  const [filterOptions, setFilterOptions] = useState({ counsellors: [], agents: [], techniques: [] });
  const optionsLoaded = useRef(false);

  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Search: separate input value vs debounced API value
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch]           = useState("");
  const debounceRef = useRef(null);

  const [filters, setFilters] = useState({
    status:          searchParams.get("status")       || "",
    branch:          searchParams.get("branch") === "All" ? "" : searchParams.get("branch") || "",
    counsellor:      "",
    agent:           "",
    technique:       "",
    surgeryDate:     searchParams.get("surgeryDate")  || "",
    dateFrom:        searchParams.get("dateFrom")     || "",
    dateTo:          searchParams.get("dateTo")       || "",
    visited:         searchParams.get("visited")      === "true",
    readyForSurgery: searchParams.get("readyForSurgery") === "true",
  });

  const [sort, setSort]       = useState({ key: "personal.visitDate", dir: "desc" });
  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(50);

  /* ── Debounce search ── */
  const handleSearchInput = (val) => {
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 400);
  };

  /* ── Fetch ── */
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page, limit: perPage,
          sortKey: sort.key, sortDir: sort.dir,
        });
        if (search)              params.set("search",          search);
        if (filters.status)      params.set("status",          filters.status);
        if (filters.branch)      params.set("branch",          filters.branch);
        if (filters.counsellor)  params.set("counsellor",      filters.counsellor);
        if (filters.agent)       params.set("agent",           filters.agent);
        if (filters.technique)   params.set("technique",       filters.technique);
        if (filters.surgeryDate) params.set("surgeryDate",     filters.surgeryDate);
        if (filters.dateFrom)    params.set("dateFrom",        filters.dateFrom);
        if (filters.dateTo)      params.set("dateTo",          filters.dateTo);
        if (filters.visited)     params.set("visited",         "true");
        if (filters.readyForSurgery) params.set("readyForSurgery", "true");

        const res  = await fetch(`/api/patients/get-patient?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch patient data");
        const data = await res.json();
        if (cancelled) return;

        setPatients(data.patients || []);
        setTotal(data.total || 0);

        // Load filter options only once
        if (!optionsLoaded.current && data.filterOptions) {
          setFilterOptions(data.filterOptions);
          optionsLoaded.current = true;
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [page, perPage, sort, search, filters]);

  /* ── Pagination ── */
  const pages   = Math.max(1, Math.ceil(total / perPage));
  const startIdx = (page - 1) * perPage;
  const endIdx   = Math.min(startIdx + perPage, total);

  /* ── Helpers ── */
  const applyFilter = (key, val) => {
    setFilters((f) => ({ ...f, [key]: val }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ status: "", branch: "", counsellor: "", agent: "", technique: "",
      surgeryDate: "", dateFrom: "", dateTo: "", visited: false, readyForSurgery: false });
    setPage(1);
  };

  const toggleSort = (key) => {
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
    setPage(1);
  };

  /* ── CSV Export (current page only — server filtered) ── */
  const exportToCSV = () => {
    const headers = ["Name","Phone","Branch","Visit Date","Status","Package","Received","Pending","Counsellor","Technique","Ready for Surgery","Surgery Date","Reference"];
    const csvData = patients.map((p) => [
      p.personal?.name || "", p.personal?.phone || "", p.personal?.branch || "",
      formatDate(p.personal?.visitDate), p.ops?.status || "",
      p.personal?.packageQuoted || 0, p.payments?.amountReceived || 0, p.payments?.pendingAmount || 0,
      p.counselling?.counsellor?.name || "",
      p.counselling?.techniqueSuggested || p.surgery?.technique || "",
      p.counselling?.readyForSurgery ? "Yes" : "No",
      formatDate(p.surgery?.surgeryDate), p.personal?.reference?.name || "",
    ]);
    const csv = [headers, ...csvData].map((r) => r.join(",")).join("\n");
    const url = window.URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `patients-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  /* ── Active filter chips ── */
  const activeFilterChips = [];
  if (filters.status)          activeFilterChips.push({ k: "status",          label: `Status: ${filters.status}` });
  if (filters.branch)          activeFilterChips.push({ k: "branch",          label: `Branch: ${filters.branch}` });
  if (filters.counsellor)      activeFilterChips.push({ k: "counsellor",      label: `Counsellor: ${filters.counsellor}` });
  if (filters.agent)           activeFilterChips.push({ k: "agent",           label: `Reference: ${filters.agent}` });
  if (filters.technique)       activeFilterChips.push({ k: "technique",       label: `Technique: ${filters.technique}` });
  if (filters.surgeryDate)     activeFilterChips.push({ k: "surgeryDate",     label: `Surgery: ${formatDate(filters.surgeryDate)}` });
  if (filters.dateFrom)        activeFilterChips.push({ k: "dateFrom",        label: `From: ${formatDate(filters.dateFrom)}` });
  if (filters.dateTo)          activeFilterChips.push({ k: "dateTo",          label: `To: ${formatDate(filters.dateTo)}` });
  if (filters.visited)         activeFilterChips.push({ k: "visited",         label: "Visited Patients" });
  if (filters.readyForSurgery) activeFilterChips.push({ k: "readyForSurgery", label: "Ready for Surgery" });

  const removeChip = (k) => {
    if (k === "visited" || k === "readyForSurgery") applyFilter(k, false);
    else applyFilter(k, "");
  };

  /* ─────────────────────────────────────────────
     Render
  ───────────────────────────────────────────── */
  if (error) return (
    <div className="flex h-screen items-center justify-center text-red-600 bg-gray-50">
      <div className="text-center">
        <p className="text-xl font-semibold mb-2">Error</p>
        <p>{error}</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">Patient Management</h1>
                <p className="text-sm text-gray-500 hidden sm:block">Comprehensive patient data overview</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setDrawerOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white text-gray-700 text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
                {activeFilterChips.length > 0 && (
                  <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-indigo-600 text-white text-xs">
                    {activeFilterChips.length}
                  </span>
                )}
              </button>

              {activeFilterChips.map((chip) => (
                <button
                  key={chip.k}
                  onClick={() => removeChip(chip.k)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200 hover:bg-red-100 transition-colors"
                >
                  {chip.label}
                  <X className="w-3 h-3" />
                </button>
              ))}

              {activeFilterChips.length > 0 && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200 hover:bg-red-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear All
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <div className="relative flex-1 sm:flex-none sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by name, phone..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-colors"
                  value={searchInput}
                  onChange={(e) => handleSearchInput(e.target.value)}
                />
              </div>
              <button
                onClick={exportToCSV}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
                title="Export CSV"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-auto">
          <div className="px-4 sm:px-6 py-4">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <Th label="Visit Date"  sortKey="personal.visitDate" sort={sort} onSort={toggleSort} className="w-36" />
                        <Th label="Name"        sortKey="personal.name"      sort={sort} onSort={toggleSort} />
                        <Th label="Number" />
                        <Th label="Branch" />
                        <Th label="Technique" />
                        <Th label="Package" />
                        <Th label="Received" />
                        <Th label="Pending" />
                        <Th label="Status" />
                        <Th label="Action" className="w-32" />
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {patients.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-16 text-center text-gray-500">
                            <div className="flex flex-col items-center justify-center">
                              <Search className="w-12 h-12 text-gray-300 mb-3" />
                              <p className="text-base font-medium text-gray-900 mb-1">No patients found</p>
                              <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        patients.map((p) => (
                          <tr key={p._id} className="hover:bg-gray-50 transition-colors">
                            <td className="w-36 px-4 py-3.5 text-sm text-gray-500">{formatDate(p.personal?.visitDate)}</td>
                            <td className="px-4 py-3.5 text-sm font-medium text-gray-900">{p.personal?.name || "Unknown"}</td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <Phone className="w-3.5 h-3.5 text-gray-400" />
                                {p.personal?.phone}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                {p.personal?.branch}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 hidden lg:table-cell">
                              <span className="text-xs text-gray-500">{p.counselling?.techniqueSuggested}</span>
                            </td>
                            <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">{p.counselling?.finlpackage}</td>
                            <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">{p.payments?.amountReceived}</td>
                            <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">{p.payments?.pendingAmount}</td>
                            <td className="px-0 py-3.5">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${STATUS_COLORS[p?.ops?.status] || "bg-gray-50 text-gray-700 border-gray-200"}`}>
                                {p?.ops?.status?.replace("_", " ") || "NEW"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => window.open(`/admin/patients/${p._id}`, "_blank", "noopener,noreferrer")}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  View
                                </button>
                                <Link
                                  href={`/admin/patients/edit/${p._id}`}
                                  className="inline-flex items-center gap-1.5 px-3 mr-5 py-1.5 rounded-md text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors"
                                >
                                  <SquarePen className="w-3.5 h-3.5" />
                                  Edit
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Pagination ── */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-700">Items per page:</label>
                  <select
                    className="text-sm border-2 border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                    value={perPage}
                    onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                  >
                    {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gray-600">
                    {total === 0 ? "0" : startIdx + 1}–{endIdx} of{" "}
                    <span className="text-indigo-600 font-medium">{total}</span>
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>
                    <span className="text-sm text-gray-600 w-16 text-center">{page} / {pages}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(pages, p + 1))}
                      disabled={page >= pages}
                      className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Filter Drawer ── */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
            <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
              <div className="px-6 py-4 border-b bg-white flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Advanced Filters</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Refine your patient search</p>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-6">
                  {/* Basic Filters */}
                  <Section title="Basic Filters" icon={<Filter className="w-4 h-4" />}>
                    <Field label="Status">
                      <Select
                        value={filters.status}
                        onChange={(v) => applyFilter("status", v)}
                        options={[
                          { label: "All Status", value: "" },
                          ...STATUS_OPTIONS.map((s) => ({ label: s.replace(/_/g, " "), value: s })),
                        ]}
                      />
                    </Field>
                    <Field label="Branch">
                      <Select
                        value={filters.branch}
                        onChange={(v) => applyFilter("branch", v)}
                        options={[
                          { label: "All Branches", value: "" },
                          ...LOCATION_OPTIONS.map((l) => ({ label: l, value: l })),
                        ]}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Date From">
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <Input type="date" value={filters.dateFrom} onChange={(v) => applyFilter("dateFrom", v)} className="pl-10" />
                        </div>
                      </Field>
                      <Field label="Date To">
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <Input type="date" value={filters.dateTo} onChange={(v) => applyFilter("dateTo", v)} className="pl-10" />
                        </div>
                      </Field>
                    </div>
                  </Section>

                  {/* Staff & Team */}
                  <Section title="Staff & Team" icon={<User className="w-4 h-4" />}>
                    <Field label="Counsellor">
                      <Select
                        value={filters.counsellor}
                        onChange={(v) => applyFilter("counsellor", v)}
                        options={[
                          { label: "All Counsellors", value: "" },
                          ...filterOptions.counsellors.map((c) => ({ label: c, value: c })),
                        ]}
                      />
                    </Field>
                    <Field label="Reference (Agent)">
                      <Select
                        value={filters.agent}
                        onChange={(v) => applyFilter("agent", v)}
                        options={[
                          { label: "All References", value: "" },
                          ...filterOptions.agents.map((a) => ({ label: a, value: a })),
                        ]}
                      />
                    </Field>
                  </Section>

                  {/* Surgery Details */}
                  <Section title="Surgery Details" icon={<Scissors className="w-4 h-4" />}>
                    <Field label="Technique">
                      <Select
                        value={filters.technique}
                        onChange={(v) => applyFilter("technique", v)}
                        options={[
                          { label: "All Techniques", value: "" },
                          ...filterOptions.techniques.map((t) => ({ label: t, value: t })),
                        ]}
                      />
                    </Field>
                    <Field label="Surgery Date">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input type="date" value={filters.surgeryDate} onChange={(v) => applyFilter("surgeryDate", v)} className="pl-10" />
                      </div>
                    </Field>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={filters.visited}
                          onChange={(e) => applyFilter("visited", e.target.checked)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Visited Patients Only</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={filters.readyForSurgery}
                          onChange={(e) => applyFilter("readyForSurgery", e.target.checked)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Ready for Surgery Only</span>
                      </label>
                    </div>
                  </Section>
                </div>
              </div>

              <div className="px-6 py-4 border-t bg-gray-50 flex items-center gap-3">
                <button
                  onClick={() => { clearFilters(); setDrawerOpen(false); }}
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
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Default export with Suspense boundary
───────────────────────────────────────────── */
export default function PatientDashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen bg-gray-50">
          <Sidebar />
          <main className="flex-1 flex items-center justify-center">
            <div className="animate-spin h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
          </main>
        </div>
      }
    >
      <PatientDashboardContent />
    </Suspense>
  );
}

/* ─────────────────────────────────────────────
   UI atoms
───────────────────────────────────────────── */
function Th({ label, sortKey, sort, onSort, className = "" }) {
  const isSortable = !!sortKey;
  const active = isSortable && sort?.key === sortKey;
  return (
    <th
      className={`px-4 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${isSortable ? "cursor-pointer select-none hover:bg-gray-100" : ""} ${className}`}
      onClick={isSortable ? () => onSort(sortKey) : undefined}
    >
      <div className="inline-flex items-center gap-1.5">
        {label}
        {active && <span className="text-[10px] text-gray-400">{sort.dir === "asc" ? "▲" : "▼"}</span>}
      </div>
    </th>
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
      {label && <span className="block text-sm font-medium text-gray-700 mb-2">{label}</span>}
      {children}
    </label>
  );
}

function Input({ type = "text", value, onChange, placeholder, className = "" }) {
  return (
    <input
      type={type} value={value} placeholder={placeholder}
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
      {options.map((o) => <option key={`${o.label}-${o.value}`} value={o.value}>{o.label}</option>)}
    </select>
  );
}
