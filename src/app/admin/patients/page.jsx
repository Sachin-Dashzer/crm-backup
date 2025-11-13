"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { Filter, X, ChevronRight, ChevronLeft, Search, Calendar } from "lucide-react";

/* -------------------- Constants -------------------- */

const STATUS_OPTIONS = [
  "NEW", "NOT-VISITED", "CONSULTED", "SURGERY_BOOKED", "CLOSED",
];
const STATUS_COLORS = {
  NEW: "bg-blue-100 text-blue-800",
  NOT_VISITED: "bg-amber-100 text-amber-800",
  CONSULTED: "bg-purple-100 text-purple-800",
  SURGERY_BOOKED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
};
const LOCATION_OPTIONS = ["Delhi", "Mumbai", "Hyderabad"];

/* -------------------- Helpers -------------------- */
const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "N/A";

const getInitialFiltersFromURL = (sp) => ({
  search: "",
  status: sp.get("status") || "",
  location: sp.get("branch") === "All" ? "" : sp.get("branch") || "",
  counsellor: sp.get("counsellor") || "",
  dateFrom: sp.get("dateFrom") || "",
  dateTo: sp.get("dateTo") || "",
  agent: "",
  doctor: "",
  seniorTech: "",
  implanter: "",
  technique: "",
  surgeryDate: sp.get("surgeryDate") || "",
  visited: sp.get("visited") === "true",
  readyForSurgery: sp.get("readyForSurgery") === "true",
});

