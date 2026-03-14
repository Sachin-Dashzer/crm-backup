"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import SuperAdminSidebar from "@/components/Sidebars/SuperAdminSidebar";
import {
  Search,
  Filter,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  Users,
  Tag,
  Calendar,
  Loader2,
  Mail,
  MessageSquare,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const TAG_OPTIONS = [
  "Google Leads",
  "Meta Leads",
  "Form Leads",
  "Collab Leads",
];

const LOCATION_OPTIONS = [
  "Agra","Ahmedabad","Amritsar","Aurangabad","Bengaluru","Bhopal",
  "Bhubaneswar","Chandigarh","Chennai","Coimbatore","Dehradun","Delhi",
  "Faridabad","Ghaziabad","Gurgaon","Guwahati","Gwalior","Hyderabad",
  "India","Indore","Jabalpur","Jaipur","Jammu","Jodhpur","Kanpur",
  "Kochi","Kolkata","Kolhapur","Kota","Lucknow","Ludhiana","Mangalore",
  "Mumbai","Mysuru","Nagpur","Nashik","Noida","Patna","Pune","Raipur",
  "Rajkot","Ranchi","Shimla","Solapur","Srinagar","Surat",
  "Thiruvananthapuram","Udaipur","Vadodara","Varanasi","Vijayawada",
  "Visakhapatnam",
];

const TAG_STYLES = {
  "Google Leads":  "bg-blue-100 text-blue-700 border-blue-200",
  "Meta Leads":    "bg-indigo-100 text-indigo-700 border-indigo-200",
  "Form Leads":    "bg-green-100 text-green-700 border-green-200",
  "Collab Leads":  "bg-purple-100 text-purple-700 border-purple-200",
};

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

const EMPTY_FILTERS = {
  city: "",
  visitPlan: "",
  tag: "",
  createdFrom: "",
  createdTo: "",
  visitFrom: "",
  visitTo: "",
  hasEmail: "",
  hasRemarks: "",
};

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function fmt(date, includeTime = false) {
  if (!date) return "—";
  const d = new Date(date);
  const datePart = d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  if (!includeTime) return datePart;
  const timePart = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
}

function fmtFilterLabel(val) {
  if (!val) return "";
  // val is either YYYY-MM-DD or YYYY-MM-DDTHH:mm
  if (val.includes("T")) {
    const timePart = val.split("T")[1];
    const d = new Date(val);
    return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}, ${timePart}`;
  }
  return fmt(val);
}

function TagBadge({ tag }) {
  if (!tag) return <span className="text-gray-400">—</span>;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${TAG_STYLES[tag] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {tag}
    </span>
  );
}

function buildExportParams(search, filters) {
  const params = new URLSearchParams({ export: "true" });
  if (search)               params.set("search", search);
  if (filters.city)         params.set("city", filters.city);
  if (filters.visitPlan)    params.set("visitPlan", filters.visitPlan);
  if (filters.tag)          params.set("tag", filters.tag);
  if (filters.createdFrom)  params.set("createdFrom", filters.createdFrom);
  if (filters.createdTo)    params.set("createdTo", filters.createdTo);
  if (filters.visitFrom)    params.set("visitFrom", filters.visitFrom);
  if (filters.visitTo)      params.set("visitTo", filters.visitTo);
  if (filters.hasEmail)     params.set("hasEmail", filters.hasEmail);
  if (filters.hasRemarks)   params.set("hasRemarks", filters.hasRemarks);
  return params;
}

function leadsToCSV(leads) {
  const headers = [
    "Name","Phone","Email","Location","Visit Plan",
    "Visit Date","Tag","Remarks","Created At",
  ];
  const rows = leads.map((l) => [
    l.name || "",
    l.phone || "",
    l.email || "",
    l.location || "",
    l.visitPlan || "",
    l.visitDate ? fmt(l.visitDate) : "",
    l.tag || "",
    l.remarks || "",
    l.createdAt ? fmt(l.createdAt, true) : "",
  ]);
  return [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */
export default function LeadsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect non-super-admins
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "super-admin") {
      router.replace("/admin/dashboard");
    }
  }, [status, session]);

  // Data
  const [leads, setLeads]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [tagCounts, setTagCounts] = useState({});
  const [loading, setLoading]   = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch]           = useState("");
  const [filters, setFilters]         = useState(EMPTY_FILTERS);
  const [drawerOpen, setDrawerOpen]   = useState(false);

  // Pagination
  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(50);

  // Debounce search — 400 ms
  const debounceRef = useRef(null);
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
    const fetchLeads = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page, limit: perPage });
        if (search)               params.set("search", search);
        if (filters.city)         params.set("city", filters.city);
        if (filters.visitPlan)    params.set("visitPlan", filters.visitPlan);
        if (filters.tag)          params.set("tag", filters.tag);
        if (filters.createdFrom)  params.set("createdFrom", filters.createdFrom);
        if (filters.createdTo)    params.set("createdTo", filters.createdTo);
        if (filters.visitFrom)    params.set("visitFrom", filters.visitFrom);
        if (filters.visitTo)      params.set("visitTo", filters.visitTo);
        if (filters.hasEmail)     params.set("hasEmail", filters.hasEmail);
        if (filters.hasRemarks)   params.set("hasRemarks", filters.hasRemarks);

        const res  = await fetch(`/api/leads/get?${params.toString()}`);
        const data = await res.json();
        if (cancelled) return;
        setLeads(data.leads || []);
        setTotal(data.total || 0);
        setTagCounts(data.tagCounts || {});
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchLeads();
    return () => { cancelled = true; };
  }, [page, perPage, search, filters]);

  /* ── Download all filtered leads as CSV ── */
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const params = buildExportParams(search, filters);
      const res    = await fetch(`/api/leads/get?${params.toString()}`);
      const data   = await res.json();
      const allLeads = data.leads || [];
      if (!allLeads.length) return;

      const csv = leadsToCSV(allLeads);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  // Helpers
  const applyFilter = (key, val) => {
    setFilters((f) => ({ ...f, [key]: val }));
    setPage(1);
  };
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  /* ── Pagination ── */
  const pages    = Math.max(1, Math.ceil(total / perPage));
  const startIdx = (page - 1) * perPage;

  /* ── Active filter chips ── */
  const chips = [];
  if (filters.city)         chips.push({ k: "city",         label: `City: ${filters.city}` });
  if (filters.visitPlan)    chips.push({ k: "visitPlan",    label: `Visit Plan: ${filters.visitPlan}` });
  if (filters.tag)          chips.push({ k: "tag",          label: `Tag: ${filters.tag}` });
  if (filters.createdFrom)  chips.push({ k: "createdFrom",  label: `From: ${fmtFilterLabel(filters.createdFrom)}` });
  if (filters.createdTo)    chips.push({ k: "createdTo",    label: `To: ${fmtFilterLabel(filters.createdTo)}` });
  if (filters.visitFrom)    chips.push({ k: "visitFrom",    label: `Visit From: ${fmtFilterLabel(filters.visitFrom)}` });
  if (filters.visitTo)      chips.push({ k: "visitTo",      label: `Visit To: ${fmtFilterLabel(filters.visitTo)}` });
  if (filters.hasEmail)     chips.push({ k: "hasEmail",     label: `Email: ${filters.hasEmail === "true" ? "Has Email" : "No Email"}` });
  if (filters.hasRemarks)   chips.push({ k: "hasRemarks",   label: `Remarks: ${filters.hasRemarks === "true" ? "Has Remarks" : "No Remarks"}` });

  const activeFilterCount = chips.length + (search ? 1 : 0);

  /* ─────────────────────────────────────────────
     Render
  ───────────────────────────────────────────── */
  return (
    <div className="flex min-h-screen bg-gray-50">
      <SuperAdminSidebar />
      <main className="flex-1 flex flex-col">

        {/* ── Header ── */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Leads</h1>
              <p className="text-sm text-gray-500">
                All incoming leads before conversion to patients
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-white shadow-sm hover:bg-gray-50 text-gray-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {downloading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Download className="w-4 h-4" />
                }
                {downloading ? "Downloading…" : `Download CSV${activeFilterCount > 0 ? ` (${total})` : ""}`}
              </button>
              <button
                onClick={() => setDrawerOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-white shadow-sm hover:bg-gray-50 text-gray-700 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
                {chips.length > 0 && (
                  <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                    {chips.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {chips.length > 0 && (
            <div className="px-6 pb-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <span
                  key={c.k}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium border border-indigo-200"
                >
                  {c.label}
                  <button onClick={() => applyFilter(c.k, "")}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={clearFilters}
                className="text-sm text-gray-600 hover:text-gray-900 underline"
              >
                Clear all
              </button>
            </div>
          )}
        </header>

        {/* ── Summary Cards ── */}
        <div className="px-6 pt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
          <SummaryCard icon={<Tag className="w-5 h-5" />}   title="Google Leads" value={tagCounts["Google Leads"] || 0} color="blue" />
          <SummaryCard icon={<Tag className="w-5 h-5" />}   title="Meta Leads"   value={tagCounts["Meta Leads"]   || 0} color="indigo" />
          <SummaryCard icon={<Tag className="w-5 h-5" />}   title="Form Leads"   value={tagCounts["Form Leads"]   || 0} color="green" />
          <SummaryCard icon={<Users className="w-5 h-5" />} title="Total Leads"  value={tagCounts._total          || 0} color="orange" />
        </div>

        {/* ── Search ── */}
        <div className="px-6 pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by name, phone or email…"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-colors"
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
            />
          </div>
        </div>

        {/* ── Table ── */}
        <section className="p-6">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700 text-xs uppercase">
                    <tr>
                      {["#","Name","Phone","Location","Tag","Visit Plan","Visit Date","Remarks","Created At"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leads.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-16 text-center text-gray-400">
                          <Search className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                          <p className="text-base font-medium text-gray-600">No leads found</p>
                          <p className="text-sm">Try adjusting your search or filters</p>
                        </td>
                      </tr>
                    ) : (
                      leads.map((lead, idx) => (
                        <tr key={lead._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-400">{startIdx + idx + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{lead.name}</td>
                          <td className="px-4 py-3 text-gray-700">{lead.phone}</td>
                          <td className="px-4 py-3 text-gray-600">{lead.location || "—"}</td>
                          <td className="px-4 py-3"><TagBadge tag={lead.tag} /></td>
                          <td className="px-4 py-3 text-gray-600">{lead.visitPlan || "—"}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(lead.visitDate)}</td>
                          <td className="px-4 py-3 text-gray-500 max-w-45 truncate" title={lead.remarks}>{lead.remarks || "—"}</td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(lead.createdAt, true)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!loading && total > 0 && (
              <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-6 py-4 border-t bg-gray-50">
                <p className="text-sm text-gray-600">
                  Showing <b>{startIdx + 1}</b>–<b>{Math.min(startIdx + perPage, total)}</b> of <b>{total}</b> leads
                </p>
                <div className="flex items-center gap-3">
                  <select
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-200"
                    value={perPage}
                    onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                  >
                    {PER_PAGE_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n} / page</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-600 w-16 text-center">{page} / {pages}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(pages, p + 1))}
                      disabled={page >= pages}
                      className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Filter Drawer ── */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col">

              {/* Drawer header */}
              <div className="px-6 py-4 border-b bg-linear-to-r from-indigo-600 to-indigo-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-white" />
                  <h3 className="text-lg font-semibold text-white">Filters</h3>
                  {chips.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-medium">
                      {chips.length} active
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">

                {/* Tag */}
                <FilterSection title="Lead Source / Tag" icon={<Tag className="w-4 h-4" />}>
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip active={filters.tag === ""} onClick={() => applyFilter("tag", "")} color="gray">All</ToggleChip>
                    {TAG_OPTIONS.map((t) => (
                      <ToggleChip
                        key={t}
                        active={filters.tag === t}
                        onClick={() => applyFilter("tag", filters.tag === t ? "" : t)}
                        color={t === "Google Leads" ? "blue" : t === "Meta Leads" ? "indigo" : t === "Form Leads" ? "green" : "purple"}
                      >
                        {t}
                      </ToggleChip>
                    ))}
                  </div>
                </FilterSection>

                {/* City */}
                <FilterSection title="City" icon={<Search className="w-4 h-4" />}>
                  <select
                    value={filters.city}
                    onChange={(e) => applyFilter("city", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 bg-white"
                  >
                    <option value="">All Cities</option>
                    {LOCATION_OPTIONS.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </FilterSection>

                {/* Visit Plan */}
                <FilterSection title="Visit Plan" icon={<Calendar className="w-4 h-4" />}>
                  <input
                    type="text"
                    placeholder="e.g. Next Week, This Month…"
                    value={filters.visitPlan}
                    onChange={(e) => applyFilter("visitPlan", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </FilterSection>

                {/* Created At date+time range */}
                <FilterSection title="Created At" icon={<Calendar className="w-4 h-4" />}>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">From (date & time)</label>
                      <input
                        type="datetime-local"
                        value={filters.createdFrom}
                        onChange={(e) => applyFilter("createdFrom", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">To (date & time)</label>
                      <input
                        type="datetime-local"
                        value={filters.createdTo}
                        onChange={(e) => applyFilter("createdTo", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                      />
                    </div>
                    {(filters.createdFrom || filters.createdTo) && (
                      <button
                        onClick={() => { applyFilter("createdFrom", ""); applyFilter("createdTo", ""); }}
                        className="text-xs text-red-500 hover:text-red-700 underline"
                      >
                        Clear created date range
                      </button>
                    )}
                  </div>
                </FilterSection>

                {/* Visit Date range */}
                <FilterSection title="Visit Date" icon={<Calendar className="w-4 h-4" />}>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">From (date & time)</label>
                      <input
                        type="datetime-local"
                        value={filters.visitFrom}
                        onChange={(e) => applyFilter("visitFrom", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">To (date & time)</label>
                      <input
                        type="datetime-local"
                        value={filters.visitTo}
                        onChange={(e) => applyFilter("visitTo", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                      />
                    </div>
                    {(filters.visitFrom || filters.visitTo) && (
                      <button
                        onClick={() => { applyFilter("visitFrom", ""); applyFilter("visitTo", ""); }}
                        className="text-xs text-red-500 hover:text-red-700 underline"
                      >
                        Clear visit date range
                      </button>
                    )}
                  </div>
                </FilterSection>

                {/* Has Email */}
                <FilterSection title="Email" icon={<Mail className="w-4 h-4" />}>
                  <div className="flex gap-2">
                    <ToggleChip active={filters.hasEmail === ""}      onClick={() => applyFilter("hasEmail", "")}      color="gray">Any</ToggleChip>
                    <ToggleChip active={filters.hasEmail === "true"} onClick={() => applyFilter("hasEmail", "true")} color="green">Has Email</ToggleChip>
                    <ToggleChip active={filters.hasEmail === "false"} onClick={() => applyFilter("hasEmail", "false")} color="red">No Email</ToggleChip>
                  </div>
                </FilterSection>

                {/* Has Remarks */}
                <FilterSection title="Remarks" icon={<MessageSquare className="w-4 h-4" />}>
                  <div className="flex gap-2">
                    <ToggleChip active={filters.hasRemarks === ""}      onClick={() => applyFilter("hasRemarks", "")}      color="gray">Any</ToggleChip>
                    <ToggleChip active={filters.hasRemarks === "true"} onClick={() => applyFilter("hasRemarks", "true")} color="green">Has Remarks</ToggleChip>
                    <ToggleChip active={filters.hasRemarks === "false"} onClick={() => applyFilter("hasRemarks", "false")} color="red">No Remarks</ToggleChip>
                  </div>
                </FilterSection>

              </div>

              {/* Drawer footer */}
              <div className="px-5 py-4 border-t bg-gray-50 flex gap-3">
                <button
                  onClick={() => { clearFilters(); setDrawerOpen(false); }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors"
                >
                  Reset All
                </button>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium text-sm transition-colors"
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
   Sub-components
───────────────────────────────────────────── */
function SummaryCard({ icon, title, value, color }) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    green:  "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
    blue:   "bg-blue-50 text-blue-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      </div>
      <div className={`p-3 rounded-lg ${colors[color]}`}>{icon}</div>
    </div>
  );
}

function FilterSection({ title, icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-indigo-600">{icon}</span>
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function ToggleChip({ active, onClick, color = "gray", children }) {
  const base = "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer";
  const colorMap = {
    gray:   active ? "bg-gray-700 text-white border-gray-700" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50",
    blue:   active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-blue-50",
    indigo: active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:bg-indigo-50",
    green:  active ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-300 hover:bg-green-50",
    purple: active ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-300 hover:bg-purple-50",
    red:    active ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-600 border-gray-300 hover:bg-red-50",
  };
  return (
    <button className={`${base} ${colorMap[color]}`} onClick={onClick}>
      {children}
    </button>
  );
}
