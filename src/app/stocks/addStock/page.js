"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import StockSidebar from "@/components/Sidebars/StockSidebar";
import SearchableSelect from "@/components/SearchableSelect";
import {
  Plus,
  Trash2,
  Package,
  AlertCircle,
  ArrowLeft,
  ShoppingCart,
  MapPin,
} from "lucide-react";

export default function StockPurchasePage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [stocks, setStocks] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [toast, setToast] = useState({ show: false, message: "", type: "" });

  // Purchase form data
  const [purchaseData, setPurchaseData] = useState({
    vendorId: "",
    paymentMethod: "cash",
    purchaseDate: new Date().toISOString().split("T")[0],
    remarks: "",
  });

  // Items to purchase (array of stock items)
  const [purchaseItems, setPurchaseItems] = useState([
    {
      id: Date.now(),
      stockId: "",
      stockName: "",
      quantity: "",
      purchasePrice: "",
      totalAmount: 0,
    },
  ]);

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "" });
    }, 3000);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      // Fetch stocks
      const stockRes = await fetch("/api/stocks/get");
      const stockData = await stockRes.json();
      if (stockData.success) {
        setStocks(stockData.data || stockData.stocks || []);
      }

      // Fetch vendors
      const vendorRes = await fetch("/api/vendors/get");
      const vendorData = await vendorRes.json();
      if (vendorData.success) {
        setVendors(vendorData.data || vendorData.vendors || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      showToast("Failed to load data", "error");
    } finally {
      setFetchLoading(false);
    }
  };

  // Add new item row
  const addItem = () => {
    setPurchaseItems([
      ...purchaseItems,
      {
        id: Date.now(),
        stockId: "",
        stockName: "",
        quantity: "",
        purchasePrice: "",
        totalAmount: 0,
      },
    ]);
  };

  // Remove item row
  const removeItem = (id) => {
    if (purchaseItems.length === 1) {
      showToast("At least one item is required", "error");
      return;
    }
    setPurchaseItems(purchaseItems.filter((item) => item.id !== id));
  };

  // Update item field
  const updateItem = (id, field, value) => {
    setPurchaseItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };

          // If stock is selected, get stock details
          if (field === "stockId" && value) {
            const selectedStock = stocks.find((s) => s._id === value);
            if (selectedStock) {
              updated.stockName = selectedStock.name;
              updated.purchasePrice = selectedStock.purchaseAmt || "";
            }
          }

          // Calculate total amount
          if (field === "quantity" || field === "purchasePrice") {
            const qty = parseFloat(
              field === "quantity" ? value : updated.quantity
            );
            const price = parseFloat(
              field === "purchasePrice" ? value : updated.purchasePrice
            );
            updated.totalAmount = !isNaN(qty) && !isNaN(price) ? qty * price : 0;
          }

          return updated;
        }
        return item;
      })
    );
  };

  // Calculate grand total
  const calculateGrandTotal = () => {
    return purchaseItems.reduce(
      (sum, item) => sum + (parseFloat(item.totalAmount) || 0),
      0
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Validate form
  const validateForm = () => {
    if (!purchaseData.vendorId) {
      showToast("Please select a vendor", "error");
      return false;
    }

    if (purchaseItems.length === 0) {
      showToast("Please add at least one item", "error");
      return false;
    }

    for (const item of purchaseItems) {
      if (!item.stockId) {
        showToast("Please select stock for all items", "error");
        return false;
      }
      if (!item.quantity || parseFloat(item.quantity) <= 0) {
        showToast("Please enter valid quantity for all items", "error");
        return false;
      }
      if (!item.purchasePrice || parseFloat(item.purchasePrice) <= 0) {
        showToast("Please enter valid purchase price for all items", "error");
        return false;
      }
    }

    return true;
  };

  // Submit purchase
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      const payload = {
        vendorId: purchaseData.vendorId,
        paymentMethod: purchaseData.paymentMethod,
        purchaseDate: purchaseData.purchaseDate,
        remarks: purchaseData.remarks,
        items: purchaseItems.map((item) => ({
          stockId: item.stockId,
          quantity: parseFloat(item.quantity),
          purchasePrice: parseFloat(item.purchasePrice),
          totalAmount: parseFloat(item.totalAmount),
        })),
      };

      const response = await fetch("/api/stocks/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        showToast(
          `Stock purchase completed! ${data.itemsProcessed} items processed`,
          "success"
        );
        setTimeout(() => {
          router.push("/stocks/dashboard");
        }, 1500);
      } else {
        showToast(data.message || "Failed to process purchase", "error");
      }
    } catch (error) {
      console.error("Error:", error);
      showToast("An error occurred", "error");
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fc]">
        <StockSidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-emerald-600 rounded-full animate-spin mx-auto" />
            <p className="mt-3 text-sm text-gray-500">Loading data...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      <StockSidebar />

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div
            className={`px-6 py-4 rounded-xl shadow-lg border-2 flex items-center gap-3 ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : toast.type === "error"
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            {toast.type === "success" && (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {toast.type === "error" && (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col min-h-screen">
        {/* Sticky Header */}
        <div className="bg-white border-b border-gray-100 shadow-sm px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 bg-linear-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Stock Purchase</h1>
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                Record a new stock purchase from a vendor
                {session?.user?.branch && !["admin", "super-admin"].includes(session?.user?.role) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                    <MapPin className="w-3 h-3" /> {session.user.branch}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 px-6 py-6">
          <form onSubmit={handleSubmit} className="space-y-5 max-w-5xl">
            {/* Purchase Details Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-emerald-500 rounded-full" />
                  <h2 className="text-base font-semibold text-gray-900">Purchase Details</h2>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Vendor Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Vendor <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      options={vendors.map((v) => ({
                        value: v._id,
                        label: `${v.name} - ${v.contact || "N/A"}`,
                      }))}
                      value={purchaseData.vendorId}
                      onChange={(value) =>
                        setPurchaseData({ ...purchaseData, vendorId: value })
                      }
                      placeholder="Select vendor"
                      className="w-full"
                    />
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Payment Method <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={purchaseData.paymentMethod}
                      onChange={(e) => setPurchaseData({ ...purchaseData, paymentMethod: e.target.value })}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                      required
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="banking">Net Banking</option>
                      <option value="loan">Loan</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Purchase Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Purchase Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={purchaseData.purchaseDate}
                      onChange={(e) => setPurchaseData({ ...purchaseData, purchaseDate: e.target.value })}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Remarks */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Remarks</label>
                    <textarea
                      value={purchaseData.remarks}
                      onChange={(e) => setPurchaseData({ ...purchaseData, remarks: e.target.value })}
                      placeholder="Additional notes..."
                      rows="2"
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Items Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-emerald-500 rounded-full" />
                  <h2 className="text-base font-semibold text-gray-900">Stock Items</h2>
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700"
                >
                  <Plus size={16} />
                  Add Item
                </button>
              </div>
              <div className="p-6">
                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-emerald-50/50 border-b border-gray-100">
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-48">Stock Item</th>
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Quantity</th>
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Purchase Price</th>
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                        <th className="py-2.5 px-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {purchaseItems.map((item, index) => (
                        <tr key={item.id}>
                          <td className="py-3 px-3 text-gray-400 text-xs">{index + 1}</td>
                          <td className="py-3 px-3">
                            <SearchableSelect
                              options={stocks.map((s) => ({
                                value: s._id,
                                label: `${s.name} (Qty: ${s.totalQuantity || 0})`,
                              }))}
                              value={item.stockId}
                              onChange={(value) => updateItem(item.id, "stockId", value)}
                              placeholder="Select stock"
                              className="w-full"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <input
                              type="number" step="0.01" min="0"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                              placeholder="Qty"
                              className="w-24 px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                              required
                            />
                          </td>
                          <td className="py-3 px-3">
                            <input
                              type="number" step="0.01" min="0"
                              value={item.purchasePrice}
                              onChange={(e) => updateItem(item.id, "purchasePrice", e.target.value)}
                              placeholder="₹"
                              className="w-28 px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                              required
                            />
                          </td>
                          <td className="py-3 px-3 font-semibold text-gray-900">{formatCurrency(item.totalAmount)}</td>
                          <td className="py-3 px-3">
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              disabled={purchaseItems.length === 1}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Grand Total */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-3 min-w-56">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Items:</span>
                      <span className="font-medium text-gray-900">{purchaseItems.length}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Total Qty:</span>
                      <span className="font-medium text-gray-900">
                        {purchaseItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
                      <span className="text-sm font-semibold text-gray-700">Grand Total</span>
                      <span className="text-lg font-bold text-emerald-600">{formatCurrency(calculateGrandTotal())}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  "Complete Purchase"
                )}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                disabled={loading}
                className="px-5 py-2.5 bg-white text-sm font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 shadow-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
