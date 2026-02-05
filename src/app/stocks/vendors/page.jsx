// app/(dashboard)/stocks/vendors/page.jsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebars/StockSidebar";
import { useSession } from "next-auth/react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  Building2,
  Package,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Download,
  Menu,
  Users,
  TrendingUp,
  ShoppingBag,
} from "lucide-react";

// ========== UTILITY FUNCTIONS ==========
const formatDate = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ========== STAT CARD COMPONENT ==========
function StatCard({ title, value, icon: Icon, gradient, iconBg, iconColor, subtitle }) {
  return (
    <div
      className={`bg-linear-to-br ${gradient} p-6 rounded-2xl shadow-lg text-white relative overflow-hidden transform hover:scale-105 transition-transform duration-300`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
      <div className="relative">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <p className="text-white/90 text-sm font-medium mb-1">{title}</p>
            <h3 className="text-3xl font-bold">{value}</h3>
          </div>
          <div className={`${iconBg} p-3 rounded-xl`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
        </div>
        <p className="text-white/80 text-sm font-medium">{subtitle}</p>
      </div>
    </div>
  );
}

// ========== DELETE MODAL COMPONENT ==========
function DeleteModal({ vendor, onClose, onConfirm, isDeleting }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
        <div className="p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Delete Vendor?
          </h2>
          <p className="text-gray-600 text-center mb-6">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-gray-900">{vendor?.name}</span>?
            This action cannot be undone.
          </p>
          
          {vendor && (
            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Vendor Name:</span>
                <span className="font-semibold text-gray-900">{vendor.name}</span>
              </div>
              {vendor.contact && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Contact:</span>
                  <span className="font-medium text-gray-900">{vendor.contact}</span>
                </div>
              )}
              {vendor.DealsIn && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Category:</span>
                  <span className="font-medium text-gray-900">{vendor.DealsIn}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 px-6 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-semibold text-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== MAIN COMPONENT ==========
export default function VendorsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDealsIn, setFilterDealsIn] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      let url = "/api/vendors/get";
      const params = new URLSearchParams();

      if (searchTerm) params.append("search", searchTerm);
      if (filterDealsIn) params.append("dealsIn", filterDealsIn);

      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setVendors(data.data || data.vendors || []);
      }
    } catch (error) {
      console.error("Error fetching vendors:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchVendors();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchVendors();
  };

  const handleDelete = async () => {
    if (!vendorToDelete) return;

    try {
      setIsDeleting(true);
      const response = await fetch(
        `/api/vendors/delete?id=${vendorToDelete._id}`,
        { method: "DELETE" }
      );
      const data = await response.json();

      if (data.success) {
        setShowDeleteModal(false);
        setVendorToDelete(null);
        fetchVendors();
      }
    } catch (error) {
      console.error("Error deleting vendor:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = (vendor) => {
    setVendorToDelete(vendor);
    setShowDeleteModal(true);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterDealsIn("");
    fetchVendors();
  };

  const hasActiveFilters = searchTerm || filterDealsIn;

  const downloadExcel = async () => {
    try {
      setDownloading(true);
      const { utils, writeFile } = await import("xlsx");

      const dataToExport = vendors.map((vendor) => ({
        Name: vendor.name || "",
        Contact: vendor.contact || "",
        Email: vendor.email || "",
        "Deals In": vendor.DealsIn || "",
        "GST Number": vendor.gstNumber || "",
        Address: vendor.address || "",
        "Created At": formatDate(vendor.createdAt),
      }));

      const wb = utils.book_new();
      const ws = utils.json_to_sheet(dataToExport);
      
      const maxWidth = 30;
      const colWidths = Object.keys(dataToExport[0] || {}).map((key) => ({
        wch: Math.min(Math.max(key.length, 10), maxWidth),
      }));
      ws["!cols"] = colWidths;
      
      utils.book_append_sheet(wb, ws, "Vendors");

      const fileName = `vendors_${new Date().toISOString().split("T")[0]}.xlsx`;
      writeFile(wb, fileName);
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      setDownloading(false);
    }
  };

  // Get unique categories
  const categories = [...new Set(vendors.map(v => v.DealsIn).filter(Boolean))];

  // Stats
  const totalVendors = vendors.length;
  const activeCategories = categories.length;

  if (loading && vendors.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-16 w-16 text-indigo-500 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading vendors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full lg:w-auto min-w-0">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl bg-white border-2 border-gray-200 shadow-sm"
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                  Vendor Management
                </h1>
                <p className="text-gray-600 text-sm sm:text-base">
                  Manage your suppliers and vendors
                </p>
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={downloadExcel}
                disabled={downloading || vendors.length === 0}
                className="bg-linear-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-3 sm:px-5 py-2 sm:py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span className="hidden xs:inline">Downloading...</span>
                  </>
                ) : (
                  <>
                    <Download size={18} strokeWidth={2.5} />
                    <span className="hidden xs:inline">Export</span>
                  </>
                )}
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 sm:p-3 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
                title="Refresh data"
              >
                <RefreshCw
                  className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-600 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
              </button>
              <button
                onClick={() => router.push("/stocks/vendors/create")}
                className="bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-3 sm:px-5 py-2 sm:py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm sm:text-base"
              >
                <Plus size={18} strokeWidth={2.5} />
                <span className="hidden xs:inline">Add Vendor</span>
                <span className="xs:hidden">Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
          <StatCard
            title="Total Vendors"
            value={totalVendors}
            icon={Users}
            gradient="from-indigo-500 to-purple-600"
            iconBg="bg-indigo-100"
            iconColor="text-indigo-600"
            subtitle="Active suppliers"
          />
          <StatCard
            title="Categories"
            value={activeCategories}
            icon={ShoppingBag}
            gradient="from-emerald-500 to-green-600"
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
            subtitle="Unique categories"
          />
          <StatCard
            title="Recent Activity"
            value={vendors.filter(v => {
              const created = new Date(v.createdAt);
              const weekAgo = new Date();
              weekAgo.setDate(weekAgo.getDate() - 7);
              return created > weekAgo;
            }).length}
            icon={TrendingUp}
            gradient="from-amber-500 to-orange-600"
            iconBg="bg-amber-100"
            iconColor="text-amber-600"
            subtitle="Added this week"
          />
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-6">
          <div className="p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4">
              {/* Search */}
              <div className="relative flex-1 w-full lg:w-auto min-w-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search vendors by name, email, or contact..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch(e)}
                  className="pl-11 pr-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 text-sm w-full lg:w-96 transition-all"
                />
              </div>

              {/* Filter and Action Buttons */}
              <div className="flex gap-2 sm:gap-3 w-full lg:w-auto">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2.5 sm:p-3 rounded-xl transition-all flex items-center gap-2 ${
                    showFilters
                      ? "bg-indigo-50 text-indigo-600 ring-2 ring-indigo-200"
                      : "bg-gray-50 hover:bg-gray-100 text-gray-600"
                  }`}
                >
                  <Filter className="w-5 h-5" />
                  {showFilters ? (
                    <ChevronUp className="w-4 h-4 hidden sm:block" />
                  ) : (
                    <ChevronDown className="w-4 h-4 hidden sm:block" />
                  )}
                </button>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2.5 sm:py-3 text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl transition-all font-medium flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                )}
                <button
                  onClick={handleSearch}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 bg-linear-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all font-semibold text-sm flex items-center gap-2 shadow-lg"
                >
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">Search</span>
                </button>
              </div>
            </div>

            {/* Expandable Filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-100 animate-in slide-in-from-top duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Filter by Category
                    </label>
                    <div className="relative">
                      <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="e.g., Surgical Equipment, Medicines..."
                        value={filterDealsIn}
                        onChange={(e) => setFilterDealsIn(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 text-sm"
                      />
                    </div>
                  </div>
                  {categories.length > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Quick Categories
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {categories.slice(0, 5).map((cat) => (
                          <button
                            key={cat}
                            onClick={() => {
                              setFilterDealsIn(cat);
                              fetchVendors();
                            }}
                            className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-all text-xs font-semibold border border-indigo-200"
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {hasActiveFilters && (
                  <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-indigo-900">
                        Active Filters:
                      </span>
                      <span className="text-xs text-indigo-700">
                        {vendors.length} results
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {searchTerm && (
                        <span className="px-2 py-1 bg-white text-indigo-700 rounded-md text-xs font-medium border border-indigo-200">
                          Search: "{searchTerm}"
                        </span>
                      )}
                      {filterDealsIn && (
                        <span className="px-2 py-1 bg-white text-indigo-700 rounded-md text-xs font-medium border border-indigo-200">
                          Category: {filterDealsIn}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Vendors Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-linear-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Vendor Details
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Contact Info
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Category
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    GST Number
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="animate-spin h-12 w-12 text-indigo-500 mb-4" />
                        <p className="text-gray-600 font-medium">Loading vendors...</p>
                      </div>
                    </td>
                  </tr>
                ) : vendors.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                          <Users className="w-8 h-8 text-indigo-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          No vendors found
                        </h3>
                        <p className="text-gray-600 mb-4">
                          {hasActiveFilters
                            ? "Try adjusting your filters"
                            : "Get started by adding your first vendor"}
                        </p>
                        {!hasActiveFilters && (
                          <button
                            onClick={() => router.push("/stocks/vendors/create")}
                            className="px-6 py-2.5 bg-linear-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all font-semibold flex items-center gap-2 shadow-lg"
                          >
                            <Plus size={18} />
                            Add Your First Vendor
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  vendors.map((vendor) => (
                    <tr
                      key={vendor._id}
                      className="hover:bg-indigo-50/30 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-linear-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md">
                            {vendor.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 text-sm">
                              {vendor.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              Added {formatDate(vendor.createdAt)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {vendor.contact && (
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <Phone className="w-4 h-4 text-gray-400" />
                              {vendor.contact}
                            </div>
                          )}
                          {vendor.email && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Mail className="w-4 h-4 text-gray-400" />
                              {vendor.email}
                            </div>
                          )}
                          {!vendor.contact && !vendor.email && (
                            <span className="text-sm text-gray-400">No contact info</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {vendor.DealsIn ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-r from-purple-50 to-indigo-50 text-purple-700 rounded-lg text-xs font-semibold border border-purple-200">
                            <Package className="w-3.5 h-3.5" />
                            {vendor.DealsIn}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {vendor.gstNumber ? (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-mono text-gray-700">
                              {vendor.gstNumber}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() =>
                              router.push(`/stocks/vendors/edit/${vendor._id}`)
                            }
                            className="p-2 hover:bg-indigo-100 rounded-lg transition-colors text-indigo-600 hover:text-indigo-800"
                            title="Edit vendor"
                          >
                            <Edit2 size={18} />
                          </button>
                          {session?.user?.role === "admin" && (
                            <button
                              onClick={() => confirmDelete(vendor)}
                              className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600 hover:text-red-800"
                              title="Delete vendor"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Count */}
          {vendors.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing <span className="font-semibold text-gray-900">{vendors.length}</span>{" "}
                  {vendors.length === 1 ? "vendor" : "vendors"}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Clear all filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Delete Modal */}
      {showDeleteModal && (
        <DeleteModal
          vendor={vendorToDelete}
          onClose={() => {
            setShowDeleteModal(false);
            setVendorToDelete(null);
          }}
          onConfirm={handleDelete}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}