"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import {
  UserPlus,
  Phone,
  Mail,
  Briefcase,
  CheckCircle,
  User,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
} from "lucide-react";

const InputField = ({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  className = "",
  options = [],
}) => {
  const baseClasses =
    "w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm";

  if (type === "select") {
    return (
      <div className={className}>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <select
          className={baseClasses}
          value={value}
          onChange={onChange}
          required={required}
        >
          <option value="">Select {label}</option>
          {options.map((option, index) => (
            <option key={index} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (type === "checkbox") {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <label className="text-sm font-semibold text-gray-700">
              {label}
            </label>
          </div>
          <button
            type="button"
            onClick={() => onChange({ target: { type: 'checkbox', checked: !value } })}
            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              value ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block w-4 h-4 transform transition-transform duration-200 bg-white rounded-full shadow-lg ${
                value ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {value ? "Employee is currently active" : "Employee is currently inactive"}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        className={baseClasses}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
};

const RoleDescriptionCard = ({ role }) => {
  const roleDescriptions = {
    Agent: {
      description: "Responsible for patient referrals and initial contact",
      responsibilities: [
        "Generate patient leads and referrals",
        "Initial patient contact and coordination",
        "Maintain referral relationships",
      ],
      color: "blue",
    },
    Counsellor: {
      description: "Provides consultation and treatment planning",
      responsibilities: [
        "Conduct patient consultations",
        "Develop treatment plans",
        "Provide pre and post-surgery guidance",
      ],
      color: "green",
    },
    Doctor: {
      description: "Performs surgical procedures and medical oversight",
      responsibilities: [
        "Perform hair transplant surgeries",
        "Medical evaluations and clearances",
        "Post-operative care and follow-ups",
      ],
      color: "red",
    },
    Technician: {
      description: "Assists in surgical procedures and technical tasks",
      responsibilities: [
        "Assist during surgical procedures",
        "Prepare surgical equipment",
        "Support the surgical team",
      ],
      color: "orange",
    },
    Implanter: {
      description: "Specializes in graft implantation during surgery",
      responsibilities: [
        "Perform graft implantation",
        "Ensure precise placement",
        "Monitor graft quality",
      ],
      color: "purple",
    },
    Others: {
      description: "Supports clinic operations in various capacities",
      responsibilities: [
        "General clinic support",
        "Administrative assistance",
        "Patient care coordination",
      ],
      color: "indigo",
    },
  };

  if (!role || !roleDescriptions[role]) return null;

  const roleInfo = roleDescriptions[role];

  return (
    <div className={`bg-${roleInfo.color}-50 border-l-4 border-${roleInfo.color}-500 rounded-lg p-6`}>
      <div className="flex items-start">
        <AlertCircle className={`text-${roleInfo.color}-600 mr-3 flex-shrink-0 mt-1`} size={20} />
        <div>
          <h4 className={`text-sm font-bold text-${roleInfo.color}-900 mb-2`}>
            Role: {role}
          </h4>
          <p className={`text-sm text-${roleInfo.color}-700 mb-3`}>
            {roleInfo.description}
          </p>
          <div className="space-y-1">
            <p className={`text-xs font-semibold text-${roleInfo.color}-800 mb-1`}>
              Key Responsibilities:
            </p>
            {roleInfo.responsibilities.map((resp, index) => (
              <p key={index} className={`text-xs text-${roleInfo.color}-600 ml-4`}>
                • {resp}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function EmployeeRegistration() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    role: "",
    isactive: true,
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const createChangeHandler = (field) => {
    return (e) => {
      const value =
        e.target.type === "checkbox" ? e.target.checked : e.target.value;
      handleChange(field, value);
    };
  };

  const validateForm = () => {
    // Clear previous status
    setSubmitStatus(null);

    if (!formData.name.trim()) {
      setSubmitStatus({
        type: "error",
        message: "Employee name is required",
      });
      return false;
    }

    if (!formData.role) {
      setSubmitStatus({
        type: "error",
        message: "Please select an employee role",
      });
      return false;
    }

    if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setSubmitStatus({
        type: "error",
        message: "Please enter a valid email address",
      });
      return false;
    }

    if (formData.phone && !formData.phone.match(/^[0-9]{10}$/)) {
      setSubmitStatus({
        type: "error",
        message: "Phone number must be exactly 10 digits",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const response = await fetch("/api/employees/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      setSubmitStatus({
        type: "success",
        message: "Employee registered successfully!",
      });

      // Reset form after successful submission
      setTimeout(() => {
        setFormData({
          name: "",
          phone: "",
          email: "",
          role: "",
          isactive: true,
        });
        setSubmitStatus(null);
      }, 2000);
    } catch (error) {
      console.error("Error submitting employee data:", error);
      setSubmitStatus({
        type: "error",
        message: error.message || "Failed to save employee data. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleOptions = [
    { value: "Agent", label: "Agent" },
    { value: "Counsellor", label: "Counsellor" },
    { value: "Doctor", label: "Doctor" },
    { value: "Technician", label: "Technician" },
    { value: "Implanter", label: "Implanter" },
    { value: "Others", label: "Others" },
  ];

  return (
    <section className="flex min-h-screen">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="flex-1 px-4 md:px-12 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold flex items-center space-x-2">
                    <UserPlus size={28} />
                    <span>Employee Registration</span>
                  </h1>
                  <p className="text-blue-100 mt-1">
                    Add a new team member to Ryan Clinic
                  </p>
                </div>
                <div className="text-right hidden md:block">
                  <p className="text-sm text-blue-100">Current Status</p>
                  <p className="font-medium">New Registration</p>
                </div>
              </div>
            </div>

            {/* Status Message */}
            {submitStatus && (
              <div
                className={`px-8 py-4 ${
                  submitStatus.type === "success"
                    ? "bg-green-50 text-green-800 border-l-4 border-green-400"
                    : "bg-red-50 text-red-800 border-l-4 border-red-400"
                }`}
              >
                <div className="flex">
                  <div className="flex-shrink-0">
                    {submitStatus.type === "success" ? "✓" : "⚠"}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium">{submitStatus.message}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-8 py-8">
              <div className="space-y-8">
                {/* Section Header */}
                <div className="text-center mb-8">
                  <User className="mx-auto h-16 w-16 text-blue-500 mb-4" />
                  <h3 className="text-2xl font-bold text-gray-900">Employee Information</h3>
                  <p className="text-gray-600">Fill in the details below to register a new employee</p>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 gap-x-12">
                  <InputField
                    label="Full Name"
                    required
                    value={formData.name}
                    onChange={createChangeHandler("name")}
                    placeholder="Enter employee's full name"
                    className="md:col-span-2"
                  />

                  <InputField
                    label="Phone Number"
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
                    placeholder="employee@example.com"
                  />

                  <InputField
                    label="Role"
                    type="select"
                    required
                    value={formData.role}
                    onChange={createChangeHandler("role")}
                    options={roleOptions}
                    className="md:col-span-2"
                  />

                  {/* Role Description Card */}
                  {formData.role && (
                    <div className="md:col-span-2">
                      <RoleDescriptionCard role={formData.role} />
                    </div>
                  )}

                  <InputField
                    label="Active Status"
                    type="checkbox"
                    value={formData.isactive}
                    onChange={createChangeHandler("isactive")}
                    className="md:col-span-2"
                  />
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertCircle className="text-blue-600 mr-3 flex-shrink-0 mt-0.5" size={20} />
                    <div>
                      <h4 className="text-sm font-semibold text-blue-900 mb-1">
                        Important Information
                      </h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• Fields marked with <span className="text-red-500">*</span> are required</li>
                        <li>• Phone number should be 10 digits without country code</li>
                        <li>• Inactive employees won't appear in patient registration forms</li>
                        <li>• Employee role determines their access and responsibilities</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-6 border-t border-gray-200">
                  <button
                    type="submit"
                    className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin mr-2 h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                        Registering Employee...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2" size={20} />
                        Register Employee
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="px-8 py-4 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-600 text-center">
                All employee data is securely stored and can be managed from the employee dashboard
              </p>
            </div>
          </div>
        </div>
      </main>
    </section>
  );
}