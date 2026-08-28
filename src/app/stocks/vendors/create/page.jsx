"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Store, User, Phone, Mail, MapPin,
  Hash, Tag, CheckCircle2, AlertCircle, Building2,
  Sparkles, Check, X,
} from "lucide-react";
import Sidebar from "@/components/Sidebars/StockSidebar";

const CATEGORY_SUGGESTIONS = [
  "Surgical Equipment", "Medicines", "Hair Care", "Lab Supplies",
  "Consumables", "PPE Kits", "Instruments", "Cosmetics",
];

const AVATAR_COLORS = [
  "from-emerald-500 to-teal-600",
  "from-indigo-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-500",
  "from-cyan-500 to-blue-600",
];

function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function FieldIcon({ children }) {
  return (
    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
      {children}
    </div>
  );
}

function ValidationIcon({ value, validate }) {
  if (!value) return null;
  const valid = validate ? validate(value) : true;
  return (
    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
      {valid
        ? <Check className="w-4 h-4 text-emerald-500" />
        : <X className="w-4 h-4 text-red-400" />}
    </div>
  );
}

export default function CreateVendorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors]   = useState({});
  const [formData, setFormData] = useState({
    name: "", contact: "", email: "",
    address: "", gstNumber: "", DealsIn: "",
  });

  const validators = {
    contact:   v => /^\d{10}$/.test(v.replace(/\D/g, "")),
    email:     v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    gstNumber: v => v.length === 15,
  };

  const avatarColor = getAvatarColor(formData.name);
  const initials = formData.name
    ? formData.name.trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : null;

  const filledCount = Object.values(formData).filter(Boolean).length;
  const totalFields = Object.keys(formData).length;
  const completePct = Math.round((filledCount / totalFields) * 100);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: "" }));
  };

  const handleCategoryChip = (cat) => {
    setFormData(p => ({ ...p, DealsIn: p.DealsIn === cat ? "" : cat }));
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim())        errs.name      = "Vendor name is required";
    if (formData.contact && !validators.contact(formData.contact))
                                      errs.contact   = "Enter a valid 10-digit number";
    if (formData.email && !validators.email(formData.email))
                                      errs.email     = "Enter a valid email address";
    if (formData.gstNumber && formData.gstNumber.length !== 15)
                                      errs.gstNumber = "GST must be exactly 15 characters";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res  = await fetch("/api/vendors/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          contact: formData.contact ? Number(formData.contact) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => router.push("/stocks/vendors"), 1400);
      } else {
        setErrors({ api: data.message || "Failed to create vendor." });
      }
    } catch {
      setErrors({ api: "An unexpected error occurred. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const inputBase = "w-full py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-colors bg-white";
  const inputNormal = `${inputBase} border-gray-200 focus:ring-emerald-300 focus:border-emerald-400`;
  const inputError  = `${inputBase} border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30`;
  const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

  if (success) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fc]">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Vendor Created!</h2>
            <p className="text-sm text-gray-500">Redirecting to vendors list…</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-auto">

        <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <div className="w-px h-5 bg-gray-200" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                  <Store className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-gray-900 leading-tight">Add Vendor</h1>
                  <p className="text-xs text-gray-400">Register a new supplier</p>
                </div>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full">
              <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-linear-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                  style={{ width: `${completePct}%` }} />
              </div>
              <span className="text-xs font-semibold text-gray-600">{completePct}%</span>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6">
          <form onSubmit={handleSubmit}>
            <div className="max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-3 gap-6">

              <div className="xl:col-span-2 space-y-5">

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-sm">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">Vendor Identity</p>
                      <p className="text-xs text-gray-400">Business name and what they supply</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Vendor Name <span className="text-red-400 normal-case">*</span></label>
                      <div className="relative">
                        <FieldIcon><Building2 className="w-4 h-4" /></FieldIcon>
                        <input type="text" name="name" value={formData.name} onChange={handleChange}
                          placeholder="e.g., MedSupply India Pvt. Ltd."
                          className={`${errors.name ? inputError : inputNormal} pl-9 pr-10 text-base font-medium`} />
                        {formData.name && (
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <Check className="w-4 h-4 text-emerald-500" />
                          </div>
                        )}
                      </div>
                      {errors.name && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{errors.name}</p>}
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelCls}>Deals In</label>
                      <div className="relative">
                        <FieldIcon><Tag className="w-4 h-4" /></FieldIcon>
                        <input type="text" name="DealsIn" value={formData.DealsIn} onChange={handleChange}
                          placeholder="e.g., Surgical Equipment, Medicines"
                          className={`${inputNormal} pl-9`} />
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {CATEGORY_SUGGESTIONS.map(cat => (
                          <button key={cat} type="button" onClick={() => handleCategoryChip(cat)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                              formData.DealsIn === cat
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                : "bg-gray-50 text-gray-500 border-gray-200 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50"
                            }`}>
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                      <Phone className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">Contact Information</p>
                      <p className="text-xs text-gray-400">Phone, email and business address</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Phone Number</label>
                      <div className="relative">
                        <FieldIcon><Phone className="w-4 h-4" /></FieldIcon>
                        <input type="tel" name="contact" value={formData.contact} onChange={handleChange}
                          placeholder="10-digit mobile number"
                          className={`${errors.contact ? inputError : inputNormal} pl-9 pr-10`} />
                        <ValidationIcon value={formData.contact} validate={validators.contact} />
                      </div>
                      {errors.contact
                        ? <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{errors.contact}</p>
                        : formData.contact && validators.contact(formData.contact)
                          ? <p className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" />Valid number</p>
                          : null}
                    </div>

                    <div>
                      <label className={labelCls}>Email Address</label>
                      <div className="relative">
                        <FieldIcon><Mail className="w-4 h-4" /></FieldIcon>
                        <input type="email" name="email" value={formData.email} onChange={handleChange}
                          placeholder="vendor@company.com"
                          className={`${errors.email ? inputError : inputNormal} pl-9 pr-10`} />
                        <ValidationIcon value={formData.email} validate={validators.email} />
                      </div>
                      {errors.email
                        ? <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{errors.email}</p>
                        : formData.email && validators.email(formData.email)
                          ? <p className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" />Valid email</p>
                          : null}
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelCls}>Business Address</label>
                      <div className="relative">
                        <div className="absolute top-3 left-3 pointer-events-none text-gray-400">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <textarea name="address" value={formData.address} onChange={handleChange}
                          rows={3} placeholder="Street, City, State, PIN Code"
                          className={`${inputNormal} pl-9 resize-none`} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 shadow-sm">
                      <Hash className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">Tax Information</p>
                      <p className="text-xs text-gray-400">Optional GST details</p>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>GST Number</label>
                    <div className="relative">
                      <FieldIcon><Hash className="w-4 h-4" /></FieldIcon>
                      <input type="text" name="gstNumber" value={formData.gstNumber} onChange={handleChange}
                        maxLength={15} placeholder="27AABCU9603R1ZM"
                        className={`${errors.gstNumber ? inputError : inputNormal} pl-9 pr-10 uppercase tracking-widest`} />
                      <ValidationIcon value={formData.gstNumber} validate={validators.gstNumber} />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      {errors.gstNumber
                        ? <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{errors.gstNumber}</p>
                        : formData.gstNumber && formData.gstNumber.length === 15
                          ? <p className="text-xs text-emerald-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" />Valid GST format</p>
                          : <p className="text-xs text-gray-400">Format: 22AAAAA0000A1Z5</p>}
                      <span className={`text-xs font-mono ${formData.gstNumber.length === 15 ? "text-emerald-600" : "text-gray-400"}`}>
                        {formData.gstNumber.length}/15
                      </span>
                    </div>
                  </div>
                </div>

                {errors.api && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {errors.api}
                  </div>
                )}

                <div className="flex gap-3 pb-6">
                  <button type="submit" disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 transition-all">
                    {loading ? (
                      <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>Creating…</>
                    ) : (
                      <><Store className="w-4 h-4" />Create Vendor</>
                    )}
                  </button>
                  <button type="button" onClick={() => router.back()}
                    className="px-5 py-2.5 bg-white text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>

              <div className="xl:col-span-1">
                <div className="sticky top-24 space-y-4">

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="h-1 bg-linear-to-r from-emerald-500 to-teal-500" />
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Vendor Preview</span>
                      </div>

                      <div className="flex items-center gap-3 mb-5">
                        <div className={`w-14 h-14 rounded-2xl bg-linear-to-br ${avatarColor} flex items-center justify-center text-white font-bold text-xl shadow-md transition-all duration-300`}>
                          {initials || <Store className="w-7 h-7 opacity-60" />}
                        </div>
                        <div>
                          <p className={`font-bold text-base leading-tight transition-colors ${formData.name ? "text-gray-900" : "text-gray-300"}`}>
                            {formData.name || "Vendor Name"}
                          </p>
                          <p className={`text-xs mt-0.5 ${formData.DealsIn ? "text-emerald-600 font-medium" : "text-gray-300"}`}>
                            {formData.DealsIn || "Category not set"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {[
                          { icon: Phone, value: formData.contact, placeholder: "No phone added",   valid: formData.contact ? validators.contact(formData.contact) : null },
                          { icon: Mail,  value: formData.email,   placeholder: "No email added",   valid: formData.email   ? validators.email(formData.email)   : null },
                          { icon: MapPin,value: formData.address, placeholder: "No address added", valid: formData.address ? true : null },
                          { icon: Hash,  value: formData.gstNumber, placeholder: "No GST number", valid: formData.gstNumber ? validators.gstNumber(formData.gstNumber) : null },
                        ].map(({ icon: Icon, value, placeholder, valid }) => (
                          <div key={placeholder} className={`flex items-center gap-2.5 text-xs rounded-lg px-3 py-2 transition-all ${
                            value
                              ? valid === false ? "bg-red-50 border border-red-100"
                              : "bg-gray-50 border border-gray-100"
                              : "opacity-40"
                          }`}>
                            <Icon className={`w-3.5 h-3.5 shrink-0 ${value ? (valid === false ? "text-red-400" : "text-emerald-500") : "text-gray-300"}`} />
                            <span className={`truncate ${value ? "text-gray-700 font-medium" : "text-gray-300"}`}>
                              {value || placeholder}
                            </span>
                            {value && valid === true && <Check className="w-3 h-3 text-emerald-500 shrink-0 ml-auto" />}
                            {value && valid === false && <X className="w-3 h-3 text-red-400 shrink-0 ml-auto" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Profile Completeness</p>
                    <div className="space-y-2">
                      {[
                        { key: "name",      label: "Name",    required: true  },
                        { key: "contact",   label: "Phone",   required: false },
                        { key: "email",     label: "Email",   required: false },
                        { key: "DealsIn",   label: "Category",required: false },
                        { key: "gstNumber", label: "GST No.", required: false },
                        { key: "address",   label: "Address", required: false },
                      ].map(({ key, label, required }) => (
                        <div key={key} className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all shrink-0 ${
                            formData[key]
                              ? (key !== "name" && validators[key] && !validators[key](formData[key]))
                                ? "bg-red-100 border border-red-300"
                                : "bg-emerald-500"
                              : required ? "bg-gray-100 border-2 border-dashed border-gray-300"
                                         : "bg-gray-100 border border-gray-200"
                          }`}>
                            {formData[key] && (key === "name" || !validators[key] || validators[key](formData[key])) && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                            {formData[key] && validators[key] && !validators[key](formData[key]) && (
                              <X className="w-2.5 h-2.5 text-red-500" />
                            )}
                          </div>
                          <span className={`text-xs font-medium flex-1 ${formData[key] ? "text-gray-700" : "text-gray-400"}`}>{label}</span>
                          {required && <span className="text-[10px] text-red-400 font-semibold">Required</span>}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                        <span>Profile completion</span>
                        <span className="font-bold text-gray-700">{completePct}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${
                          completePct === 100 ? "bg-emerald-500"
                          : completePct >= 50  ? "bg-linear-to-r from-emerald-500 to-teal-500"
                          : "bg-linear-to-r from-amber-400 to-orange-400"
                        }`} style={{ width: `${completePct}%` }} />
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
