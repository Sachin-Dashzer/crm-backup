"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebars/Sidebar";
import {
  Search, Filter, X, Download,
  ChevronLeft, ChevronRight, Users, Tag,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const TAG_OPTIONS = ["Google Leads", "Meta Leads", "Form Leads", "Collab Leads"];

const TAG_STYLES = {
  "Google Leads": "bg-blue-100 text-blue-700 border-blue-200",
  "Meta Leads":   "bg-indigo-100 text-indigo-700 border-indigo-200",
  "Form Leads":   "bg-green-100 text-green-700 border-green-200",
  "Collab Leads": "bg-purple-100 text-purple-700 border-purple-200",
};

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function fmt(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function TagBadge({ tag }) {
  if (!tag) return <span className="text-gray-400">—</span>;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${TAG_STYLES[tag] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {tag}
    </span>
  );
}

function downloadCSV(leads) {
  if (!leads.length) return;
  const headers = ["Name","Phone","Email","Location","Visit Plan","Visit Date","Tag","Remarks","Created At"];
  const rows = leads.map((l) => [
    l.name || "", l.phone || "", l.email || "", l.location || "",
    l.visitPlan || "", l.visitDate ? fmt(l.visitDate) : "",
    l.tag || "", l.remarks || "", l.createdAt ? fmt(l.createdAt) : "",
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */
export default function LeadsPage() {
  // Data
  const [leads, setLeads]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [tagCounts, setTagCounts] = useState({});
  const [loading, setLoading]     = useState(true);

  // Filters
  const [searchInput, setSearchInput] = useState("");  // raw input value
  const [search, setSearch]           = useState("");  // debounced value sent to API
  const [filters, setFilters]         = useState({ location: "", visitPlan: "", tag: "", from: "", to: "" });
  const [drawerOpen, setDrawerOpen]   = useState(false);

  // Pagination (server-side)
  const [page, setPage]     = useState(1);
  const [perPage, setPerPage] = useState(10);

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
        if (search)           params.set("search", search);
        if (filters.location) params.set("location", filters.location);
        if (filters.visitPlan)params.set("visitPlan", filters.visitPlan);
        if (filters.tag)      params.set("tag", filters.tag);
        if (filters.from)     params.set("from", filters.from);
        if (filters.to)       params.set("to", filters.to);

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

  // Reset to page 1 when filters change
  const applyFilter = (key, val) => {
    setFilters((f) => ({ ...f, [key]: val }));
    setPage(1);
  };
  const clearFilters = () => {
    setFilters({ location: "", visitPlan: "", tag: "", from: "", to: "" });
    setPage(1);
  };

  /* ── Pagination ── */
  const pages   = Math.max(1, Math.ceil(total / perPage));
  const startIdx = (page - 1) * perPage;

  /* ── Active filter chips ── */
  const chips = [];
  if (filters.location)  chips.push({ k: "location",  label: `Location: ${filters.location}` });
  if (filters.visitPlan) chips.push({ k: "visitPlan", label: `Visit Plan: ${filters.visitPlan}` });
  if (filters.tag)       chips.push({ k: "tag",       label: `Tag: ${filters.tag}` });
  if (filters.from)      chips.push({ k: "from",      label: `From: ${fmt(filters.from)}` });
  if (filters.to)        chips.push({ k: "to",        label: `To: ${fmt(filters.to)}` });

  /* ─────────────────────────────────────────────
     Render
  ───────────────────────────────────────────── */
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col">

        {/* ── Header ── */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Leads</h1>
              <p className="text-sm text-gray-500">All incoming leads before conversion to patients</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => downloadCSV(leads)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-white shadow-sm hover:bg-gray-50 text-gray-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download CSV
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
                <span key={c.k} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium border border-indigo-200">
                  {c.label}
                  <button onClick={() => applyFilter(c.k, "")}><X className="w-3 h-3" /></button>
                </span>
              ))}
              <button onClick={clearFilters} className="text-sm text-gray-600 hover:text-gray-900 underline">
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
                      {["#","Name","Phone","Email","Location","Visit Plan","Visit Date","Tag","Remarks","Created At"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leads.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-16 text-center text-gray-400">
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
                          <td className="px-4 py-3 text-gray-600">{lead.email || "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{lead.location || "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{lead.visitPlan || "—"}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(lead.visitDate)}</td>
                          <td className="px-4 py-3"><TagBadge tag={lead.tag} /></td>
                          <td className="px-4 py-3 text-gray-500 max-w-45 truncate" title={lead.remarks}>{lead.remarks || "—"}</td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(lead.createdAt)}</td>
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
                    {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n} / page</option>)}
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
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
            <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white shadow-xl flex flex-col">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
                <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Delhi"
                    value={filters.location}
                    onChange={(e) => applyFilter("location", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Visit Plan</label>
                  <input
                    type="text"
                    placeholder="e.g. Next Week"
                    value={filters.visitPlan}
                    onChange={(e) => applyFilter("visitPlan", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tag</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => applyFilter("tag", "")}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        filters.tag === "" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      All
                    </button>
                    {TAG_OPTIONS.map((t) => (
                      <button
                        key={t}
                        onClick={() => applyFilter("tag", filters.tag === t ? "" : t)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          filters.tag === t ? TAG_STYLES[t] + " ring-2 ring-offset-1 ring-current" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created From</label>
                  <input
                    type="date"
                    value={filters.from}
                    onChange={(e) => applyFilter("from", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created To</label>
                  <input
                    type="date"
                    value={filters.to}
                    onChange={(e) => applyFilter("to", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t bg-gray-50 flex gap-3">
                <button
                  onClick={() => { clearFilters(); setDrawerOpen(false); }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium"
                >
                  Reset
                </button>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

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
