"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  MapPin,
  Package,
  AlertTriangle,
  Clock,
  IndianRupee,
  Search,
  X,
  Plus,
  ShoppingCart,
  Eye,
  Pencil,
  RefreshCw,
  ChevronRight,
  Boxes,
} from "lucide-react";
import Sidebar from "@/components/Sidebars/Sidebar";

const BRANCHES = ["All", "Delhi", "Mumbai", "Hyderabad"];

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export default function StocksDashboard() {
  const router = useRouter();
  const { data: session } = useSession();

  const [stocks, setStocks] = useState([]);
  const [statistics, setStatistics] = useState({
    totalItems: 0,
    totalStockValue: 0,
    lowStockCount: 0,
    expiredCount: 0,
  });
  const [locationStats, setLocationStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [filterExpired, setFilterExpired] = useState(false);
  const [threshold, setThreshold] = useState(10);
  const [selectedLocation, setSelectedLocation] = useState("All");
  const [branchRestricted, setBranchRestricted] = useState(false);

  const userBranch = session?.user?.branch;

  useEffect(() => {
    fetchStocks();
  }, []);

  const fetchStocks = async (overrides = {}) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      const loc = overrides.location ?? selectedLocation;
      const low = overrides.lowStock ?? filterLowStock;
      const exp = overrides.expired ?? filterExpired;
      const term = overrides.search ?? searchTerm;
      const thr = overrides.threshold ?? threshold;

      if (term) params.append("search", term);
      if (loc && loc !== "All") params.append("location", loc);
      if (low) {
        params.append("lowStock", "true");
        params.append("threshold", thr.toString());
      }
      if (exp) params.append("expired", "true");

      const url = `/api/stocks/get${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setStocks(data.data);
        setStatistics(data.statistics);
        setLocationStats(data.locationStats || []);
        setBranchRestricted(!!data.branchRestricted);
        if (data.branchRestricted && data.userBranch) {
          setSelectedLocation(data.userBranch);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStocks();
  };

  const handleSearch = () => fetchStocks();

  const handleClear = () => {
    const resetLocation =
      branchRestricted && userBranch ? userBranch : "All";
    setSearchTerm("");
    setFilterLowStock(false);
    setFilterExpired(false);
    setSelectedLocation(resetLocation);
    fetchStocks({
      search: "",
      lowStock: false,
      expired: false,
      location: resetLocation,
    });
  };

  const handleLocationChange = (loc) => {
    if (branchRestricted) return;
    setSelectedLocation(loc);
    fetchStocks({ location: loc });
  };

  const isLowStock = (qty) => qty <= threshold;
  const isExpired = (d) => d && new Date(d) <= new Date();
  const hasFilters =
    searchTerm ||
    filterLowStock ||
    filterExpired ||
    selectedLocation !== "All";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8 min-w-0">

        {/* ── Page Header ─────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Stock Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {branchRestricted
                ? `Showing stock for ${userBranch} branch`
                : "Manage inventory across all branches"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw
                className={`w-4 h-4 text-gray-500 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={() => router.push("/stocks/addStock")}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
            >
              <ShoppingCart className="w-4 h-4" />
              Purchase
            </button>
            <button
              onClick={() => router.push("/stocks/create")}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Stock
            </button>
          </div>
        </div>

        {/* ── KPI Cards ─────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          <KpiCard
            label="Total Items"
            value={statistics.totalItems}
            icon={Boxes}
            iconClass="bg-blue-100 text-blue-600"
            onClick={() => handleClear()}
          />
          <KpiCard
            label="Stock Value"
            value={fmt(statistics.totalStockValue)}
            icon={IndianRupee}
            iconClass="bg-emerald-100 text-emerald-600"
            small
          />
          <KpiCard
            label="Low Stock"
            value={statistics.lowStockCount}
            icon={AlertTriangle}
            iconClass="bg-amber-100 text-amber-600"
            accent={statistics.lowStockCount > 0 ? "amber" : null}
            onClick={() => {
              setFilterLowStock(true);
              fetchStocks({ lowStock: true });
            }}
          />
          <KpiCard
            label="Expired"
            value={statistics.expiredCount}
            icon={Clock}
            iconClass="bg-red-100 text-red-600"
            accent={statistics.expiredCount > 0 ? "red" : null}
            onClick={() => {
              setFilterExpired(true);
              fetchStocks({ expired: true });
            }}
          />
        </div>

        {/* ── Branch Breakdown ─────────────────────────── */}
        {locationStats.length > 0 && (
          <div className="mb-7">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-indigo-500" />
                Branch Breakdown
              </h2>
              {!branchRestricted && selectedLocation !== "All" && (
                <button
                  onClick={() => handleLocationChange("All")}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  View all branches
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {locationStats.map((ls) => (
                <BranchCard
                  key={ls.location}
                  data={ls}
                  active={selectedLocation === ls.location}
                  disabled={branchRestricted}
                  onClick={() =>
                    !branchRestricted &&
                    handleLocationChange(
                      selectedLocation === ls.location ? "All" : ls.location
                    )
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Filter Bar ───────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-5">
          <div className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              {/* Search */}
              <div className="flex-1 min-w-48">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Product name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="w-36">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Branch
                  {branchRestricted && (
                    <span className="ml-1 text-indigo-500">(locked)</span>
                  )}
                </label>
                {branchRestricted ? (
                  <div className="w-full px-3 py-2.5 border border-indigo-200 rounded-lg bg-indigo-50 text-sm text-indigo-700 font-medium flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {userBranch}
                  </div>
                ) : (
                  <select
                    value={selectedLocation}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                  >
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Threshold */}
              <div className="w-32">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Low Stock ≤
                </label>
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  min="1"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Toggle chips */}
              <div className="flex items-center gap-2 pb-0.5">
                <button
                  onClick={() => {
                    const next = !filterLowStock;
                    setFilterLowStock(next);
                    fetchStocks({ lowStock: next });
                  }}
                  className={`px-3 py-2.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                    filterLowStock
                      ? "bg-amber-50 border-amber-300 text-amber-700"
                      : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Low Stock
                </button>
                <button
                  onClick={() => {
                    const next = !filterExpired;
                    setFilterExpired(next);
                    fetchStocks({ expired: next });
                  }}
                  className={`px-3 py-2.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                    filterExpired
                      ? "bg-red-50 border-red-300 text-red-700"
                      : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Expired
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pb-0.5 ml-auto">
                {hasFilters && (
                  <button
                    onClick={handleClear}
                    className="px-3 py-2.5 text-sm bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear
                  </button>
                )}
                <button
                  onClick={handleSearch}
                  className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  Search
                </button>
              </div>
            </div>
          </div>

          {/* Active filter pills */}
          {hasFilters && (
            <div className="px-4 pb-3 flex flex-wrap gap-2">
              {selectedLocation !== "All" && (
                <FilterPill
                  color="indigo"
                  icon={<MapPin className="w-3 h-3" />}
                  label={selectedLocation}
                  onRemove={
                    !branchRestricted
                      ? () => handleLocationChange("All")
                      : null
                  }
                />
              )}
              {filterLowStock && (
                <FilterPill
                  color="amber"
                  icon={<AlertTriangle className="w-3 h-3" />}
                  label="Low Stock"
                  onRemove={() => {
                    setFilterLowStock(false);
                    fetchStocks({ lowStock: false });
                  }}
                />
              )}
              {filterExpired && (
                <FilterPill
                  color="red"
                  icon={<Clock className="w-3 h-3" />}
                  label="Expired only"
                  onRemove={() => {
                    setFilterExpired(false);
                    fetchStocks({ expired: false });
                  }}
                />
              )}
              {searchTerm && (
                <FilterPill
                  color="gray"
                  label={`"${searchTerm}"`}
                  onRemove={() => {
                    setSearchTerm("");
                    fetchStocks({ search: "" });
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* ── Stock Table ──────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

          {/* Table header with count */}
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {loading ? (
                "Loading..."
              ) : (
                <>
                  <span className="font-semibold text-gray-900">{stocks.length}</span> items
                </>
              )}
            </span>
            <button
              onClick={() => router.push("/stocks/create")}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add new
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {[
                    "Product",
                    "Branch",
                    "Qty",
                    "MRP",
                    "Purchase",
                    "Sell Price",
                    "Unit",
                    "Expiry",
                    "Status",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="10" className="px-5 py-14 text-center">
                      <div className="w-8 h-8 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                      <p className="mt-3 text-sm text-gray-400">
                        Loading stock items...
                      </p>
                    </td>
                  </tr>
                ) : stocks.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-5 py-14 text-center">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Package className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-sm font-semibold text-gray-700">
                        No stock items found
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {hasFilters
                          ? "Try adjusting your filters"
                          : "Click 'Add Stock' to create the first item"}
                      </p>
                      {!hasFilters && (
                        <button
                          onClick={() => router.push("/stocks/create")}
                          className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          Add Stock
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  stocks.map((stock) => {
                    const expired = isExpired(stock.expiry);
                    const low = isLowStock(stock.totalQuantity);
                    return (
                      <tr
                        key={stock._id}
                        className={`hover:bg-gray-50 transition-colors ${
                          expired ? "bg-red-50/30" : low ? "bg-amber-50/30" : ""
                        }`}
                      >
                        {/* Product */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs shrink-0">
                              {stock.name?.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-gray-900 whitespace-nowrap">
                              {stock.name}
                            </span>
                          </div>
                        </td>

                        {/* Branch */}
                        <td className="px-4 py-3">
                          {stock.location ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                              <MapPin className="w-2.5 h-2.5" />
                              {stock.location}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* Qty */}
                        <td className="px-4 py-3">
                          <span
                            className={`font-semibold tabular-nums ${
                              low ? "text-amber-600" : "text-gray-900"
                            }`}
                          >
                            {stock.totalQuantity}
                          </span>
                        </td>

                        {/* MRP */}
                        <td className="px-4 py-3 text-gray-600 tabular-nums whitespace-nowrap">
                          {fmt(stock.mrp)}
                        </td>

                        {/* Purchase */}
                        <td className="px-4 py-3 text-gray-500 tabular-nums whitespace-nowrap">
                          {stock.purchaseAmt ? fmt(stock.purchaseAmt) : "—"}
                        </td>

                        {/* Sell Price */}
                        <td className="px-4 py-3 text-gray-500 tabular-nums whitespace-nowrap">
                          {stock.soldAmt ? fmt(stock.soldAmt) : "—"}
                        </td>

                        {/* Unit */}
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {stock.unit || "—"}
                        </td>

                        {/* Expiry */}
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {fmtDate(stock.expiry)}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          {expired ? (
                            <StatusBadge color="red" label="Expired" />
                          ) : low ? (
                            <StatusBadge color="amber" label="Low Stock" />
                          ) : (
                            <StatusBadge color="green" label="In Stock" />
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                router.push(`/stocks/edit/${stock._id}`)
                              }
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                router.push(`/stocks/view/${stock._id}`)
                              }
                              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          {stocks.length > 0 && !loading && (
            <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
              <p className="text-xs text-gray-400">
                Showing{" "}
                <span className="font-medium text-gray-600">{stocks.length}</span>{" "}
                stock {stocks.length === 1 ? "item" : "items"}
                {hasFilters && " · filtered view"}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────── */

function KpiCard({ label, value, icon: Icon, iconClass, small, accent, onClick }) {
  const accentBorder = {
    amber: "border-amber-200",
    red: "border-red-200",
  };
  const accentText = {
    amber: "text-amber-700",
    red: "text-red-700",
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border shadow-sm px-5 py-4 flex items-center gap-4 ${
        onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""
      } ${accent ? accentBorder[accent] : "border-gray-200"}`}
    >
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p
          className={`font-bold truncate ${
            small ? "text-lg" : "text-2xl"
          } ${accent ? accentText[accent] : "text-gray-900"}`}
        >
          {value}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
      {onClick && (
        <ChevronRight className="w-4 h-4 text-gray-300 ml-auto shrink-0" />
      )}
    </div>
  );
}

function BranchCard({ data, active, disabled, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border-2 p-5 transition-all ${
        disabled
          ? "border-gray-200 bg-white cursor-default"
          : active
          ? "border-indigo-400 bg-indigo-50 shadow-md cursor-pointer"
          : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm cursor-pointer"
      }`}
    >
      {/* Card header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              active ? "bg-indigo-200 text-indigo-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            <MapPin className="w-4 h-4" />
          </div>
          <span
            className={`font-semibold text-sm ${
              active ? "text-indigo-700" : "text-gray-800"
            }`}
          >
            {data.location}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {data.lowStockCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium border border-amber-200">
              {data.lowStockCount} low
            </span>
          )}
          {data.expiredCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium border border-red-200">
              {data.expiredCount} exp
            </span>
          )}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-3">
        <Metric label="Items" value={data.totalItems} />
        <Metric label="Qty" value={data.availableQty} />
        <Metric
          label="MRP Value"
          value={fmt(data.stockValue)}
          small
          highlight="green"
        />
        <Metric
          label="Purchase"
          value={fmt(data.purchaseValue)}
          small
          highlight="blue"
        />
        <Metric
          label="Sell Price"
          value={fmt(data.soldValue)}
          small
          highlight="purple"
        />
      </div>
    </div>
  );
}

function Metric({ label, value, small, highlight }) {
  const colors = {
    green: "text-emerald-700",
    blue: "text-blue-700",
    purple: "text-purple-700",
  };
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p
        className={`font-semibold ${small ? "text-xs" : "text-base"} ${
          highlight ? colors[highlight] : "text-gray-900"
        } truncate`}
      >
        {value}
      </p>
    </div>
  );
}

function FilterPill({ color, icon, label, onRemove }) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    gray: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[color]}`}
    >
      {icon}
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 hover:opacity-70 leading-none"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

function StatusBadge({ color, label }) {
  const styles = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border whitespace-nowrap ${styles[color]}`}
    >
      {label}
    </span>
  );
}
