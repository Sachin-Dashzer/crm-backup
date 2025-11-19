"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import SalesSidebar from "@/components/SalesSidebar";
import { 
  Filter, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Search, 
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  FileText,
  Download,
  Eye,
  IndianRupee
} from "lucide-react";

/* -------------------- Constants -------------------- */
const STATUS_OPTIONS = [
  "NEW", "NOT_VISITED", "CONSULTED", "SURGERY_BOOKED", "CLOSED",
];
const STATUS_COLORS = {
  NEW: "bg-blue-100 text-blue-800",
  NOT_VISITED: "bg-amber-100 text-amber-800",
  CONSULTED: "bg-purple-100 text-purple-800",
  SURGERY_BOOKED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
};

const PAYMENT_STATUS_COLORS = {
  PAID: "bg-green-100 text-green-800",
  PARTIAL: "bg-yellow-100 text-yellow-800",
  UNPAID: "bg-red-100 text-red-800",
};

const LOCATION_OPTIONS = ["Delhi", "Mumbai", "Hyderabad"];

const TECHNIQUE_OPTIONS = ["FUE", "INDIAN DHI", "DHI", "HYBRID", "PRP", "GFC", "Other"];

/* -------------------- Helpers -------------------- */
const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "N/A";

const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const getInitialFiltersFromURL = (sp) => ({
  search: "",
  status: sp.get("status") || "",
  location: sp.get("branch") === "All" ? "" : sp.get("branch") || "",
  counsellor: sp.get("counsellor") || "",
  dateFrom: sp.get("dateFrom") || "",
  dateTo: sp.get("dateTo") || "",
  reference: "",
  doctor: "",
  technique: "",
  surgeryDateFrom: "",
  surgeryDateTo: "",
  paymentStatus: sp.get("paymentStatus") || "",
  readyForSurgery: sp.get("readyForSurgery") === "true",
  minPackage: "",
  maxPackage: "",
});

