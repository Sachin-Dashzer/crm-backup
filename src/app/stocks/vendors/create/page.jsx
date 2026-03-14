"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Sidebar from "@/components/Sidebars/StockSidebar";

export default function CreateVendorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    email: "",
    address: "",
    gstNumber: "",
    DealsIn: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      alert("Vendor name is required");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/vendors/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          contact: formData.contact ? Number(formData.contact) : undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        alert("Vendor created successfully!");
        router.push("/stocks/vendors");
      } else {
        alert(data.message || "Failed to create vendor");
      }
    } catch (error) {
      console.error("Error creating vendor:", error);
      alert("An error occurred while creating the vendor");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="flex min-h-screen bg-gray-50">
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
          <h1 className="text-2xl font-bold text-gray-900">Add Vendor</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create a new vendor or supplier record.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-3xl mx-auto">
          {/* Card header */}
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">
              Vendor Details
            </h2>
          </div>

          {/* Card body */}
          <form onSubmit={handleSubmit}>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Vendor Name */}
                <div>
                  <label className={labelClass}>
                    Vendor Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className={inputClass}
                    placeholder="Enter vendor name"
                  />
                </div>

                {/* Contact Number */}
                <div>
                  <label className={labelClass}>Contact Number</label>
                  <input
                    type="tel"
                    name="contact"
                    value={formData.contact}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Enter contact number"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="vendor@example.com"
                  />
                </div>

                {/* GST Number */}
                <div>
                  <label className={labelClass}>GST Number</label>
                  <input
                    type="text"
                    name="gstNumber"
                    value={formData.gstNumber}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="e.g., 27AABCU9603R1ZM"
                  />
                </div>

                {/* Deals In */}
                <div>
                  <label className={labelClass}>Deals In</label>
                  <input
                    type="text"
                    name="DealsIn"
                    value={formData.DealsIn}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="e.g., Surgical Equipment, Medicines"
                  />
                </div>

                {/* Address — full width */}
                <div className="md:col-span-2">
                  <label className={labelClass}>Address</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows={3}
                    className={inputClass}
                    placeholder="Enter full address"
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
                {loading ? "Creating..." : "Create Vendor"}
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
    </div>
  );
}
