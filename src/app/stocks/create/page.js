"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft } from "lucide-react";
import Sidebar from "@/components/Sidebars/StockSidebar";

export default function CreateStockPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    mrp: "",
    gstNo: "",
    weight: "",
    unit: "",
    expiry: "",
    purchaseAmt: "",
    soldAmt: "",
  });

  const isAdmin = session?.user?.role === "admin";
  const userBranch = session?.user?.branch;
  const branchRestricted = !isAdmin && userBranch;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          location: formData.location || undefined,
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

  const inputClass =
    "w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <section className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
        {/* Page header */}
        <div className="max-w-3xl mx-auto mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Add Stock Item</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create a new inventory item. Purchases managed via transactions.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-3xl mx-auto">
          {/* Card header */}
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">
              Product Details
            </h2>
          </div>

          {/* Card body */}
          <form onSubmit={handleSubmit}>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Product Name */}
                <div>
                  <label className={labelClass}>
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className={inputClass}
                    placeholder="Enter product name"
                  />
                </div>

                {/* Branch / Location */}
                <div>
                  <label className={labelClass}>Branch / Location</label>
                  {branchRestricted ? (
                    <div className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg">
                      {userBranch}
                    </div>
                  ) : (
                    <select
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      className={inputClass}
                    >
                      <option value="">Select branch</option>
                      <option value="Delhi">Delhi</option>
                      <option value="Mumbai">Mumbai</option>
                      <option value="Hyderabad">Hyderabad</option>
                    </select>
                  )}
                </div>

                {/* MRP */}
                <div>
                  <label className={labelClass}>
                    MRP (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="mrp"
                    value={formData.mrp}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    className={inputClass}
                    placeholder="0.00"
                  />
                </div>

                {/* Purchase Amount */}
                <div>
                  <label className={labelClass}>
                    Purchase Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="purchaseAmt"
                    value={formData.purchaseAmt}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    className={inputClass}
                    placeholder="0.00"
                  />
                </div>

                {/* Sell Price */}
                <div>
                  <label className={labelClass}>
                    Sell Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="soldAmt"
                    value={formData.soldAmt}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    className={inputClass}
                    placeholder="0.00"
                  />
                </div>

                {/* Weight */}
                <div>
                  <label className={labelClass}>Weight</label>
                  <input
                    type="number"
                    name="weight"
                    value={formData.weight}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className={inputClass}
                    placeholder="Enter weight"
                  />
                </div>

                {/* Unit */}
                <div>
                  <label className={labelClass}>Unit</label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    className={inputClass}
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
                <div>
                  <label className={labelClass}>GST Number</label>
                  <input
                    type="text"
                    name="gstNo"
                    value={formData.gstNo}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Enter GST number"
                  />
                </div>

                {/* Expiry Date */}
                <div>
                  <label className={labelClass}>Expiry Date</label>
                  <input
                    type="date"
                    name="expiry"
                    value={formData.expiry}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Card footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
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
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Creating...
                  </>
                ) : (
                  "Create Stock Item"
                )}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-5 py-2.5 bg-white text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </main>
    </section>
  );
}
