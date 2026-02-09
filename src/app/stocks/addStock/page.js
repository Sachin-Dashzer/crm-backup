"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import StockSidebar from "@/components/Sidebars/StockSidebar";
import SearchableSelect from "@/components/SearchableSelect";
import {
  Plus,
  Trash2,
  Save,
  Package,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  AlertCircle,
  ArrowLeft,
  ShoppingCart,
  IndianRupee,
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
      <div className="flex min-h-screen bg-gray-50">
        <StockSidebar />
        <main className="flex-1 p-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <StockSidebar />

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div
            className={`px-6 py-4 rounded-xl shadow-lg border-2 flex items-center gap-3 ${
              toast.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : toast.type === "error"
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            {toast.type === "success" && (
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
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

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-linear-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Stock Purchase
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Add multiple stock items from vendor
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Purchase Details Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              Purchase Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Vendor Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <select
                    value={purchaseData.paymentMethod}
                    onChange={(e) =>
                      setPurchaseData({
                        ...purchaseData,
                        paymentMethod: e.target.value,
                      })
                    }
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 bg-white transition-all"
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
              </div>

              {/* Purchase Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Purchase Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={purchaseData.purchaseDate}
                    onChange={(e) =>
                      setPurchaseData({
                        ...purchaseData,
                        purchaseDate: e.target.value,
                      })
                    }
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Remarks
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                  <textarea
                    value={purchaseData.remarks}
                    onChange={(e) =>
                      setPurchaseData({
                        ...purchaseData,
                        remarks: e.target.value,
                      })
                    }
                    placeholder="Additional notes..."
                    rows="3"
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Items Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                Stock Items
              </h2>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-md"
              >
                <Plus size={18} />
                <span className="font-semibold">Add Item</span>
              </button>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">
                      #
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 min-w-50">
                      Stock Item
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">
                      Quantity
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">
                      Purchase Price
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">
                      Total
                    </th>
                    <th className="text-center py-3 px-2 text-sm font-semibold text-gray-700">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseItems.map((item, index) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-3 px-2 text-sm text-gray-600">
                        {index + 1}
                      </td>
                      <td className="py-3 px-2">
                        <SearchableSelect
                          options={stocks.map((s) => ({
                            value: s._id,
                            label: `${s.name} (Stock: ${s.totalQuantity || 0})`,
                          }))}
                          value={item.stockId}
                          onChange={(value) =>
                            updateItem(item.id, "stockId", value)
                          }
                          placeholder="Select stock"
                          className="w-full"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.id, "quantity", e.target.value)
                          }
                          placeholder="Qty"
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 text-sm"
                          required
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.purchasePrice}
                          onChange={(e) =>
                            updateItem(item.id, "purchasePrice", e.target.value)
                          }
                          placeholder="Price"
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 text-sm"
                          required
                        />
                      </td>
                      <td className="py-3 px-2">
                        <div className="font-semibold text-indigo-600">
                          {formatCurrency(item.totalAmount)}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={purchaseItems.length === 1}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Grand Total */}
            <div className="mt-6 flex justify-end">
              <div className="bg-linear-to-br from-indigo-50 to-purple-50 rounded-xl p-4 min-w-75">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    Total Items:
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    {purchaseItems.length}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    Total Quantity:
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    {purchaseItems.reduce(
                      (sum, item) => sum + (parseFloat(item.quantity) || 0),
                      0
                    )}
                  </span>
                </div>
                <div className="border-t border-gray-300 my-2"></div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900">
                    Grand Total:
                  </span>
                  <span className="text-2xl font-bold text-indigo-600">
                    {formatCurrency(calculateGrandTotal())}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-linear-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Save size={20} />
                  <span>Complete Purchase</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}