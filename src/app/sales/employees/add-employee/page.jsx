"use client";

import { useState } from "react";
import SalesSidebar from "@/components/Sidebars/SalesSidebar";
import { useToast } from "@/components/Toast";
import InputField from "@/components/InputField";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  CheckCircle,
  User,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

const roleDescriptions = {
  Agent: {
    description: "Responsible for patient referrals, telecalling, and initial consultation bookings",
    responsibilities: ["Generate patient leads and referrals", "Initial patient contact and coordination", "Maintain referral relationships"],
    color: "blue",
  },
  Counsellor: {
    description: "Provides in-depth patient consultation and treatment planning",
    responsibilities: ["Conduct patient consultations", "Develop treatment plans", "Provide pre and post-surgery guidance"],
    color: "green",
  },
  Doctor: {
    description: "Performs surgical procedures and clinical oversight",
    responsibilities: ["Perform hair transplant surgeries", "Medical evaluations and clearances", "Post-operative care and follow-ups"],
    color: "indigo",
  },
  Technician: {
    description: "Assists in surgical procedures and technical clinic operations",
    responsibilities: ["Assist during surgical procedures", "Prepare surgical equipment", "Support the surgical team"],
    color: "orange",
  },
  Implanter: {
    description: "Specializes in graft implantation during hair restoration procedures",
    responsibilities: ["Perform graft implantation", "Ensure precise placement", "Monitor graft quality"],
    color: "purple",
  },
  Others: {
    description: "Supports clinic operations in various administrative capacities",
    responsibilities: ["General clinic support", "Administrative assistance", "Patient care coordination"],
    color: "slate",
  },
};

const roleOptions = [
  { value: "Agent", label: "Agent / Telecaller" },
  { value: "Counsellor", label: "Counsellor" },
  { value: "Doctor", label: "Doctor" },
  { value: "Technician", label: "Technician" },
  { value: "Implanter", label: "Implanter" },
  { value: "Others", label: "Others" },
];

function RoleDescriptionCard({ role }) {
  if (!role || !roleDescriptions[role]) return null;
  const info = roleDescriptions[role];
  return (
    <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={18} />
        <div>
          <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-1">Role: {role}</h4>
          <p className="text-xs text-blue-800 mb-2">{info.description}</p>
          <p className="text-[11px] font-semibold text-blue-900 mb-1">Key Responsibilities:</p>
          <ul className="space-y-0.5">
            {info.responsibilities.map((r, i) => (
              <li key={i} className="text-[11px] text-blue-700">· {r}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function SalesAddEmployee() {
  const router = useRouter();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    role: "",
    isactive: true,
  });

  const createChangeHandler = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    if (!formData.name.trim()) {
      toast.error("Employee name is required");
      return false;
    }
    if (!formData.role) {
      toast.error("Employee role is required");
      return false;
    }
    if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast.error("Invalid email address");
      return false;
    }
    if (formData.phone && !formData.phone.match(/^[0-9]{10}$/)) {
      toast.error("Phone must be 10 digits");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/employees/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create employee");
      }
      toast.success("Employee registered successfully!");
      setTimeout(() => router.push("/sales/employees"), 1200);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-800 antialiased">
      <SalesSidebar />

      <main className="flex-1 min-h-screen overflow-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Top navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push("/sales/employees")}
              className="inline-flex items-center gap-2 text-[12px] font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Employees
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.04)] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-700 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">Register Clinic Employee</h1>
                  <p className="text-xs text-blue-100 mt-0.5">
                    Add a new operational team member to the clinic workforce
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <InputField
                  label="Full Name"
                  required
                  value={formData.name}
                  onChange={createChangeHandler("name")}
                  placeholder="e.g. Rahul Sharma"
                  className="sm:col-span-2"
                />
                <InputField
                  label="Mobile Number"
                  type="tel"
                  value={formData.phone}
                  onChange={createChangeHandler("phone")}
                  placeholder="10-digit mobile number"
                />
                <InputField
                  label="Email Address"
                  type="email"
                  value={formData.email}
                  onChange={createChangeHandler("email")}
                  placeholder="name@ryanmedihub.com"
                />
                <InputField
                  label="Clinic Role"
                  type="select"
                  required
                  value={formData.role}
                  onChange={createChangeHandler("role")}
                  options={roleOptions}
                  className="sm:col-span-2"
                />
                {formData.role && (
                  <div className="sm:col-span-2">
                    <RoleDescriptionCard role={formData.role} />
                  </div>
                )}
                <InputField
                  label="Active Duty Status"
                  type="checkbox"
                  value={formData.isactive}
                  onChange={createChangeHandler("isactive")}
                  className="sm:col-span-2"
                />
              </div>

              {/* Informational callout */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-500 space-y-1">
                <p>• Only operational clinic roles can be assigned by Sales.</p>
                <p>• Sensitive HR and payroll configurations are managed through administrative authority.</p>
              </div>

              {/* Footer buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/sales/employees")}
                  className="px-4 py-2 text-[12px] font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold rounded-xl shadow-xs shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Register Employee
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
