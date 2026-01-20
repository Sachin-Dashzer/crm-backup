"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebars/Sidebar";
import Topbar from "@/components/Topbar";
import { useSession } from "next-auth/react";

export default function VendorsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDealsIn, setFilterDealsIn] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState(null);

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
        setVendors(data.data);
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error("Error fetching vendors:", error);
      alert("Failed to fetch vendors");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchVendors();
  };

  const handleDelete = async () => {
    if (!vendorToDelete) return;

    try {
      const response = await fetch(
        `/api/vendors/delete?id=${vendorToDelete._id}`,
        { method: "DELETE" }
      );
      const data = await response.json();

      if (data.success) {
        alert("Vendor deleted successfully");
        setShowDeleteModal(false);
        setVendorToDelete(null);
        fetchVendors();
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error("Error deleting vendor:", error);
      alert("Failed to delete vendor");
    }
  };

  const confirmDelete = (vendor) => {
    setVendorToDelete(vendor);
    setShowDeleteModal(true);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50">
      <Topbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Vendor Management
            </h1>
            <p className="text-gray-600 mt-2">Manage your suppliers and vendors</p>
          </div>

          {/* Actions Bar */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex flex-col lg:flex-row gap-4 items-end">
              {/* Search */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Vendors
                </label>
                <input
                  type="text"
                  placeholder="Search by name, email, or contact..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Filter by Deals In */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Category
                </label>
                <input
                  type="text"
                  placeholder="e.g., Surgical Equipment..."
                  value={filterDealsIn}
                  onChange={(e) => setFilterDealsIn(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleSearch}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Search
                </button>
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterDealsIn("");
                    fetchVendors();
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => router.push("/admin/vendors/create")}
                  className="px-6 py-2 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-md"
                >
                  + Add Vendor
                </button>
              </div>
            </div>
          </div>

          {/* Stats Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-linear-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
              <h3 className="text-lg font-semibold mb-2">Total Vendors</h3>
              <p className="text-4xl font-bold">{vendors.length}</p>
            </div>
          </div>

          {/* Vendors Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-linear-to-r from-blue-600 to-purple-600 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Contact</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Email</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Deals In</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">GST Number</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center">
                        <div className="flex justify-center items-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                      </td>
                    </tr>
                  ) : vendors.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                        No vendors found. Click "Add Vendor" to create one.
                      </td>
                    </tr>
                  ) : (
                    vendors.map((vendor) => (
                      <tr
                        key={vendor._id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">
                            {vendor.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {vendor.contact || "N/A"}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {vendor.email || "N/A"}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                            {vendor.DealsIn || "N/A"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {vendor.gstNumber || "N/A"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() =>
                                router.push(`/admin/vendors/edit/${vendor._id}`)
                              }
                              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                            >
                              Edit
                            </button>
                            {session?.user?.role === "admin" && (
                              <button
                                onClick={() => confirmDelete(vendor)}
                                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                              >
                                Delete
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
          </div>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Confirm Deletion
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete vendor{" "}
              <span className="font-semibold">{vendorToDelete?.name}</span>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setVendorToDelete(null);
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}