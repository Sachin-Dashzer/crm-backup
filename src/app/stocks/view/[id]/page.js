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
      <div className="min-h-screen bg-[#f8f9fc]">
        <div className="flex">
          <Sidebar />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mx-auto"></div>
              <p className="mt-4 text-base font-medium text-gray-500">
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
    <div className="min-h-screen bg-[#f8f9fc]">
      <div className="flex">
        <Sidebar />
        <main className="flex-1 flex flex-col min-h-screen">
          <div className="bg-white border-b border-gray-200 shadow-sm px-6 py-4 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.back()}
                  className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back
                </button>

                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>

                <div>
                  <h1 className="text-lg font-bold text-gray-900 leading-tight">{stock.name}</h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    {isExpired ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                        Expired
                      </span>
                    ) : isLowStock ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                        Low Stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                        In Stock
                      </span>
                    )}
                    <span className="text-xs text-gray-400">ID: {stock._id?.slice(-8)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => router.push(`/stocks/edit/${stockId}`)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Stock
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 border-t-2 border-t-emerald-500">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Current Stock</p>
              <p className="text-3xl font-bold text-gray-900">{stock.totalQuantity}</p>
              <p className="text-sm text-gray-500 mt-1">{stock.unit || "units"}</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 border-t-2 border-t-indigo-500">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">MRP</p>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(stock.mrp)}</p>
              <p className="text-sm text-gray-500 mt-1">per {stock.unit || "unit"}</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 border-t-2 border-t-purple-500">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Stock Value</p>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(stock.totalQuantity * stock.mrp)}</p>
              <p className="text-sm text-gray-500 mt-1">current inventory</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 border-t-2 border-t-teal-500">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Sold Amount</p>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(stock.soldAmt || 0)}</p>
              <p className="text-sm text-gray-500 mt-1">lifetime sales</p>
            </div>
          </div>

          <div className="px-6 pb-8">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="border-b border-gray-100">
                <nav className="flex">
                  <button
                    onClick={() => setActiveTab("details")}
                    className={`px-6 py-4 font-medium text-sm border-b-2 transition-all ${
                      activeTab === "details"
                        ? "border-emerald-500 text-emerald-700 bg-emerald-50/50"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Details
                  </button>
                  <button
                    onClick={() => setActiveTab("transactions")}
                    className={`px-6 py-4 font-medium text-sm border-b-2 transition-all flex items-center gap-2 ${
                      activeTab === "transactions"
                        ? "border-emerald-500 text-emerald-700 bg-emerald-50/50"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Transactions
                    {stock.vendors && stock.vendors.length > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${activeTab === "transactions" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                        {stock.vendors.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab("history")}
                    className={`px-6 py-4 font-medium text-sm border-b-2 transition-all flex items-center gap-2 ${
                      activeTab === "history"
                        ? "border-emerald-500 text-emerald-700 bg-emerald-50/50"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Edit History
                    {stock.editors && stock.editors.length > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${activeTab === "history" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                        {stock.editors.length}
                      </span>
                    )}
                  </button>
                </nav>
              </div>

              <div className="p-6">
                {activeTab === "details" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-gray-50/50 rounded-xl p-5">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Product Info</h3>
                        <div className="space-y-0">
                          <div className="flex justify-between items-center py-3 border-b border-gray-100">
                            <span className="text-sm text-gray-500">Product Name</span>
                            <span className="text-sm font-semibold text-gray-900">{stock.name}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-gray-100">
                            <span className="text-sm text-gray-500">Unit</span>
                            <span className="text-sm font-semibold text-gray-900">{stock.unit || "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-gray-100">
                            <span className="text-sm text-gray-500">Weight</span>
                            <span className="text-sm font-semibold text-gray-900">{stock.weight || "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-gray-100">
                            <span className="text-sm text-gray-500">GST Number</span>
                            <span className="text-sm font-semibold text-gray-900">{stock.gstNo || "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-center py-3">
                            <span className="text-sm text-gray-500">Expiry Date</span>
                            <span className={`text-sm font-semibold ${isExpired ? "text-red-600" : "text-gray-900"}`}>
                              {formatDate(stock.expiry)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50/50 rounded-xl p-5">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Financial Info</h3>
                        <div className="space-y-0">
                          <div className="flex justify-between items-center py-3 border-b border-gray-100">
                            <span className="text-sm text-gray-500">MRP</span>
                            <span className="text-sm font-semibold text-emerald-600">{formatCurrency(stock.mrp)}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-gray-100">
                            <span className="text-sm text-gray-500">Purchase Amount</span>
                            <span className="text-sm font-semibold text-gray-900">{formatCurrency(stock.purchaseAmt || 0)}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-gray-100">
                            <span className="text-sm text-gray-500">Sold Amount</span>
                            <span className="text-sm font-semibold text-gray-900">{formatCurrency(stock.soldAmt || 0)}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-gray-100">
                            <span className="text-sm text-gray-500">Current Stock Value</span>
                            <span className="text-sm font-semibold text-gray-900">{formatCurrency(stock.totalQuantity * stock.mrp)}</span>
                          </div>
                          <div className="flex justify-between items-center py-3">
                            <span className="text-sm text-gray-500">Margin</span>
                            <span className="text-sm font-semibold text-green-600">
                              {formatCurrency((stock.soldAmt || 0) - (stock.purchaseAmt || 0))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-gray-50/50 rounded-xl p-5">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Creation Info</h3>
                        <div className="space-y-0">
                          <div className="flex justify-between items-center py-3 border-b border-gray-100">
                            <span className="text-sm text-gray-500">Created By</span>
                            <span className="text-sm font-semibold text-gray-900">{stock.createdBy?.name || "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-gray-100">
                            <span className="text-sm text-gray-500">Email</span>
                            <span className="text-sm font-semibold text-gray-900 truncate max-w-[180px]">{stock.createdBy?.email || "N/A"}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-gray-100">
                            <span className="text-sm text-gray-500">Branch</span>
                            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                              {stock.createdBy?.branch || "N/A"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-3">
                            <span className="text-sm text-gray-500">Created On</span>
                            <span className="text-sm font-semibold text-gray-900">{formatDate(stock.createdBy?.date)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50/50 rounded-xl p-5">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">System Info</h3>
                        <div className="space-y-0">
                          <div className="flex justify-between items-center py-3 border-b border-gray-100">
                            <span className="text-sm text-gray-500">Stock ID</span>
                            <span className="text-sm font-semibold text-gray-900 font-mono">{stock._id?.slice(-12)}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-gray-100">
                            <span className="text-sm text-gray-500">Created At</span>
                            <span className="text-sm font-semibold text-gray-900">{formatDate(stock.createdAt)}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-gray-100">
                            <span className="text-sm text-gray-500">Last Updated</span>
                            <span className="text-sm font-semibold text-gray-900">{formatDate(stock.updatedAt)}</span>
                          </div>
                          <div className="flex justify-between items-center py-3">
                            <span className="text-sm text-gray-500">Total Edits</span>
                            <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
                              {stock.editors?.length || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "transactions" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-gray-900">Purchase Transactions</h3>
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-100">
                        {stock.vendors?.length || 0} transactions
                      </span>
                    </div>

                    {!stock.vendors || stock.vendors.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-2xl mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <h3 className="text-base font-semibold text-gray-700 mb-1">No transactions yet</h3>
                        <p className="text-sm text-gray-400 mb-6">Purchase transactions will appear here</p>
                        <button
                          onClick={() => router.push("/admin/transactions/create")}
                          className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition-colors"
                        >
                          Record First Transaction
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {stock.vendors.map((transaction, index) => (
                          <div
                            key={index}
                            className="bg-white border border-gray-100 rounded-xl p-4 hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer"
                            onClick={() => router.push(`/admin/transactions/view/${transaction._id}`)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700 font-bold text-sm">
                                  {transaction.vendor?.name?.charAt(0).toUpperCase() || "P"}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {transaction.vendor?.name || "Direct Purchase"}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {formatDate(transaction.date || transaction.createdAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-base font-bold text-emerald-600">
                                  {formatCurrency(transaction.amount || 0)}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5 justify-end">
                                  <span className="text-xs text-gray-400">Qty: {transaction.quantity}</span>
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
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

                {activeTab === "history" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-gray-900">Edit History</h3>
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-100">
                        {stock.editors?.length || 0} edits
                      </span>
                    </div>

                    {!stock.editors || stock.editors.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-2xl mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h3 className="text-base font-semibold text-gray-700 mb-1">No edits yet</h3>
                        <p className="text-sm text-gray-400">Edit history will appear here when changes are made</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {stock.editors.map((edit, index) => (
                          <div key={index} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700 font-bold text-sm">
                                  {edit.name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{edit.name}</p>
                                  <p className="text-xs text-gray-400">{edit.email}</p>
                                </div>
                              </div>
                              <div className="text-right flex flex-col items-end gap-1">
                                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                                  {formatDate(edit.date)}
                                </span>
                                {edit.branch && (
                                  <span className="text-xs px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                                    {edit.branch}
                                  </span>
                                )}
                              </div>
                            </div>

                            {edit.updatedFields && edit.updatedFields.length > 0 && (
                              <div className="border-t border-gray-100 pt-4">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Changes Made</p>
                                <div className="space-y-2">
                                  {edit.updatedFields.map((field, fieldIndex) => (
                                    <div key={fieldIndex} className="bg-gray-50 rounded-lg px-4 py-3">
                                      <p className="text-xs font-semibold text-gray-600 mb-1.5 capitalize">{field.name}</p>
                                      <div className="flex items-center gap-2 text-sm flex-wrap">
                                        <span className="text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded">
                                          {field.previousValue || "Empty"}
                                        </span>
                                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                        </svg>
                                        <span className="text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded">
                                          {field.newValue || "Empty"}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
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
          </div>
        </main>
      </div>
    </div>
  );
}