/* ===================================================
   Patient Dashboard
=================================================== */
export default function PatientDashboard() {
  const searchParams = useSearchParams();

  /* ------------ State ------------ */
  const [patients, setPatients] = useState([]);
  const [filters, setFilters] = useState(() =>
    getInitialFiltersFromURL(searchParams)
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [sort, setSort] = useState({ key: "personal.visitDate", dir: "desc" });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  /* ------------ Data Fetch ------------ */
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/get-patient");
        if (!res.ok) throw new Error("Failed to fetch patient data");
        const data = await res.json();
        setPatients(data.patients || []);
      } catch (e) {
        setError(e.message || "Error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  /* ------------ Dynamic options ------------ */
  const counsellorOptions = useMemo(
    () =>
      [...new Set(patients.map((p) => p?.counselling?.counsellor?.name))].filter(
        Boolean
      ),
    [patients]
  );
  
  const doctorOptions = useMemo(
    () => [...new Set(patients.map((p) => p?.surgery?.doctor?.name))].filter(Boolean),
    [patients]
  );
  
  const seniorTechOptions = useMemo(
    () =>
      [...new Set(patients.map((p) => p?.surgery?.seniorTech?.name))].filter(Boolean),
    [patients]
  );
  
  const implanterOptions = useMemo(
    () =>
      [
        ...new Set([
          ...patients.map((p) => p?.surgery?.implanterRight?.name),
          ...patients.map((p) => p?.surgery?.implanterLeft?.name),
        ]),
      ].filter(Boolean),
    [patients]
  );
  
  const techniqueOptions = useMemo(
    () =>
      [
        ...new Set([
          ...patients.map((p) => p?.counselling?.techniqueSuggested),
          ...patients.map((p) => p?.surgery?.technique),
          ...patients.map((p) => p?.personal?.techniqueQuoted),
        ]),
      ].filter(Boolean),
    [patients]
  );

  const agentOptions = useMemo(
    () =>
      [...new Set(patients.map((p) => p?.personal?.reference?.name))].filter(Boolean),
    [patients]
  );

  /* ------------ Filtering + Sorting ------------ */
  const filtered = useMemo(() => {
    let list = [...patients];

    const includesCI = (a = "", b = "") =>
      a.toString().toLowerCase().includes(b.toString().toLowerCase());

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (p) =>
          includesCI(p?.personal?.name, q) ||
          includesCI(p?.personal?.phone, q) ||
          includesCI(p?.personal?.email, q)
      );
    }
    
    if (filters.status)
      list = list.filter((p) => p?.ops?.status === filters.status);
    
    if (filters.location)
      list = list.filter((p) => p?.personal?.branch === filters.location);
    
    if (filters.counsellor)
      list = list.filter(
        (p) => p?.counselling?.counsellor?.name === filters.counsellor
      );
    
    if (filters.visited) {
      list = list.filter((p) => Boolean(p?.counselling?.counsellor));
    }

    if (filters.readyForSurgery) {
      list = list.filter((p) => p?.counselling?.readyForSurgery === true);
    }
    
    if (filters.agent)
      list = list.filter((p) => p?.personal?.reference?.name === filters.agent);
    
    if (filters.doctor)
      list = list.filter((p) => p?.surgery?.doctor?.name === filters.doctor);
    
    if (filters.seniorTech)
      list = list.filter((p) => p?.surgery?.seniorTech?.name === filters.seniorTech);
    
    if (filters.implanter) {
      list = list.filter(
        (p) =>
          p?.surgery?.implanterRight?.name === filters.implanter ||
          p?.surgery?.implanterLeft?.name === filters.implanter
      );
    }
    
    if (filters.technique) {
      list = list.filter(
        (p) =>
          p?.counselling?.techniqueSuggested === filters.technique ||
          p?.surgery?.technique === filters.technique ||
          p?.personal?.techniqueQuoted === filters.technique
      );
    }
    
    if (filters.surgeryDate) {
      const sd = new Date(filters.surgeryDate);
      const start = new Date(sd);
      start.setHours(0, 0, 0, 0);
      const end = new Date(sd);
      end.setHours(23, 59, 59, 999);
      list = list.filter((p) => {
        const d = p?.surgery?.surgeryDate
          ? new Date(p.surgery.surgeryDate)
          : null;
        return d && d >= start && d <= end;
      });
    }
    
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      list = list.filter((p) => new Date(p?.personal?.visitDate) >= from);
    }
    
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((p) => new Date(p?.personal?.visitDate) <= to);
    }

    // sort
    const getVal = (obj, key) =>
      key.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
    list.sort((a, b) => {
      const av = getVal(a, sort.key);
      const bv = getVal(b, sort.key);
      if (av == null && bv == null) return 0;
      if (av == null) return sort.dir === "asc" ? -1 : 1;
      if (bv == null) return sort.dir === "asc" ? 1 : -1;
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [patients, filters, sort]);

  /* ------------ Pagination ------------ */
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(page, pages);
  const startIdx = (current - 1) * perPage;
  const endIdx = Math.min(startIdx + perPage, total);
  const rows = filtered.slice(startIdx, endIdx);

  useEffect(() => setPage(1), [filters, perPage]);

  /* ------------ UI Actions ------------ */
  const clearFilters = () =>
    setFilters(getInitialFiltersFromURL(new URLSearchParams()));
  const toggleSort = (key) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );

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
    if (filters.agent)
      chips.push({ k: "agent", label: `Reference: ${filters.agent}` });
    if (filters.technique)
      chips.push({ k: "technique", label: `Technique: ${filters.technique}` });
    if (filters.doctor)
      chips.push({ k: "doctor", label: `Doctor: ${filters.doctor}` });
    if (filters.seniorTech)
      chips.push({
        k: "seniorTech",
        label: `Senior Tech: ${filters.seniorTech}`,
      });
    if (filters.implanter)
      chips.push({ k: "implanter", label: `Implanter: ${filters.implanter}` });
    if (filters.surgeryDate)
      chips.push({
        k: "surgeryDate",
        label: `Surgery: ${formatDate(filters.surgeryDate)}`,
      });
    if (filters.visited)
      chips.push({ k: "visited", label: "Visited Patients" });
    if (filters.readyForSurgery)
      chips.push({ k: "readyForSurgery", label: "Ready for Surgery" });

    if (filters.dateFrom)
      chips.push({ k: "dateFrom", label: `From: ${formatDate(filters.dateFrom)}` });
    if (filters.dateTo)
      chips.push({ k: "dateTo", label: `To: ${formatDate(filters.dateTo)}` });
    return chips;
  }, [filters]);

  const removeChip = (k) => setFilters((f) => ({ ...f, [k]: "" }));

  /* ------------ Render ------------ */
  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
      </div>
    );
  if (error)
    return (
      <div className="flex h-screen items-center justify-center text-red-600">
        {error}
      </div>
    );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Patients</h1>
              <p className="text-sm text-gray-500">
                Manage and track patient records
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDrawerOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-white shadow-sm hover:bg-gray-50 text-gray-700 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
                {activeFilterChips.length > 0 && (
                  <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                    {activeFilterChips.length}
                  </span>
                )}
              </button>
              <Link
                href="add-patient"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Patient
              </Link>
            </div>
          </div>

          {/* Active filter chips */}
          {activeFilterChips.length > 0 && (
            <div className="px-6 pb-3 flex flex-wrap gap-2">
              {activeFilterChips.map((c) => (
                <span
                  key={c.k}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium border border-indigo-200"
                >
                  {c.label}
                  <button
                    onClick={() => removeChip(c.k)}
                    className="hover:text-indigo-900 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={clearFilters}
                className="text-sm text-gray-600 hover:text-gray-900 underline transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </header>

        {/* Search bar */}
        <div className="px-6 pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search patients by name, phone, or email…"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-colors"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
        </div>

        {/* Table */}
        <section className="p-6">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-700 text-xs uppercase">
                  <tr>
                    <Th label="Patient" />
                    <Th label="Contact" />
                    <Th label="Branch" />
                    <Th
                      label="Visit Date"
                      sortKey="personal.visitDate"
                      sort={sort}
                      onSort={toggleSort}
                    />
                    <Th label="Status" />
                    <Th label="Package" />
                    <Th label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-12 text-center text-gray-500"
                      >
                        <div className="flex flex-col items-center justify-center">
                          <Search className="w-12 h-12 text-gray-300 mb-4" />
                          <p className="text-lg font-medium text-gray-900 mb-2">No patients found</p>
                          <p className="text-gray-500">Try adjusting your search or filters</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((p) => (
                      <tr key={p._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {p.personal?.name}
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {p.personal?.phone}
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {p.personal?.branch}
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
                            {p?.ops?.status?.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {p.personal?.packageQuoted}
                        </td>

                        {/* Actions column */}
                        <td className="px-6 py-4">
                          <div className="flex justify-center space-x-2">
                            <button
                              onClick={() =>
                                window.open(
                                  `/admin/patients/${p._id}`,
                                  "_blank",
                                  "noopener,noreferrer"
                                )
                              }
                              className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600 transition-colors"
                              title="View details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <Link
                              href={`/admin/patients/edit/${p._id}`}
                              className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                              title="Edit patient"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer / Pagination */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-6 py-4 border-t bg-gray-50">
              <p className="text-sm text-gray-600">
                Showing <b>{startIdx + 1}</b>–<b>{endIdx}</b> of <b>{total}</b> patients
              </p>
              <div className="flex items-center gap-3">
                <select
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-colors"
                  value={perPage}
                  onChange={(e) => setPerPage(Number(e.target.value))}
                >
                  {[10, 25, 50].map((n) => (
                    <option key={n} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={current <= 1}
                    className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-600 w-16 text-center">
                    {current} / {pages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    disabled={current >= pages}
                    className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Filter Drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b bg-white flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
                  <p className="text-sm text-gray-500 mt-1">
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

              {/* Filter Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-6">
                  {/* Basic Filters */}
                  <Section title="Basic Filters" icon={<Filter className="w-4 h-4" />}>
                    <Field label="Status">
                      <Select
                        value={filters.status}
                        onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
                        options={[
                          { label: "All Status", value: "" },
                          ...STATUS_OPTIONS.map((s) => ({ label: s.replace("_", " "), value: s })),
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

                  {/* Staff & Team */}
                  <Section title="Staff & Team" icon={<Users className="w-4 h-4" />}>
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
                        value={filters.agent}
                        onChange={(v) =>
                          setFilters((f) => ({ ...f, agent: v }))
                        }
                        options={[
                          { label: "All References", value: "" },
                          ...agentOptions.map((a) => ({
                            label: a,
                            value: a,
                          })),
                        ]}
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Doctor">
                        <Select
                          value={filters.doctor}
                          onChange={(v) =>
                            setFilters((f) => ({ ...f, doctor: v }))
                          }
                          options={[
                            { label: "All Doctors", value: "" },
                            ...doctorOptions.map((t) => ({ label: t, value: t })),
                          ]}
                        />
                      </Field>
                      <Field label="Senior Tech">
                        <Select
                          value={filters.seniorTech}
                          onChange={(v) =>
                            setFilters((f) => ({ ...f, seniorTech: v }))
                          }
                          options={[
                            { label: "All Techs", value: "" },
                            ...seniorTechOptions.map((t) => ({
                              label: t,
                              value: t,
                            })),
                          ]}
                        />
                      </Field>
                    </div>

                    <Field label="Implanter">
                      <Select
                        value={filters.implanter}
                        onChange={(v) =>
                          setFilters((f) => ({ ...f, implanter: v }))
                        }
                        options={[
                          { label: "All Implanters", value: "" },
                          ...implanterOptions.map((t) => ({
                            label: t,
                            value: t,
                          })),
                        ]}
                      />
                    </Field>
                  </Section>

                  {/* Surgery Details */}
                  <Section title="Surgery Details" icon={<Scissors className="w-4 h-4" />}>
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

                    <Field label="Surgery Date">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          type="date"
                          value={filters.surgeryDate}
                          onChange={(v) =>
                            setFilters((f) => ({ ...f, surgeryDate: v }))
                          }
                          className="pl-10"
                        />
                      </div>
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="">
                        <label className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={filters.visited}
                            onChange={(e) =>
                              setFilters((f) => ({ ...f, visited: e.target.checked }))
                            }
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-medium text-gray-700">Visited Patients</span>
                        </label>
                      </Field>
                      <Field label="">
                        <label className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={filters.readyForSurgery}
                            onChange={(e) =>
                              setFilters((f) => ({ ...f, readyForSurgery: e.target.checked }))
                            }
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-medium text-gray-700">Ready for Surgery</span>
                        </label>
                      </Field>
                    </div>
                  </Section>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between gap-3">
                <button
                  onClick={clearFilters}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  Reset All
                </button>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium"
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

/* -------------------- Small UI atoms -------------------- */
function Th({ label, sortKey, sort, onSort }) {
  const isSortable = !!sortKey;
  const active = isSortable && sort?.key === sortKey;
  return (
    <th
      className={`px-6 py-3 text-left font-medium ${
        isSortable ? "cursor-pointer select-none hover:bg-gray-100" : ""
      }`}
      onClick={isSortable ? () => onSort(sortKey) : undefined}
    >
      <div className="inline-flex items-center gap-1">
        {label}
        {active && (
          <span className="text-[10px] text-gray-500">
            {sort.dir === "asc" ? "▲" : "▼"}
          </span>
        )}
      </div>
    </th>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold text-gray-800">{title}</span>
      </div>
      <div className="p-4 grid grid-cols-1 gap-4">{children}</div>
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
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-colors ${className}`}
    />
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-colors bg-white"
    >
      {options.map((o) => (
        <option key={`${o.label}-${o.value}`} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// Add missing icon components
const Plus = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const Eye = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.522 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7s-8.268-2.943-9.542-7z" />
  </svg>
);

const Edit = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.536-6.536a2 2 0 112.828 2.828L11.828 15.828H9v-2.828z" />
  </svg>
);

const Users = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
  </svg>
);

const Scissors = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
  </svg>
);