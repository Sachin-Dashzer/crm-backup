// app/(dashboard)/stocks/vendors/edit/[id]/page.jsx
"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Sidebar from "@/components/Sidebars/StockSidebar";
import { useToast } from "@/components/Toast";
import {
  ArrowLeft,
  Save,
  X,
  Loader2,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Package,
  AlertCircle,
  CheckCircle2,
  Menu,
} from "lucide-react";

export default function EditVendorPage() {
  const router = useRouter();
  const params = useParams();
  const vendorId = params.id;
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    if (vendorId) {
      fetchVendor();
    }
  }, [vendorId]);

  const fetchVendor = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/vendors/get?id=${vendorId}`);
      const data = await response.json();

      console.log("API Response:", data); // Debug log

      if (data.success) {
        // Handle both data.data and data.vendor structures
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

    if (!formData.name.trim()) {
      newErrors.name = "Vendor name is required";
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (formData.contact && !/^\d{10}$/.test(formData.contact.replace(/\D/g, ""))) {
      newErrors.contact = "Please enter a valid 10-digit phone number";
    }

    if (formData.gstNumber && formData.gstNumber.length !== 15) {
      newErrors.gstNumber = "GST number must be 15 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const hasChanges = () => {
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    if (!hasChanges()) {
      toast.info("No changes to save");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/vendors/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
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
        toast.success(
          `Vendor updated successfully!${data.updatedFields ? ` ${data.updatedFields} field(s) changed.` : ''}`
        );
        setTimeout(() => {
          router.push("/stocks/vendors");
        }, 1000);
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-16 w-16 text-indigo-500 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading vendor details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full lg:w-auto min-w-0">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-white border-2 border-gray-200 shadow-sm"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-white/50 rounded-xl transition-colors flex items-center gap-2 text-gray-700 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline font-medium">Back to Vendors</span>
            </button>
          </div>

          <div className="text-center mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Edit Vendor
            </h1>
            <p className="text-gray-600">Update vendor information</p>
          </div>
        </div>

        {/* Form Card */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Form Header */}
            <div className="bg-linear-to-r from-indigo-500 to-purple-600 px-6 sm:px-8 py-6">
              <div className="flex items-center gap-3 text-white">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Vendor Information</h2>
                  <p className="text-white/80 text-sm">
                    {hasChanges() ? "Unsaved changes" : "No changes"}
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 sm:p-8">
              <div className="space-y-6">
                {/* Vendor Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Vendor Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-indigo-100 transition-all ${
                        errors.name
                          ? "border-red-300 focus:border-red-500"
                          : "border-gray-200 focus:border-indigo-300"
                      }`}
                      placeholder="Enter vendor name"
                    />
                  </div>
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.name}
                    </p>
                  )}
                </div>

                {/* Contact Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Contact Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="tel"
                      name="contact"
                      value={formData.contact}
                      onChange={handleChange}
                      className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-indigo-100 transition-all ${
                        errors.contact
                          ? "border-red-300 focus:border-red-500"
                          : "border-gray-200 focus:border-indigo-300"
                      }`}
                      placeholder="Enter 10-digit contact number"
                    />
                  </div>
                  {errors.contact && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.contact}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-indigo-100 transition-all ${
                        errors.email
                          ? "border-red-300 focus:border-red-500"
                          : "border-gray-200 focus:border-indigo-300"
                      }`}
                      placeholder="vendor@example.com"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Address
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      rows="3"
                      className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all resize-none"
                      placeholder="Enter complete address"
                    />
                  </div>
                </div>

                {/* GST Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    GST Number
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      name="gstNumber"
                      value={formData.gstNumber}
                      onChange={handleChange}
                      maxLength={15}
                      className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-indigo-100 transition-all uppercase ${
                        errors.gstNumber
                          ? "border-red-300 focus:border-red-500"
                          : "border-gray-200 focus:border-indigo-300"
                      }`}
                      placeholder="e.g., 27AABCU9603R1ZM"
                    />
                  </div>
                  {errors.gstNumber && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.gstNumber}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    GST number must be 15 characters
                  </p>
                </div>

                {/* Deals In */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Deals In (Products/Services)
                  </label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      name="DealsIn"
                      value={formData.DealsIn}
                      onChange={handleChange}
                      className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                      placeholder="e.g., Surgical Equipment, Medicines, Medical Devices"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Specify the category of products or services
                  </p>
                </div>

                {/* Change Indicator */}
                {hasChanges() && (
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-900 text-sm">
                          You have unsaved changes
                        </p>
                        <p className="text-amber-700 text-sm mt-1">
                          Click "Update Vendor" to save your changes or "Cancel" to discard them.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex flex-col sm:flex-row gap-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={saving || !hasChanges()}
                  className="flex-1 px-6 py-3 bg-linear-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Update Vendor
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
              </div>
            </form>
          </div>

          {/* Info Card */}
          <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-900 text-sm">
                  Audit Trail Enabled
                </p>
                <p className="text-blue-700 text-sm mt-1">
                  All changes to this vendor will be tracked with your name, email, and timestamp for complete audit history.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}