// Content component that uses useSearchParams
function SalesPatientDashboardContent() {
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
        const res = await fetch("/api/sales/get-patients");
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

  const referenceOptions = useMemo(
    () =>
      [...new Set(patients.map((p) => p?.personal?.reference?.name))].filter(Boolean),
    [patients]
  );

  /* ------------ Summary Statistics ------------ */
  const stats = useMemo(() => {
    const totalPatients = patients.length;
    const totalRevenue = patients.reduce(
      (sum, p) => sum + (p.payments?.amountReceived || 0),
      0
    );
    const pendingRevenue = patients.reduce(
      (sum, p) => sum + (p.payments?.pendingAmount || 0),
      0
    );
    const readyForSurgery = patients.filter(
      (p) => p.counselling?.readyForSurgery
    ).length;

    return {
      totalPatients,
      totalRevenue,
      pendingRevenue,
      readyForSurgery,
    };
  }, [patients]);

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

    if (filters.reference)
      list = list.filter((p) => p?.personal?.reference?.name === filters.reference);

    if (filters.doctor)
      list = list.filter((p) => p?.surgery?.doctor?.name === filters.doctor);

    if (filters.technique)
      list = list.filter(
        (p) =>
          p?.counselling?.techniqueSuggested === filters.technique ||
          p?.surgery?.technique === filters.technique ||
          p?.personal?.techniqueQuoted === filters.technique
      );

    if (filters.paymentStatus)
      list = list.filter((p) => p?.payments?.paymentStatus === filters.paymentStatus);

    if (filters.readyForSurgery) {
      list = list.filter((p) => p?.counselling?.readyForSurgery === true);
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

    if (filters.surgeryDateFrom) {
      const from = new Date(filters.surgeryDateFrom);
      list = list.filter((p) => {
        const sd = p?.surgery?.surgeryDate;
        return sd && new Date(sd) >= from;
      });
    }

    if (filters.surgeryDateTo) {
      const to = new Date(filters.surgeryDateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((p) => {
        const sd = p?.surgery?.surgeryDate;
        return sd && new Date(sd) <= to;
      });
    }

    if (filters.minPackage) {
      const min = parseFloat(filters.minPackage);
      list = list.filter((p) => (p?.personal?.packageQuoted || 0) >= min);
    }

    if (filters.maxPackage) {
      const max = parseFloat(filters.maxPackage);
      list = list.filter((p) => (p?.personal?.packageQuoted || 0) <= max);
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
    if (filters.reference)
      chips.push({ k: "reference", label: `Reference: ${filters.reference}` });
    if (filters.technique)
      chips.push({ k: "technique", label: `Technique: ${filters.technique}` });
    if (filters.doctor)
      chips.push({ k: "doctor", label: `Doctor: ${filters.doctor}` });
    if (filters.paymentStatus)
      chips.push({
        k: "paymentStatus",
        label: `Payment: ${filters.paymentStatus}`,
      });
    if (filters.readyForSurgery)
      chips.push({ k: "readyForSurgery", label: "Ready for Surgery" });
    if (filters.dateFrom)
      chips.push({
        k: "dateFrom",
        label: `Visit From: ${formatDate(filters.dateFrom)}`,
      });
    if (filters.dateTo)
      chips.push({ k: "dateTo", label: `Visit To: ${formatDate(filters.dateTo)}` });
    if (filters.surgeryDateFrom)
      chips.push({
        k: "surgeryDateFrom",
        label: `Surgery From: ${formatDate(filters.surgeryDateFrom)}`,
      });
    if (filters.surgeryDateTo)
      chips.push({
        k: "surgeryDateTo",
        label: `Surgery To: ${formatDate(filters.surgeryDateTo)}`,
      });
    if (filters.minPackage)
      chips.push({
        k: "minPackage",
        label: `Min Package: ${formatCurrency(filters.minPackage)}`,
      });
    if (filters.maxPackage)
      chips.push({
        k: "maxPackage",
        label: `Max Package: ${formatCurrency(filters.maxPackage)}`,
      });
    return chips;
  }, [filters]);

  const removeChip = (k) =>
    setFilters((f) => ({ ...f, [k]: k === "readyForSurgery" ? false : "" }));

  /* ------------ Export to CSV ------------ */
  const exportToCSV = () => {
    const headers = [
      "Name",
      "Phone",
      "Email",
      "Branch",
      "Visit Date",
      "Status",
      "Package Quoted",
      "Amount Received",
      "Pending Amount",
      "Payment Status",
      "Counsellor",
      "Technique",
      "Ready for Surgery",
      "Surgery Date",
      "Doctor",
    ];

    const csvData = filtered.map((p) => [
      p.personal?.name || "",
      p.personal?.phone || "",
      p.personal?.email || "",
      p.personal?.branch || "",
      formatDate(p.personal?.visitDate),
      p.ops?.status || "",
      p.personal?.packageQuoted || 0,
      p.payments?.amountReceived || 0,
      p.counselling?.finlpackage || 0,
      p.payments?.paymentStatus || "",
      p.counselling?.counsellor?.name || "",
      p.counselling?.techniqueSuggested || p.surgery?.technique || "",
      p.counselling?.readyForSurgery ? "Yes" : "No",
      formatDate(p.surgery?.surgeryDate),
      p.surgery?.doctor?.name || "",
    ]);

    const csv = [headers, ...csvData].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-patients-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  /* ------------ Render ------------ */
  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto" />
          <p className="mt-4 text-gray-600 font-medium">Loading patients...</p>
        </div>
      </div>
    );
  if (error)
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Data</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SalesSidebar />
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Sales Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">
                Track patient payments and conversions
              </p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => setDrawerOpen(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border bg-white shadow-sm hover:bg-gray-50 text-gray-700 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                {activeFilterChips.length > 0 && (
                  <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                    {activeFilterChips.length}
                  </span>
                )}
              </button>
              <button
                onClick={exportToCSV}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>

          {/* Active filter chips */}
          {activeFilterChips.length > 0 && (
            <div className="px-4 sm:px-6 pb-3 flex flex-wrap gap-2">
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

        {/* Stats Cards */}
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Total Patients"
              value={stats.totalPatients}
              icon={<Users className="w-6 h-6" />}
              color="blue"
            />
            <StatCard
              title="Revenue Collected"
              value={formatCurrency(stats.totalRevenue)}
              icon={<IndianRupee className="w-6 h-6" />}
              color="green"
            />
            <StatCard
              title="Pending Revenue"
              value={formatCurrency(stats.pendingRevenue)}
              icon={<TrendingUp className="w-6 h-6" />}
              color="orange"
            />
            <StatCard
              title="Ready for Surgery"
              value={stats.readyForSurgery}
              icon={<FileText className="w-6 h-6" />}
              color="purple"
            />
          </div>

          {/* Search bar */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, phone, or email..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-colors"
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
              />
            </div>
          </div>

          {/* Table */}
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
                    <Th
                      label="Package"
                      sortKey="personal.packageQuoted"
                      sort={sort}
                      onSort={toggleSort}
                    />
                     <Th
                      label="Final"
                      sortKey="counselling?.finlpackage"
                      sort={sort}
                      onSort={toggleSort}
                    />
                    <Th
                      label="Received"
                      sortKey="payments.amountReceived"
                      sort={sort}
                      onSort={toggleSort}
                    />
                   
                    <Th label="Payment Status" />
                    {/* <Th label="Actions" /> */}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-gray-500">
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
                        <td className="px-6 py-4 text-gray-900 font-medium">
                          {formatCurrency(p.personal?.packageQuoted)}
                        </td>
                        <td className="px-6 py-4 text-orange-600 font-medium">
                          {formatCurrency(p.counselling?.finlpackage)}
                        </td>
                        <td className="px-6 py-4 text-green-600 font-medium">
                          {formatCurrency(p.payments?.amountReceived)}
                        </td>
                        
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              PAYMENT_STATUS_COLORS[
                                p?.payments?.paymentStatus
                              ] || "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {p?.payments?.paymentStatus}
                          </span>
                        </td>
                        {/* <td className="px-6 py-4">
                          <button
                            onClick={() =>
                              window.open(
                                `/sales/patients/${p._id}`,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                            className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600 transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td> */}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer / Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t bg-gray-50">
              <p className="text-sm text-gray-600">
                Showing <b>{startIdx + 1}</b>–<b>{endIdx}</b> of <b>{total}</b>{" "}
                patients
              </p>
              <div className="flex items-center gap-3">
                <select
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-colors"
                  value={perPage}
                  onChange={(e) => setPerPage(Number(e.target.value))}
                >
                  {[10, 25, 50, 100].map((n) => (
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
        </div>

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
                  <h3 className="text-lg font-semibold text-gray-900">
                    Advanced Filters
                  </h3>
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
                  {/* Patient Info */}
                  <Section
                    title="Patient Information"
                    icon={<Users className="w-4 h-4" />}
                  >
                    <Field label="Status">
                      <Select
                        value={filters.status}
                        onChange={(v) =>
                          setFilters((f) => ({ ...f, status: v }))
                        }
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
                      <Field label="Visit From">
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
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
                      <Field label="Visit To">
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
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

                  {/* Counselling & Staff */}
                  <Section
                    title="Counselling & Staff"
                    icon={<FileText className="w-4 h-4" />}
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
                    <Field label="Technique">
                      <Select
                        value={filters.technique}
                        onChange={(v) =>
                          setFilters((f) => ({ ...f, technique: v }))
                        }
                        options={[
                          { label: "All Techniques", value: "" },
                          ...TECHNIQUE_OPTIONS.map((t) => ({
                            label: t,
                            value: t,
                          })),
                        ]}
                      />
                    </Field>
                    <Field label="">
                      <label className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={filters.readyForSurgery}
                          onChange={(e) =>
                            setFilters((f) => ({
                              ...f,
                              readyForSurgery: e.target.checked,
                            }))
                          }
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Ready for Surgery
                        </span>
                      </label>
                    </Field>
                  </Section>

                  {/* Surgery Details */}
                  {/* <Section
                    title="Surgery Details"
                    icon={<Calendar className="w-4 h-4" />}
                  >
                    <Field label="Doctor">
                      <Select
                        value={filters.doctor}
                        onChange={(v) =>
                          setFilters((f) => ({ ...f, doctor: v }))
                        }
                        options={[
                          { label: "All Doctors", value: "" },
                          ...doctorOptions.map((t) => ({
                            label: t,
                            value: t,
                          })),
                        ]}
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Surgery From">
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                          <Input
                            type="date"
                            value={filters.surgeryDateFrom}
                            onChange={(v) =>
                              setFilters((f) => ({
                                ...f,
                                surgeryDateFrom: v,
                              }))
                            }
                            className="pl-10"
                          />
                        </div>
                      </Field>
                      <Field label="Surgery To">
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                          <Input
                            type="date"
                            value={filters.surgeryDateTo}
                            onChange={(v) =>
                              setFilters((f) => ({ ...f, surgeryDateTo: v }))
                            }
                            className="pl-10"
                          />
                        </div>
                      </Field>
                    </div>
                  </Section> */}

                  {/* Payment Filters */}
                  <Section
                    title="Payment Information"
                    icon={<DollarSign className="w-4 h-4" />}
                  >
                    <Field label="Payment Status">
                      <Select
                        value={filters.paymentStatus}
                        onChange={(v) =>
                          setFilters((f) => ({ ...f, paymentStatus: v }))
                        }
                        options={[
                          { label: "All Payments", value: "" },
                          { label: "Paid", value: "PAID" },
                          { label: "Partial", value: "PARTIAL" },
                          { label: "Unpaid", value: "UNPAID" },
                        ]}
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Min Package">
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                          <Input
                            type="number"
                            value={filters.minPackage}
                            onChange={(v) =>
                              setFilters((f) => ({ ...f, minPackage: v }))
                            }
                            placeholder="0"
                            className="pl-10"
                          />
                        </div>
                      </Field>
                      <Field label="Max Package">
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                          <Input
                            type="number"
                            value={filters.maxPackage}
                            onChange={(v) =>
                              setFilters((f) => ({ ...f, maxPackage: v }))
                            }
                            placeholder="1000000"
                            className="pl-10"
                          />
                        </div>
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

/* ===================================================
   Main Sales Patient Dashboard Component with Suspense
=================================================== */
export default function SalesPatientDashboard() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen bg-gray-50">
        <SalesSidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-10 w-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
        </main>
      </div>
    }>
      <SalesPatientDashboardContent />
    </Suspense>
  );
}

/* -------------------- UI Components -------------------- */
function StatCard({ title, value, icon, color }) {
  const colors = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    orange: "bg-orange-100 text-orange-600",
    purple: "bg-purple-100 text-purple-600",
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>{icon}</div>
      </div>
    </div>
  );
}

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
      {label && (
        <span className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </span>
      )}
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