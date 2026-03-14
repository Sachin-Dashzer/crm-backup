"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Sidebar from "@/components/Sidebars/StockSidebar";

export default function ViewStockPage() {
  const router = useRouter();
  const params = useParams();
  const stockId = params.id;

  const [loading, setLoading] = useState(true);
  const [stock, setStock] = useState(null);
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    if (stockId) {
      fetchStockDetails();
    }
  }, [stockId]);

  const fetchStockDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/stocks/get?id=${stockId}`);
      const data = await response.json();

      if (data.success && data.data) {
        setStock(data.data);
      } else if (response.status === 403) {
        alert("You don't have access to this stock item. It belongs to a different branch.");
        router.push("/stocks/dashboard");
      } else {
        alert("Failed to fetch stock details");
        router.back();
      }
    } catch (error) {
      console.error("Error fetching stock:", error);
      alert("An error occurred while fetching stock details");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
              <p className="mt-4 text-lg font-medium text-gray-700">
                Loading stock details...
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!stock) {
    return null;
  }

  const isLowStock = stock.totalQuantity <= 10;
  const isExpired = stock.expiry && new Date(stock.expiry) <= new Date();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-end gap-4">
                <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl">
                  {stock.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {stock.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-2">
                    {isExpired ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium">
                        <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                        Expired
                      </span>
                    ) : isLowStock ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-medium">
                        <span className="w-2 h-2 bg-yellow-600 rounded-full"></span>
                        Low Stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        In Stock
                      </span>
                    )}
                    <span className="text-sm text-gray-500">
                      Stock ID: {stock._id?.slice(-8)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <button
                  onClick={() => router.back()}
                  className="inline-flex items-center border-green-300 gap-2 text-gray-600 hover:text-gray-900 mb-6 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  <span className="font-medium">Back</span>
                </button>

                <button
                  onClick={() => router.push(`/stocks/edit/${stockId}`)}
                  className="inline-flex items-center gap-2 mx-4 px-3 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Edit Stock
                </button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <p className="text-sm text-gray-600 mb-2">Current Stock</p>
              <p className="text-2xl font-bold text-gray-900">
                {stock.totalQuantity}
              </p>
              <p className="text-sm text-gray-500">{stock.unit || "units"}</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <p className="text-sm text-gray-600 mb-2">MRP</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stock.mrp)}
              </p>
              <p className="text-sm text-gray-500">
                per {stock.unit || "unit"}
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <p className="text-sm text-gray-600 mb-2">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stock.totalQuantity * stock.mrp)}
              </p>
              <p className="text-sm text-gray-500">current inventory</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <p className="text-sm text-gray-600 mb-2">Sold Amount</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stock.soldAmt || 0)}
              </p>
              <p className="text-sm text-gray-500">lifetime sales</p>
            </div>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab("details")}
                  className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === "details"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setActiveTab("transactions")}
                  className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === "transactions"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Transactions
                  {stock.vendors && stock.vendors.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                      {stock.vendors.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === "history"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Edit History
                  {stock.editors && stock.editors.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                      {stock.editors.length}
                    </span>
                  )}
                </button>
              </nav>
            </div>

            <div className="p-6">
              {/* Details Tab */}
              {activeTab === "details" && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                    {/* Product Information */}
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Product Information
                      </h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="text-gray-600">Product Name</span>
                          <span className="font-medium text-gray-900">
                            {stock.name}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="text-gray-600">Unit</span>
                          <span className="font-medium text-gray-900">
                            {stock.unit || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="text-gray-600">Weight</span>
                          <span className="font-medium text-gray-900">
                            {stock.weight || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="text-gray-600">GST Number</span>
                          <span className="font-medium text-gray-900">
                            {stock.gstNo || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3">
                          <span className="text-gray-600">Expiry Date</span>
                          <span
                            className={`font-medium ${isExpired ? "text-red-600" : "text-gray-900"}`}
                          >
                            {formatDate(stock.expiry)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Financial Information */}
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Financial Information
                      </h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="text-gray-600">MRP</span>
                          <span className="font-medium text-blue-600">
                            {formatCurrency(stock.mrp)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="text-gray-600">Purchase Amount</span>
                          <span className="font-medium text-gray-900">
                            {formatCurrency(stock.purchaseAmt || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="text-gray-600">Sold Amount</span>
                          <span className="font-medium text-gray-900">
                            {formatCurrency(stock.soldAmt || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="text-gray-600">
                            Current Stock Value
                          </span>
                          <span className="font-medium text-gray-900">
                            {formatCurrency(stock.totalQuantity * stock.mrp)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3">
                          <span className="text-gray-600">Margin</span>
                          <span className="font-medium text-green-600">
                            {formatCurrency(
                              (stock.soldAmt || 0) - (stock.purchaseAmt || 0),
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Creation Information */}
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Creation Information
                      </h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="text-gray-600">Created By</span>
                          <span className="font-medium text-gray-900">
                            {stock.createdBy?.name || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="text-gray-600">Email</span>
                          <span className="font-medium text-gray-900 text-sm truncate max-w-50">
                            {stock.createdBy?.email || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="text-gray-600">Branch</span>
                          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                            {stock.createdBy?.branch || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3">
                          <span className="text-gray-600">Created On</span>
                          <span className="font-medium text-gray-900">
                            {formatDate(stock.createdBy?.date)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* System Information */}
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-gray-900">
                        System Information
                      </h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="text-gray-600">Stock ID</span>
                          <span className="font-medium text-gray-900 text-sm font-mono">
                            {stock._id?.slice(-12)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="text-gray-600">Created At</span>
                          <span className="font-medium text-gray-900">
                            {formatDate(stock.createdAt)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="text-gray-600">Last Updated</span>
                          <span className="font-medium text-gray-900">
                            {formatDate(stock.updatedAt)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3">
                          <span className="text-gray-600">Total Edits</span>
                          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                            {stock.editors?.length || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Transactions Tab */}
              {activeTab === "transactions" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-gray-900">
                      Purchase Transactions
                    </h3>
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                      {stock.vendors?.length || 0} transactions
                    </span>
                  </div>

                  {!stock.vendors || stock.vendors.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="inline-block p-4 bg-gray-100 rounded-full mb-4">
                        <svg
                          className="w-12 h-12 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-700 mb-2">
                        No transactions yet
                      </h3>
                      <p className="text-gray-500 mb-6">
                        Purchase transactions will appear here
                      </p>
                      <button
                        onClick={() =>
                          router.push("/admin/transactions/create")
                        }
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        Record First Transaction
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {stock.vendors.map((transaction, index) => (
                        <div
                          key={index}
                          className="group border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
                          onClick={() =>
                            router.push(
                              `/admin/transactions/view/${transaction._id}`,
                            )
                          }
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-medium">
                                {transaction.vendor?.name
                                  ?.charAt(0)
                                  .toUpperCase() || "P"}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {transaction.vendor?.name ||
                                    "Direct Purchase"}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {formatDate(
                                    transaction.date || transaction.createdAt,
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-blue-600">
                                {formatCurrency(transaction.amount || 0)}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-gray-500">
                                  Qty: {transaction.quantity}
                                </span>
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                                  {transaction.type || "PURCHASE"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {activeTab === "history" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-gray-900">
                      Edit History
                    </h3>
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                      {stock.editors?.length || 0} edits
                    </span>
                  </div>

                  {!stock.editors || stock.editors.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="inline-block p-4 bg-gray-100 rounded-full mb-4">
                        <svg
                          className="w-12 h-12 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-700 mb-2">
                        No edits yet
                      </h3>
                      <p className="text-gray-500">
                        Edit history will appear here when changes are made
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {stock.editors.map((edit, index) => (
                        <div
                          key={index}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-700 font-medium">
                                {edit.name?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {edit.name}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {edit.email}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">
                                {formatDate(edit.date)}
                              </p>
                              <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                                {edit.branch}
                              </span>
                            </div>
                          </div>

                          {edit.updatedFields &&
                            edit.updatedFields.length > 0 && (
                              <div className="border-t border-gray-100 pt-4">
                                <p className="text-sm font-medium text-gray-700 mb-2">
                                  Changes Made:
                                </p>
                                <div className="space-y-2">
                                  {edit.updatedFields.map(
                                    (field, fieldIndex) => (
                                      <div
                                        key={fieldIndex}
                                        className="bg-gray-50 rounded p-3"
                                      >
                                        <p className="text-sm font-medium text-gray-700 mb-1 capitalize">
                                          {field.name}:
                                        </p>
                                        <div className="flex items-center gap-2 text-sm">
                                          <span className="text-red-600 font-medium">
                                            {field.previousValue || "Empty"}
                                          </span>
                                          <svg
                                            className="w-4 h-4 text-gray-400"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth="2"
                                              d="M13 7l5 5m0 0l-5 5m5-5H6"
                                            />
                                          </svg>
                                          <span className="text-green-600 font-medium">
                                            {field.newValue || "Empty"}
                                          </span>
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
