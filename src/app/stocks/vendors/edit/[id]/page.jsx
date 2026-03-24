"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Store } from "lucide-react";
import Sidebar from "@/components/Sidebars/StockSidebar";
import { useToast } from "@/components/Toast";

export default function EditVendorPage() {
  const router = useRouter();
  const params = useParams();
  const vendorId = params.id;
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    email: "",
    address: "",
    gstNumber: "",
    DealsIn: "",
  });
  const [originalData, setOriginalData] = useState({});

  useEffect(() => {
    if (vendorId) fetchVendor();
  }, [vendorId]);

  const fetchVendor = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/vendors/get?id=${vendorId}`);
      const data = await response.json();
      if (data.success) {
        const vendor = data.data || data.vendor || data;
        if (!vendor || !vendor.name) {
          toast.error("Vendor data is incomplete");
          router.push("/stocks/vendors");
          return;
        }
        const vendorData = {
          name: vendor.name || "",
          contact: vendor.contact?.toString() || "",
          email: vendor.email || "",
          address: vendor.address || "",
          gstNumber: vendor.gstNumber || "",
          DealsIn: vendor.DealsIn || "",
        };
        setFormData(vendorData);
        setOriginalData(vendorData);
      } else {
        toast.error(data.message || "Failed to fetch vendor details");
        router.push("/stocks/vendors");
      }
    } catch (error) {
      console.error("Error fetching vendor:", error);
      toast.error("Failed to fetch vendor details");
      router.push("/stocks/vendors");
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Vendor name is required";
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Please enter a valid email address";
    if (
      formData.contact &&
      !/^\d{10}$/.test(formData.contact.replace(/\D/g, ""))
    )
      newErrors.contact = "Please enter a valid 10-digit phone number";
    if (formData.gstNumber && formData.gstNumber.length !== 15)
      newErrors.gstNumber = "GST number must be 15 characters";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const hasChanges = () =>
    JSON.stringify(formData) !== JSON.stringify(originalData);

  const isFieldModified = (fieldName) =>
    formData[fieldName] !== originalData[fieldName];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!hasChanges()) {
      toast.info("No changes to save");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/vendors/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: vendorId,
          name: formData.name,
          contact: formData.contact || undefined,
          email: formData.email || undefined,
          address: formData.address || undefined,
          gstNumber: formData.gstNumber || undefined,
          DealsIn: formData.DealsIn || undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Vendor updated successfully!");
        setTimeout(() => router.push("/stocks/vendors"), 1000);
      } else {
        toast.error(data.message || "Failed to update vendor");
      }
    } catch (error) {
      console.error("Error updating vendor:", error);
      toast.error("An error occurred while updating the vendor");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges()) {
      if (confirm("You have unsaved changes. Are you sure you want to leave?")) {
        router.push("/stocks/vendors");
      }
    } else {
      router.push("/stocks/vendors");
    }
  };

  const baseInput =
    "w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 bg-white transition-colors";
  const normalInput = `${baseInput} border-gray-200 focus:ring-emerald-300 focus:border-emerald-400`;
  const modifiedInput = `${baseInput} border-amber-300 focus:ring-amber-200 focus:border-amber-400`;
  const errorInput = `${baseInput} border-red-400 focus:ring-red-200 focus:border-red-400`;

  const getInputClass = (fieldName) => {
    if (errors[fieldName]) return errorInput;
    if (isFieldModified(fieldName)) return modifiedInput;
    return normalInput;
  };

  const labelClass =
    "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fc]">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-9 h-9 border-2 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mx-auto" />
            <p className="mt-3 text-sm text-gray-500">
              Loading vendor details...
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-h-screen">
        {/* Sticky Header */}
        <header className="bg-white border-b border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-6 py-4 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto flex items-center gap-4">
            <button
              type="button"
              onClick={handleCancel}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm shrink-0">
                <Store className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-gray-900 leading-tight">
                    Edit Vendor
                  </h1>
                  {hasChanges() && (
                    <span className="inline-flex items-center text-xs px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-medium">
                      Unsaved changes
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 leading-tight">
                  Update supplier information
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 py-6 lg:px-8">
          {/* Form Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden max-w-3xl mx-auto mt-6">
            {/* Section Header */}
            <div className="px-6 py-5 border-b border-gray-50">
              <div className="border-l-4 border-emerald-500 pl-4">
                <h2 className="text-sm font-bold text-gray-900">
                  Vendor Information
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Update the fields below — modified fields are highlighted in
                  amber
                </p>
              </div>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Vendor Name */}
                  <div>
                    <label className={labelClass}>
                      Vendor Name{" "}
                      <span className="text-red-500 normal-case">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className={getInputClass("name")}
                      placeholder="Enter vendor name"
                    />
                    {errors.name && (
                      <p className="mt-1.5 text-xs text-red-500">
                        {errors.name}
                      </p>
                    )}
                  </div>

                  {/* Contact Number */}
                  <div>
                    <label className={labelClass}>Contact Number</label>
                    <input
                      type="tel"
                      name="contact"
                      value={formData.contact}
                      onChange={handleChange}
                      className={getInputClass("contact")}
                      placeholder="Enter 10-digit contact number"
                    />
                    {errors.contact && (
                      <p className="mt-1.5 text-xs text-red-500">
                        {errors.contact}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className={labelClass}>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={getInputClass("email")}
                      placeholder="vendor@example.com"
                    />
                    {errors.email && (
                      <p className="mt-1.5 text-xs text-red-500">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  {/* GST Number */}
                  <div>
                    <label className={labelClass}>GST Number</label>
                    <input
                      type="text"
                      name="gstNumber"
                      value={formData.gstNumber}
                      onChange={handleChange}
                      maxLength={15}
                      className={`${getInputClass("gstNumber")} uppercase`}
                      placeholder="e.g., 27AABCU9603R1ZM"
                    />
                    {errors.gstNumber && (
                      <p className="mt-1.5 text-xs text-red-500">
                        {errors.gstNumber}
                      </p>
                    )}
                  </div>

                  {/* Deals In */}
                  <div>
                    <label className={labelClass}>Deals In</label>
                    <input
                      type="text"
                      name="DealsIn"
                      value={formData.DealsIn}
                      onChange={handleChange}
                      className={getInputClass("DealsIn")}
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
                      className={getInputClass("address")}
                      placeholder="Enter full address"
                    />
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-6 py-4 border-t border-gray-50 bg-gray-50/40 flex gap-3">
                <button
                  type="submit"
                  disabled={saving || !hasChanges()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors shadow-sm"
                >
                  {saving ? (
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
                      Saving...
                    </>
                  ) : (
                    <>
                      <Store className="w-4 h-4" />
                      Update Vendor
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-5 py-2.5 bg-white text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
