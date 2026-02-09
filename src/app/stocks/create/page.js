"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebars/StockSidebar";

export default function CreateStockPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.mrp) {
      alert("Product name and MRP are required");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/stocks/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          mrp: Number(formData.mrp),
          gstNo: formData.gstNo || undefined,
          weight: formData.weight ? Number(formData.weight) : undefined,
          unit: formData.unit || undefined,
          expiry: formData.expiry || undefined,
          purchaseAmt: formData.purchaseAmt || undefined,
          soldAmt: formData.soldAmt || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert("Stock item created successfully!");
        router.push("/stocks/dashboard");
      } else {
        alert(data.message || "Failed to create stock item");
      }
    } catch (error) {
      console.error("Error creating stock:", error);
      alert("An error occurred while creating the stock item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
        {/* Animated Header */}
    <div className="bg-white/80 backdrop-blur-xl mx-auto rounded-3xl shadow-2xl p-10 max-w-5xl border border-white/20">
        <div className="mb-10 animate-fadeIn">
          <div className="flex items-center gap-4 mb-3 ">
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
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-linear-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Add New Stock Item
              </h1>
              <p className="text-gray-600 text-lg">
                Create a new inventory item. Purchases managed via transactions.
              </p>
            </div>
          </div>
        </div>

        {/* Form Card with Glassmorphism Effect */}
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
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all duration-300 outline-none bg-white/50 backdrop-blur-sm"
                      placeholder="Enter product name"
                    />
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                      <svg
                        className="w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* MRP */}
                <div className="group">
                  <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <span className="w-1 h-5 bg-linear-to-b from-green-500 to-emerald-500 rounded-full"></span>
                    MRP (Price) <span className="text-red-500">*</span>
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
                      className="w-full pl-10 pr-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-green-100 focus:border-green-500 transition-all duration-300 outline-none bg-white/50 backdrop-blur-sm"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Purchased Amount */}
                <div className="group">
                  <label className=" text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <span className="w-1 h-5 bg-linear-to-b from-green-500 to-emerald-500 rounded-full"></span>
                    Purchased Amount <span className="text-red-500">*</span>
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
                      className="w-full pl-10 pr-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-green-100 focus:border-green-500 transition-all duration-300 outline-none bg-white/50 backdrop-blur-sm"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Sold Amount */}
                <div className="group">
                  <label className=" text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <span className="w-1 h-5 bg-linear-to-b from-green-500 to-emerald-500 rounded-full"></span>
                    Sold Amount <span className="text-red-500">*</span>
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
                      className="w-full pl-10 pr-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-green-100 focus:border-green-500 transition-all duration-300 outline-none bg-white/50 backdrop-blur-sm"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Weight */}
                <div className="group">
                  <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <span className="w-1 h-5 bg-linear-to-b from-orange-500 to-red-500 rounded-full"></span>
                    Weight
                  </label>
                  <input
                    type="number"
                    name="weight"
                    value={formData.weight}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-orange-100 focus:border-orange-500 transition-all duration-300 outline-none bg-white/50 backdrop-blur-sm"
                    placeholder="Enter weight"
                  />
                </div>

                {/* Unit */}
                <div className="group">
                  <label className=" text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <span className="w-1 h-5 bg-linear-to-b from-blue-500 to-cyan-500 rounded-full"></span>
                    Unit
                  </label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-300 outline-none bg-white/50 backdrop-blur-sm appearance-none cursor-pointer"
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
                  </label>
                  <input
                    type="text"
                    name="gstNo"
                    value={formData.gstNo}
                    onChange={handleChange}
                    className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all duration-300 outline-none bg-white/50 backdrop-blur-sm"
                    placeholder="Enter GST number"
                  />
                </div>

                {/* Expiry Date */}
                <div className="group">
                  <label className=" text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <span className="w-1 h-5 bg-linear-to-b from-yellow-500 to-orange-500 rounded-full"></span>
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    name="expiry"
                    value={formData.expiry}
                    onChange={handleChange}
                    className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-yellow-100 focus:border-yellow-500 transition-all duration-300 outline-none bg-white/50 backdrop-blur-sm"
                  />
                </div>
              </div>
            </div>

            {/* Info Box with Animation */}
            <div className="relative overflow-hidden bg-linear-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6 animate-slideUp">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200 rounded-full blur-3xl opacity-30 -mr-16 -mt-16"></div>
              <div className="relative flex items-start gap-4">
                <div className="shrink-0 p-3 bg-blue-500 rounded-xl shadow-lg">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-bold text-blue-900 mb-2">
                    📦 About Stock Management
                  </p>
                  <p className="text-sm text-blue-800 leading-relaxed">
                    After creating this stock item, you can manage purchases and
                    sales through the
                    <span className="font-semibold">
                      {" "}
                      Transaction Management system
                    </span>
                    . The stock quantity, purchase amount, and sold amount will
                    update automatically based on your transactions.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-2">
              <button
                type="submit"
                disabled={loading}
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
                      Creating...
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
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Create Stock Item
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

        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.6s ease-out;
        }
      `}</style>
    </section>
  );
}
