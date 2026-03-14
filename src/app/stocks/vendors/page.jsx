"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Filter,
  X,
  Mail,
  Phone,
  Package,
  FileText,
  AlertCircle,
  Loader2,
  RefreshCw,
  Download,
  Users,
  TrendingUp,
  ShoppingBag,
} from "lucide-react";
import Sidebar from "@/components/Sidebars/StockSidebar";

const formatDate = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

function DeleteModal({ vendor, onClose, onConfirm, isDeleting }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 text-center mb-1">
            Delete Vendor?
          </h2>
          <p className="text-sm text-gray-500 text-center mb-5">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-gray-800">{vendor?.name}</span>?
            This action cannot be undone.
          </p>

          {vendor && (
            <div className="bg-gray-50 rounded-lg p-3 mb-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Vendor Name</span>
                <span className="font-medium text-gray-900">{vendor.name}</span>
              </div>
              {vendor.contact && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Contact</span>
                  <span className="font-medium text-gray-900">{vendor.contact}</span>
                </div>
              )}
              {vendor.DealsIn && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Category</span>
                  <span className="font-medium text-gray-900">{vendor.DealsIn}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 px-4 py-2.5 bg-white text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
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
      if (data.success) setVendors(data.data || data.vendors || []);
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
      const response = await fetch(`/api/vendors/delete?id=${vendorToDelete._id}`, {
        method: "DELETE",
      });
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
      ws["!cols"] = Object.keys(dataToExport[0] || {}).map(() => ({ wch: 20 }));
      utils.book_append_sheet(wb, ws, "Vendors");
      writeFile(wb, `vendors_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      setDownloading(false);
    }
  };

  const categories = [...new Set(vendors.map((v) => v.DealsIn).filter(Boolean))];
  const hasActiveFilters = searchTerm || filterDealsIn;

  const recentCount = vendors.filter((v) => {
    const created = new Date(v.createdAt);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return created > weekAgo;
  }).length;

  if (loading && vendors.length === 0) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
            <p className="mt-3 text-sm text-gray-500">Loading vendors...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage your suppliers and vendors</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadExcel}
              disabled={downloading || vendors.length === 0}
              className="px-3 py-2 bg-white text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-gray-600 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => router.push("/stocks/vendors/create")}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Vendor
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{vendors.length}</p>
              <p className="text-xs text-gray-500">Total Vendors</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
              <p className="text-xs text-gray-500">Categories</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{recentCount}</p>
              <p className="text-xs text-gray-500">Added This Week</p>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-5">
          <div className="p-4">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search vendors by name, email, or contact..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-3 py-2.5 text-sm rounded-lg border flex items-center gap-1.5 ${
                    showFilters
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                      : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filter
                </button>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="px-3 py-2.5 text-sm bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 flex items-center gap-1.5"
                >
                  <Search className="w-4 h-4" />
                  Search
                </button>
              </div>
            </form>

            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Filter by Category
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Surgical Equipment..."
                      value={filterDealsIn}
                      onChange={(e) => setFilterDealsIn(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  {categories.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        Quick Select
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {categories.slice(0, 5).map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => { setFilterDealsIn(cat); fetchVendors(); }}
                            className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-md border border-indigo-200 hover:bg-indigo-100"
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Vendor
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Contact Info
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Category
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    GST Number
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-5 py-12 text-center">
                      <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Loading vendors...</p>
                    </td>
                  </tr>
                ) : vendors.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-5 py-12 text-center">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Users className="w-6 h-6 text-gray-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        No vendors found
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">
                        {hasActiveFilters
                          ? "Try adjusting your filters"
                          : "Get started by adding your first vendor"}
                      </p>
                      {!hasActiveFilters && (
                        <button
                          onClick={() => router.push("/stocks/vendors/create")}
                          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          Add First Vendor
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  vendors.map((vendor) => (
                    <tr key={vendor._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-700 font-semibold text-sm shrink-0">
                            {vendor.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{vendor.name}</p>
                            <p className="text-xs text-gray-400">Added {formatDate(vendor.createdAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          {vendor.contact && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-700">
                              <Phone className="w-3.5 h-3.5 text-gray-400" />
                              {vendor.contact}
                            </div>
                          )}
                          {vendor.email && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-500">
                              <Mail className="w-3.5 h-3.5 text-gray-400" />
                              {vendor.email}
                            </div>
                          )}
                          {!vendor.contact && !vendor.email && (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {vendor.DealsIn ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-200">
                            <Package className="w-3 h-3" />
                            {vendor.DealsIn}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {vendor.gstNumber ? (
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-sm font-mono text-gray-700">{vendor.gstNumber}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => router.push(`/stocks/vendors/edit/${vendor._id}`)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit vendor"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {session?.user?.role === "admin" && (
                            <button
                              onClick={() => confirmDelete(vendor)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete vendor"
                            >
                              <Trash2 className="w-4 h-4" />
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

          {vendors.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing <span className="font-medium text-gray-900">{vendors.length}</span>{" "}
                {vendors.length === 1 ? "vendor" : "vendors"}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {showDeleteModal && (
        <DeleteModal
          vendor={vendorToDelete}
          onClose={() => { setShowDeleteModal(false); setVendorToDelete(null); }}
          onConfirm={handleDelete}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
