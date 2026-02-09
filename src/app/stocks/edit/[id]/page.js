"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Sidebar from "@/components/Sidebars/StockSidebar";

export default function EditStockPage() {
  const router = useRouter();
  const params = useParams();
  const stockId = params.id;

  const [loading, setLoading] = useState(false);
  const [fetchingStock, setFetchingStock] = useState(true);
  const [originalData, setOriginalData] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    mrp: "",
    gstNo: "",
    weight: "",
    unit: "",
    expiry: "",
    purchaseAmt: "",
    soldAmt: "",
  });

  useEffect(() => {
    if (stockId) {
      fetchStock();
    }
  }, [stockId]);

  const fetchStock = async () => {
    try {
      setFetchingStock(true);
      const response = await fetch(`/api/stocks/get?id=${stockId}`);
      const data = await response.json();

      if (data.success && data.data) {
        const stock = data.data;
        const stockData = {
          name: stock.name || "",
          mrp: stock.mrp || "",
          gstNo: stock.gstNo || "",
          weight: stock.weight || "",
          unit: stock.unit || "",
          soldAmt: stock.soldAmt || "",
          purchaseAmt: stock.purchaseAmt || "",
          expiry: stock.expiry
            ? new Date(stock.expiry).toISOString().split("T")[0]
            : "",
        };
        setFormData(stockData);
        setOriginalData(stockData);
      } else {
        alert("Failed to fetch stock details");
        router.back();
      }
    } catch (error) {
      console.error("Error fetching stock:", error);
      alert("An error occurred while fetching stock details");
      router.back();
    } finally {
      setFetchingStock(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const getChangedFields = () => {
    if (!originalData) return [];

    const changedFields = [];
    Object.keys(formData).forEach((key) => {
      const oldValue = originalData[key]?.toString() || "";
      const newValue = formData[key]?.toString() || "";

      if (oldValue !== newValue) {
        changedFields.push({
          name: key,
          previousValue: oldValue,
          newValue: newValue,
        });
      }
    });

    return changedFields;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.mrp) {
      alert("Product name and MRP are required");
      return;
    }

    const changedFields = getChangedFields();
    if (changedFields.length === 0) {
      alert("No changes detected");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/stocks/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: stockId,
          name: formData.name,
          mrp: Number(formData.mrp),
          gstNo: formData.gstNo || undefined,
          weight: formData.weight ? Number(formData.weight) : undefined,
          unit: formData.unit || undefined,
          expiry: formData.expiry || undefined,
          purchaseAmt: formData.purchaseAmt || undefined,
          soldAmt: formData.soldAmt || undefined,
          updatedFields: changedFields,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert("Stock item updated successfully!");
        router.push("/stocks/dashboard");
      } else {
        alert(data.message || "Failed to update stock item");
      }
    } catch (error) {
      console.error("Error updating stock:", error);
      alert("An error occurred while updating the stock item");
    } finally {
      setLoading(false);
    }
  };

  if (fetchingStock) {
    return (
      <div className="min-h-screen bg-linear-to-br from-indigo-50 via-white to-purple-50">
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8 flex items-center justify-center">
            <div className="text-center">
              <div className="relative inline-block">
                <div className="w-20 h-20 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-t-purple-400 rounded-full animate-spin animation-delay-150"></div>
              </div>
              <p className="mt-6 text-lg font-semibold text-gray-700 animate-pulse">
                Loading stock details...
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const changedFieldsCount = getChangedFields().length;

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-50 via-white to-purple-50">
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          {/* Form Card with Glassmorphism Effect */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-10 max-w-5xl mx-auto border border-white/20">
            {/* Animated Header */}
            <div className="mb-10 animate-fadeIn">
              <div className=" flex justify-between items-center">
                <div className="flex items-center gap-4 mb-3">
                  <div className="p-3 bg-linear-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
                    <svg
                      className="w-8 h-8 text-white"
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
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-linear-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                      Edit Stock Item
                    </h1>
                    <p className="text-gray-600 ">
                      Update inventory item details
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => router.back()}
                  className="group mb-6 flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition-all duration-300"
                >
                  <svg
                    className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform duration-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  <span className="font-medium">Back to Inventory</span>
                </button>
              </div>

              {/* Changes Badge */}
              {changedFieldsCount > 0 && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 border-2 border-amber-300 rounded-full animate-bounce-slow">
                  <svg
                    className="w-5 h-5 text-amber-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span className="font-semibold text-amber-800">
                    {changedFieldsCount} field
                    {changedFieldsCount > 1 ? "s" : ""} changed
                  </span>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-10">
              {/* Product Information Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b-2 border-linear-to-r from-indigo-200 to-purple-200">
                  <div className="p-2 bg-linear-to-br from-indigo-100 to-purple-100 rounded-xl">
                    <svg
                      className="w-6 h-6 text-indigo-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    Product Information
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Product Name */}
                  <div className="group">
                    <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-1 h-5 bg-linear-to-b from-indigo-500 to-purple-500 rounded-full"></span>
                      Product Name <span className="text-red-500">*</span>
                      {originalData?.name !== formData.name && (
                        <span className="ml-auto text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                          Modified
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className={`w-full px-5 py-4 border-2 rounded-xl focus:ring-4 transition-all duration-300 outline-none bg-white/50 backdrop-blur-sm ${
                        originalData?.name !== formData.name
                          ? "border-amber-300 focus:ring-amber-100 focus:border-amber-500"
                          : "border-gray-200 focus:ring-indigo-100 focus:border-indigo-500"
                      }`}
                      placeholder="Enter product name"
                    />
                  </div>

                  {/* MRP */}
                  <div className="group">
                    <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-1 h-5 bg-linear-to-b from-green-500 to-emerald-500 rounded-full"></span>
                      MRP (Price) <span className="text-red-500">*</span>
                      {originalData?.mrp !== formData.mrp && (
                        <span className="ml-auto text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                          Modified
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-4 flex items-center text-gray-500 font-semibold">
                        ₹
                      </span>
                      <input
                        type="number"
                        name="mrp"
                        value={formData.mrp}
                        onChange={handleChange}
                        required
                        min="0"
                        step="0.01"
                        className={`w-full pl-10 pr-5 py-4 border-2 rounded-xl focus:ring-4 transition-all duration-300 outline-none bg-white/50 backdrop-blur-sm ${
                          originalData?.mrp !== formData.mrp
                            ? "border-amber-300 focus:ring-amber-100 focus:border-amber-500"
                            : "border-gray-200 focus:ring-green-100 focus:border-green-500"
                        }`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  {/* Purchased Amount */}
                  <div className="group">
                    <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-1 h-5 bg-linear-to-b from-green-500 to-emerald-500 rounded-full"></span>
                      Purchased Amount <span className="text-red-500">*</span>
                      {originalData?.purchaseAmt !== formData.purchaseAmt && (
                        <span className="ml-auto text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                          Modified
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-4 flex items-center text-gray-500 font-semibold">
                        ₹
                      </span>
                      <input
                        type="number"
                        name="purchaseAmt"
                        value={formData.purchaseAmt}
                        onChange={handleChange}
                        required
                        min="0"
                        step="0.01"
                        className={`w-full pl-10 pr-5 py-4 border-2 rounded-xl focus:ring-4 transition-all duration-300 outline-none bg-white/50 backdrop-blur-sm ${
                          originalData?.purchaseAmt !== formData.purchaseAmt
                            ? "border-amber-300 focus:ring-amber-100 focus:border-amber-500"
                            : "border-gray-200 focus:ring-green-100 focus:border-green-500"
                        }`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Sold Amount */}
                  <div className="group">
                    <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-1 h-5 bg-linear-to-b from-green-500 to-emerald-500 rounded-full"></span>
                      Selling Price <span className="text-red-500">*</span>
                      {originalData?.soldAmt !== formData.soldAmt && (
                        <span className="ml-auto text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                          Modified
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-4 flex items-center text-gray-500 font-semibold">
                        ₹
                      </span>
                      <input
                        type="number"
                        name="soldAmt"
                        value={formData.soldAmt}
                        onChange={handleChange}
                        required
                        min="0"
                        step="0.01"
                        className={`w-full pl-10 pr-5 py-4 border-2 rounded-xl focus:ring-4 transition-all duration-300 outline-none bg-white/50 backdrop-blur-sm ${
                          originalData?.soldAmt !== formData.soldAmt
                            ? "border-amber-300 focus:ring-amber-100 focus:border-amber-500"
                            : "border-gray-200 focus:ring-green-100 focus:border-green-500"
                        }`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Weight */}
                  <div className="group">
                    <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-1 h-5 bg-linear-to-b from-orange-500 to-red-500 rounded-full"></span>
                      Weight
                      {originalData?.weight !== formData.weight && (
                        <span className="ml-auto text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                          Modified
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      name="weight"
                      value={formData.weight}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className={`w-full px-5 py-4 border-2 rounded-xl focus:ring-4 transition-all duration-300 outline-none bg-white/50 backdrop-blur-sm ${
                        originalData?.weight !== formData.weight
                          ? "border-amber-300 focus:ring-amber-100 focus:border-amber-500"
                          : "border-gray-200 focus:ring-orange-100 focus:border-orange-500"
                      }`}
                      placeholder="Enter weight"
                    />
                  </div>

                  {/* Unit */}
                  <div className="group">
                    <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-1 h-5 bg-linear-to-b from-blue-500 to-cyan-500 rounded-full"></span>
                      Unit
                      {originalData?.unit !== formData.unit && (
                        <span className="ml-auto text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                          Modified
                        </span>
                      )}
                    </label>
                    <select
                      name="unit"
                      value={formData.unit}
                      onChange={handleChange}
                      className={`w-full px-5 py-4 border-2 rounded-xl focus:ring-4 transition-all duration-300 outline-none bg-white/50 backdrop-blur-sm appearance-none cursor-pointer ${
                        originalData?.unit !== formData.unit
                          ? "border-amber-300 focus:ring-amber-100 focus:border-amber-500"
                          : "border-gray-200 focus:ring-blue-100 focus:border-blue-500"
                      }`}
                    >
                      <option value="">Select unit</option>
                      <option value="pieces">Pieces</option>
                      <option value="kg">Kilograms (kg)</option>
                      <option value="grams">Grams (g)</option>
                      <option value="liters">Liters (L)</option>
                      <option value="ml">Milliliters (ml)</option>
                      <option value="boxes">Boxes</option>
                      <option value="bottles">Bottles</option>
                      <option value="packets">Packets</option>
                    </select>
                  </div>

                  {/* GST Number */}
                  <div className="group">
                    <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-1 h-5 bg-linear-to-b from-purple-500 to-pink-500 rounded-full"></span>
                      GST Number
                      {originalData?.gstNo !== formData.gstNo && (
                        <span className="ml-auto text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                          Modified
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      name="gstNo"
                      value={formData.gstNo}
                      onChange={handleChange}
                      className={`w-full px-5 py-4 border-2 rounded-xl focus:ring-4 transition-all duration-300 outline-none bg-white/50 backdrop-blur-sm ${
                        originalData?.gstNo !== formData.gstNo
                          ? "border-amber-300 focus:ring-amber-100 focus:border-amber-500"
                          : "border-gray-200 focus:ring-purple-100 focus:border-purple-500"
                      }`}
                      placeholder="Enter GST number"
                    />
                  </div>

                  {/* Expiry Date */}
                  <div className="group">
                    <label className=" text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-1 h-5 bg-linear-to-b from-yellow-500 to-orange-500 rounded-full"></span>
                      Expiry Date
                      {originalData?.expiry !== formData.expiry && (
                        <span className="ml-auto text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                          Modified
                        </span>
                      )}
                    </label>
                    <input
                      type="date"
                      name="expiry"
                      value={formData.expiry}
                      onChange={handleChange}
                      className={`w-full px-5 py-4 border-2 rounded-xl focus:ring-4 transition-all duration-300 outline-none bg-white/50 backdrop-blur-sm ${
                        originalData?.expiry !== formData.expiry
                          ? "border-amber-300 focus:ring-amber-100 focus:border-amber-500"
                          : "border-gray-200 focus:ring-yellow-100 focus:border-yellow-500"
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Warning Box */}
              <div className="relative overflow-hidden bg-linear-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6 animate-slideUp">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200 rounded-full blur-3xl opacity-30 -mr-16 -mt-16"></div>
                <div className="relative flex items-start gap-4">
                  <div>
                    <p className="text-base font-bold text-amber-900 mb-2">
                      ⚠️ Important Information
                    </p>
                    <p className="text-sm text-amber-800 leading-relaxed">
                      This will only update{" "}
                      <span className="font-semibold">product information</span>
                      . Stock quantities and purchase/sale amounts are managed
                      through the
                      <span className="font-semibold">
                        {" "}
                        Transaction Management system
                      </span>{" "}
                      and cannot be edited here. All changes will be tracked in
                      the audit log with your user information.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6">
                <button
                  type="submit"
                  disabled={loading || changedFieldsCount === 0}
                  className="flex-1 group relative px-8 py-4 bg-linear-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-xl font-semibold text-lg shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none overflow-hidden"
                >
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    {loading ? (
                      <>
                        <svg
                          className="animate-spin h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Updating...
                      </>
                    ) : (
                      <>
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
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Update Stock Item{" "}
                        {changedFieldsCount > 0 && `(${changedFieldsCount})`}
                      </>
                    )}
                  </span>
                  <div className="absolute inset-0 bg-linear-to-r from-pink-600 via-purple-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>

                <button
                  type="button"
                  onClick={() => router.back()}
                  className="flex-1 px-8 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold text-lg hover:bg-gray-200 transform hover:-translate-y-1 transition-all duration-300 shadow-md hover:shadow-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>

          {/* Decorative Elements */}
          <div className="fixed top-20 right-20 w-72 h-72 bg-purple-200 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
          <div className="fixed bottom-20 left-20 w-96 h-96 bg-indigo-200 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
        </main>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bounce-slow {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.6s ease-out;
        }

        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }

        .animation-delay-150 {
          animation-delay: 150ms;
        }
      `}</style>
    </div>
  );
}
