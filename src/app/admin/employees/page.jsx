"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebars/Sidebar";
import Link from "next/link";
import {
  Filter,
  X,
  Plus,
  ChevronRight,
  ChevronLeft,
  Search,
  TrendingUp,
  Edit,
  Users,
  IndianRupee,
  Activity,
} from "lucide-react";

/* -------------------- Constants -------------------- */
const CATEGORY_OPTIONS = [
  "Doctor",
  "Agent",
  "Counsellor",
  "Technician",
  "Implanter",
  "Others",
];

const CATEGORY_COLORS = {
  Doctor: "bg-purple-100 text-purple-800 border-purple-200",
  Agent: "bg-blue-100 text-blue-800 border-blue-200",
  Counsellor: "bg-green-100 text-green-800 border-green-200",
  Technician: "bg-orange-100 text-orange-800 border-orange-200",
  Implanter: "bg-indigo-100 text-indigo-800 border-indigo-200",
  Others: "bg-gray-100 text-gray-800 border-gray-200",
};

/* -------------------- Helpers -------------------- */
const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);

const formatNumber = (num) => new Intl.NumberFormat("en-IN").format(num || 0);

/* ===================================================
   Staff Performance Dashboard
=================================================== */
export default function StaffDashboard() {
  /* ------------ State ------------ */
  const [data, setData] = useState({});
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    status: "",
    minPatients: "",
    maxPatients: "",
    minAmount: "",
    maxAmount: "",
    minGrafts: "",
    maxGrafts: "",
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [sort, setSort] = useState({ key: "totalPatient", dir: "desc" });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selectedCategory, setSelectedCategory] = useState("Doctor");

  /* ------------ Data Fetch ------------ */
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/employees/get-patients");
        if (!res.ok) throw new Error("Failed to fetch staff data");
        const responseData = await res.json();
        
        // Transform the API data to match frontend expectations
        const transformedData = {};
        Object.keys(responseData).forEach(category => {
          transformedData[category] = responseData[category].map(employee => ({
            ...employee,
            // Convert isactive boolean to status string
            status: employee.isactive ? "active" : "inactive"
          }));
        });
        
        setData(transformedData || {});
      } catch (e) {
        setError(e.message || "Error");
        // Use mock data for demonstration (updated with status field)
        setData({
          Doctor: [
            {
              name: "Alok Mishra",
              totalPatient: 9,
              graftsImplanted: 18430,
              amountReceived: 271000,
              status: "active",
              _id: "1"
            },
            {
              name: "Nisha Agarwal",
              totalPatient: 8,
              graftsImplanted: 10200,
              amountReceived: 278000,
              status: "inactive",
              _id: "2"
            },
            {
              name: "Swati Banerjee",
              totalPatient: 9,
              graftsImplanted: 20700,
              amountReceived: 244000,
              status: "active",
              _id: "3"
            },
          ],
          Agent: [
            {
              name: "Amit Patel",
              totalPatient: 1,
              readyForSurgery: 1,
              amountReceived: 35000,
              status: "active",
              _id: "4"
            },
            {
              name: "Anjali Reddy",
              totalPatient: 1,
              readyForSurgery: 1,
              amountReceived: 18000,
              status: "active",
              _id: "5"
            },
            {
              name: "Arun Joshi",
              totalPatient: 3,
              readyForSurgery: 1,
              amountReceived: 90000,
              status: "inactive",
              _id: "6"
            },
          ],
          Counsellor: [
            {
              name: "Anita Rao",
              totalPatient: 7,
              readyForSurgery: 7,
              amountReceived: 257000,
              status: "active",
              _id: "7"
            },
            {
              name: "Deepak Sharma",
              totalPatient: 6,
              readyForSurgery: 5,
              amountReceived: 173000,
              status: "active",
              _id: "8"
            },
          ],
          Technician: [
            {
              name: "Geeta Krishnan",
              totalPatient: 12,
              graftsImplanted: 24080,
              amountReceived: 368000,
              status: "active",
              _id: "9"
            },
            {
              name: "Harish Chandra",
              totalPatient: 7,
              graftsImplanted: 16100,
              amountReceived: 165000,
              status: "inactive",
              _id: "10"
            },
          ],
          Implanter: [
            {
              name: "Anil Khanna",
              totalPatient: 11,
              graftsImplanted: 25650,
              amountReceived: 393000,
              status: "active",
              _id: "11"
            },
            {
              name: "Madhuri Sen",
              totalPatient: 10,
              graftsImplanted: 17180,
              amountReceived: 272000,
              status: "active",
              _id: "12"
            },
          ],
          Others: [
            {
              name: "Ananya Das",
              totalPatient: 2,
              graftsImplanted: 6500,
              amountReceived: 58000,
              status: "active",
              _id: "13"
            },
            {
              name: "Gaurav Tiwari",
              totalPatient: 4,
              graftsImplanted: 10600,
              amountReceived: 103000,
              status: "inactive",
              _id: "14"
            },
          ],
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  /* ------------ Get current category data ------------ */
  const categoryData = useMemo(() => {
    const category = filters.category || selectedCategory;
    return data[category] || [];
  }, [data, filters.category, selectedCategory]);

  /* ------------ Filtering + Sorting ------------ */
  const filtered = useMemo(() => {
    let list = [...categoryData];

    // Search filter
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter((item) => item.name.toLowerCase().includes(q));
    }

    // Status filter - fixed to work with status string
    if (filters.status) {
      list = list.filter((item) => item.status === filters.status);
    }

    // Patient count filters
    if (filters.minPatients) {
      list = list.filter(
        (item) => item.totalPatient >= Number(filters.minPatients)
      );
    }
    if (filters.maxPatients) {
      list = list.filter(
        (item) => item.totalPatient <= Number(filters.maxPatients)
      );
    }

    // Amount filters
    if (filters.minAmount) {
      list = list.filter(
        (item) => item.amountReceived >= Number(filters.minAmount)
      );
    }
    if (filters.maxAmount) {
      list = list.filter(
        (item) => item.amountReceived <= Number(filters.maxAmount)
      );
    }

    // Grafts filters (only for applicable categories)
    if (filters.minGrafts) {
      list = list.filter(
        (item) => (item.graftsImplanted || 0) >= Number(filters.minGrafts)
      );
    }
    if (filters.maxGrafts) {
      list = list.filter(
        (item) => (item.graftsImplanted || 0) <= Number(filters.maxGrafts)
      );
    }

    // Sort
    list.sort((a, b) => {
      const av = a[sort.key] || 0;
      const bv = b[sort.key] || 0;
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [categoryData, filters, sort]);

  /* ------------ Calculate totals ------------ */
  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, item) => ({
        totalPatient: acc.totalPatient + (item.totalPatient || 0),
        graftsImplanted: acc.graftsImplanted + (item.graftsImplanted || 0),
        amountReceived: acc.amountReceived + (item.amountReceived || 0),
        readyForSurgery: acc.readyForSurgery + (item.readyForSurgery || 0),
      }),
      {
        totalPatient: 0,
        graftsImplanted: 0,
        amountReceived: 0,
        readyForSurgery: 0,
      }
    );
  }, [filtered]);

  /* ------------ Pagination ------------ */
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(page, pages);
  const startIdx = (current - 1) * perPage;
  const endIdx = Math.min(startIdx + perPage, total);
  const rows = filtered.slice(startIdx, endIdx);

  useEffect(() => setPage(1), [filters, perPage, selectedCategory]);

  /* ------------ UI Actions ------------ */
  const clearFilters = () =>
    setFilters({
      search: "",
      category: "",
      status: "",
      minPatients: "",
      maxPatients: "",
      minAmount: "",
      maxAmount: "",
      minGrafts: "",
      maxGrafts: "",
    });

  const toggleSort = (key) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" }
    );

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (filters.category)
      chips.push({ k: "category", label: `Category: ${filters.category}` });
    if (filters.status)
      chips.push({ k: "status", label: `Status: ${filters.status === "active" ? "Active" : "Inactive"}` });
    if (filters.minPatients)
      chips.push({
        k: "minPatients",
        label: `Min Patients: ${filters.minPatients}`,
      });
    if (filters.maxPatients)
      chips.push({
        k: "maxPatients",
        label: `Max Patients: ${filters.maxPatients}`,
      });
    if (filters.minAmount)
      chips.push({
        k: "minAmount",
        label: `Min Amount: ${formatCurrency(filters.minAmount)}`,
      });
    if (filters.maxAmount)
      chips.push({
        k: "maxAmount",
        label: `Max Amount: ${formatCurrency(filters.maxAmount)}`,
      });
    if (filters.minGrafts)
      chips.push({ k: "minGrafts", label: `Min Grafts: ${filters.minGrafts}` });
    if (filters.maxGrafts)
      chips.push({ k: "maxGrafts", label: `Max Grafts: ${filters.maxGrafts}` });
    return chips;
  }, [filters]);

  const removeChip = (k) => setFilters((f) => ({ ...f, [k]: "" }));

  /* ------------ Check if category has grafts ------------ */
  const hasGrafts = ["Doctor", "Technician", "Implanter", "Others"].includes(
    filters.category || selectedCategory
  );

  const hasReadyForSurgery = ["Agent", "Counsellor"].includes(
    filters.category || selectedCategory
  );

  /* ------------ Render ------------ */
  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
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
              <h1 className="text-2xl font-semibold text-gray-900">
                Staff Performance
              </h1>
              <p className="text-sm text-gray-500">
                Track performance metrics across all staff categories
              </p>
            </div>
            <div>
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
                href="/admin/employees/add-employee"
                className="inline-flex items-center gap-2 mx-4 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Employee
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

        {/* Category Tabs */}
        <div className="px-6 pt-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setFilters((f) => ({ ...f, category: cat }));
                }}
                className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                  (filters.category || selectedCategory) === cat
                    ? CATEGORY_COLORS[cat] + " border"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {cat}
                <span className="ml-2 text-xs opacity-75">
                  ({data[cat]?.length || 0})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="px-6 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="Total Staff"
              value={filtered.length}
              icon={<Users className="w-5 h-5" />}
              color="blue"
            />
            <SummaryCard
              title="Total Patients"
              value={totals.totalPatient}
              icon={<Activity className="w-5 h-5" />}
              color="green"
            />
            {hasGrafts && (
              <SummaryCard
                title="Total Grafts"
                value={formatNumber(totals.graftsImplanted)}
                icon={<TrendingUp className="w-5 h-5" />}
                color="purple"
              />
            )}
            {hasReadyForSurgery && (
              <SummaryCard
                title="Ready for Surgery"
                value={totals.readyForSurgery}
                icon={<Activity className="w-5 h-5" />}
                color="orange"
              />
            )}
            <SummaryCard
              title="Total Revenue"
              value={formatCurrency(totals.amountReceived)}
              icon={<IndianRupee className="w-5 h-5" />}
              color="indigo"
            />
          </div>
        </div>

        {/* Search bar */}
        <div className="px-6 pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search staff by name…"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-colors"
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
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
                    <Th label="Name" />
                    <Th label="Status" />
                    <Th
                      label="Total Patients"
                      sortKey="totalPatient"
                      sort={sort}
                      onSort={toggleSort}
                    />
                    {hasGrafts && (
                      <Th
                        label="Grafts Implanted"
                        sortKey="graftsImplanted"
                        sort={sort}
                        onSort={toggleSort}
                      />
                    )}
                    {hasReadyForSurgery && (
                      <Th
                        label="Ready for Surgery"
                        sortKey="readyForSurgery"
                        sort={sort}
                        onSort={toggleSort}
                      />
                    )}
                    <Th
                      label="Amount Received"
                      sortKey="amountReceived"
                      sort={sort}
                      onSort={toggleSort}
                    />
                    <Th label="Avg per Patient" />
                    <Th label="More" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td 
                        colSpan={hasGrafts ? 8 : hasReadyForSurgery ? 8 : 7}
                        className="py-12 text-center text-gray-500"
                      >
                        <div className="flex flex-col items-center justify-center">
                          <Search className="w-12 h-12 text-gray-300 mb-4" />
                          <p className="text-lg font-medium text-gray-900 mb-2">
                            No results found
                          </p>
                          <p className="text-gray-500">
                            Try adjusting your search or filters
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((item, idx) => {
                      const avgPerPatient = item.totalPatient
                        ? item.amountReceived / item.totalPatient
                        : 0;
                      return (
                        <tr
                          key={idx}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {item.name}
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={item.status} />
                          </td>
                          <td className="px-6 py-4 text-gray-700">
                            {item.totalPatient}
                          </td>
                          {hasGrafts && (
                            <td className="px-6 py-4 text-gray-700">
                              {formatNumber(item.graftsImplanted || 0)}
                            </td>
                          )}
                          {hasReadyForSurgery && (
                            <td className="px-6 py-4 text-gray-700">
                              {item.readyForSurgery || 0}
                            </td>
                          )}
                          <td className="px-6 py-4 text-gray-900 font-medium">
                            {formatCurrency(item.amountReceived)}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {formatCurrency(avgPerPatient)}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            <Link
                              href={`/admin/employees/update/${item._id}`}
                              className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                              title="Edit employee"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {rows.length > 0 && (
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                    <tr>
                      <td className="px-6 py-4 text-gray-900">Total</td>
                      <td className="px-6 py-4 text-gray-900"></td>
                      <td className="px-6 py-4 text-gray-900">
                        {totals.totalPatient}
                      </td>
                      {hasGrafts && (
                        <td className="px-6 py-4 text-gray-900">
                          {formatNumber(totals.graftsImplanted)}
                        </td>
                      )}
                      {hasReadyForSurgery && (
                        <td className="px-6 py-4 text-gray-900">
                          {totals.readyForSurgery}
                        </td>
                      )}
                      <td className="px-6 py-4 text-gray-900">
                        {formatCurrency(totals.amountReceived)}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {totals.totalPatient > 0
                          ? formatCurrency(
                              totals.amountReceived / totals.totalPatient
                            )
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-gray-600"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Footer / Pagination */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-6 py-4 border-t bg-gray-50">
              <p className="text-sm text-gray-600">
                Showing <b>{startIdx + 1}</b>–<b>{endIdx}</b> of <b>{total}</b>{" "}
                staff
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
                  <h3 className="text-lg font-semibold text-gray-900">
                    Filters
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Refine your staff performance view
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
                  {/* Category Filter */}
                  <Section
                    title="Category"
                    icon={<Filter className="w-4 h-4" />}
                  >
                    <Field label="Staff Category">
                      <Select
                        value={filters.category}
                        onChange={(v) => {
                          setFilters((f) => ({ ...f, category: v }));
                          setSelectedCategory(v || "Doctor");
                        }}
                        options={[
                          { label: "All Categories", value: "" },
                          ...CATEGORY_OPTIONS.map((c) => ({
                            label: c,
                            value: c,
                          })),
                        ]}
                      />
                    </Field>
                  </Section>

                  {/* Status Filter */}
                  <Section
                    title="Status"
                    icon={<Activity className="w-4 h-4" />}
                  >
                    <Field label="Employee Status">
                      <Select
                        value={filters.status}
                        onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
                        options={[
                          { label: "All Status", value: "" },
                          { label: "Active", value: "active" },
                          { label: "Inactive", value: "inactive" },
                        ]}
                      />
                    </Field>
                  </Section>

                  {/* Patient Count Filter */}
                  <Section
                    title="Patient Count"
                    icon={<Users className="w-4 h-4" />}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Min Patients">
                        <Input
                          type="number"
                          value={filters.minPatients}
                          onChange={(v) =>
                            setFilters((f) => ({ ...f, minPatients: v }))
                          }
                          placeholder="0"
                        />
                      </Field>
                      <Field label="Max Patients">
                        <Input
                          type="number"
                          value={filters.maxPatients}
                          onChange={(v) =>
                            setFilters((f) => ({ ...f, maxPatients: v }))
                          }
                          placeholder="100"
                        />
                      </Field>
                    </div>
                  </Section>

                  {/* Amount Filter */}
                  <Section
                    title="Amount Received"
                    icon={<IndianRupee className="w-4 h-4" />}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Min Amount (₹)">
                        <Input
                          type="number"
                          value={filters.minAmount}
                          onChange={(v) =>
                            setFilters((f) => ({ ...f, minAmount: v }))
                          }
                          placeholder="0"
                        />
                      </Field>
                      <Field label="Max Amount (₹)">
                        <Input
                          type="number"
                          value={filters.maxAmount}
                          onChange={(v) =>
                            setFilters((f) => ({ ...f, maxAmount: v }))
                          }
                          placeholder="500000"
                        />
                      </Field>
                    </div>
                  </Section>

                  {/* Grafts Filter (conditional) */}
                  {hasGrafts && (
                    <Section
                      title="Grafts Implanted"
                      icon={<TrendingUp className="w-4 h-4" />}
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Min Grafts">
                          <Input
                            type="number"
                            value={filters.minGrafts}
                            onChange={(v) =>
                              setFilters((f) => ({ ...f, minGrafts: v }))
                            }
                            placeholder="0"
                          />
                        </Field>
                        <Field label="Max Grafts">
                          <Input
                            type="number"
                            value={filters.maxGrafts}
                            onChange={(v) =>
                              setFilters((f) => ({ ...f, maxGrafts: v }))
                            }
                            placeholder="30000"
                          />
                        </Field>
                      </div>
                    </Section>
                  )}
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

function SummaryCard({ title, value, icon, color }) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
    indigo: "bg-indigo-50 text-indigo-600",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>{icon}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const statusConfig = {
    active: {
      label: "Active",
      className: "bg-green-100 text-green-800 border-green-200"
    },
    inactive: {
      label: "Inactive", 
      className: "bg-red-100 text-red-800 border-red-200"
    }
  };

  const config = statusConfig[status] || {
    label: "Unknown",
    className: "bg-gray-100 text-gray-800 border-gray-200"
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  );
}