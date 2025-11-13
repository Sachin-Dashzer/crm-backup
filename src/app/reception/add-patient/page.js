"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ReceptionSidebar from "@/components/ReceptionSidebar";
import {
  Upload,
  X,
  FileText,
  Image,
  Calendar,
  User,
  Heart,
  CreditCard,
  Scissors,
  FileUp,
  CheckCircle,
  UserPlus,
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

  if (type === "textarea") {
    return (
      <div className={className}>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <textarea
          className={`${baseClasses} min-h-[120px] resize-vertical`}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          rows={4}
        />
      </div>
    );
  }

  if (type === "checkbox") {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <input
          type="checkbox"
          className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          checked={value}
          onChange={onChange}
        />
        <label className="text-sm font-medium text-gray-700">
          {placeholder || label}
        </label>
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

const StepHeader = ({ icon: Icon, title, description, color }) => (
  <div className="text-center mb-8">
    <Icon className={`mx-auto h-16 w-16 text-${color}-500 mb-4`} />
    <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </div>
);

const MedicineManager = ({ medicines, onChange, onAdd, onRemove }) => (
  <div className="md:col-span-2">
    <label className="block text-sm font-semibold text-gray-700 mb-3">
      Medicines
    </label>
    {medicines.map((medicine, index) => (
      <div key={index} className="flex items-center space-x-3 mb-3">
        <input
          type="text"
          className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm"
          value={medicine}
          onChange={(e) => onChange(e.target.value, index)}
          placeholder="Medicine name"
        />
        <button
          type="button"
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200"
          onClick={() => onRemove(index)}
        >
          <X size={16} />
        </button>
      </div>
    ))}
    <button
      type="button"
      className="px-6 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors duration-200 font-medium"
      onClick={onAdd}
    >
      + Add Medicine
    </button>
  </div>
);

const BenefitsManager = ({ benefits, onChange, onAdd, onRemove }) => (
  <div className="md:col-span-2">
    <label className="block text-sm font-semibold text-gray-700 mb-3">
      Additional Benefits
    </label>
    {benefits.map((benefit, index) => (
      <div key={index} className="flex items-center space-x-3 mb-3">
        <input
          type="text"
          className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm"
          value={benefit}
          onChange={(e) => onChange(e.target.value, index)}
          placeholder="Benefit description"
        />
        <button
          type="button"
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200"
          onClick={() => onRemove(index)}
        >
          <X size={16} />
        </button>
      </div>
    ))}
    <button
      type="button"
      className="px-6 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200 font-medium"
      onClick={onAdd}
    >
      + Add Benefit
    </button>
  </div>
);

const TransactionManager = ({ transactions, onChange, onAdd, onRemove }) => (
  <div className="md:col-span-2">
    <h4 className="text-lg font-semibold text-gray-700 mb-4">Transactions</h4>
    {transactions.map((transaction, index) => (
      <div key={index} className="bg-gray-50 p-6 rounded-lg mb-4 border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <InputField
            label="Date"
            type="date"
            value={transaction.date ? transaction.date.split("T")[0] : ""}
            onChange={(e) => onChange(index, "date", e.target.value)}
          />
          <InputField
            label="Payment Type"
            type="select"
            value={transaction.paymentType || ""}
            onChange={(e) => onChange(index, "paymentType", e.target.value)}
            options={[
              { value: "Full-payment", label: "Full Payment" },
              { value: "Advance", label: "Advance" },
              { value: "Installment", label: "Installment" },
              { value: "EMI", label: "EMI" },
            ]}
          />
          <InputField
            label="Branch"
            type="select"
            value={transaction.branch || ""}
            onChange={(e) => onChange(index, "branch", e.target.value)}
            options={[
              { value: "Delhi", label: "Delhi" },
              { value: "Mumbai", label: "Mumbai" },
              { value: "Hyderabad", label: "Hyderabad" },
            ]}
          />
          <InputField
            label="Amount"
            type="number"
            value={transaction.amount || ""}
            onChange={(e) => onChange(index, "amount", e.target.value)}
            placeholder="Transaction amount"
          />
        </div>
        <button
          type="button"
          className="mt-3 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200"
          onClick={() => onRemove(index)}
        >
          Remove Transaction
        </button>
      </div>
    ))}
    <button
      type="button"
      className="px-6 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors duration-200 font-medium"
      onClick={onAdd}
    >
      + Add Transaction
    </button>
  </div>
);

const DocumentUpload = ({
  title,
  icon: Icon,
  color,
  files,
  onUpload,
  onRemove,
  accept,
  uploadId,
  isUploading,
}) => (
  <div className="bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300">
    <div className="text-center">
      <Icon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
      <h4 className="text-lg font-semibold text-gray-900 mb-2">{title}</h4>
      <input
        type="file"
        multiple
        accept={accept}
        onChange={(e) => onUpload(e.target.files)}
        className="hidden"
        id={uploadId}
        disabled={isUploading}
      />
      <label
        htmlFor={uploadId}
        className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white ${
          isUploading
            ? "bg-gray-400 cursor-not-allowed"
            : `bg-${color}-600 hover:bg-${color}-700 cursor-pointer`
        } transition-colors duration-200`}
      >
        <Upload className="mr-2" size={20} />
        {isUploading ? "Uploading..." : "Choose Files"}
      </label>
      {files.length > 0 && (
        <div className="mt-4">
          <h5 className="text-sm font-medium text-gray-700 mb-2">
            Uploaded Files ({files.length}):
          </h5>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map((filePath, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-white px-4 py-3 rounded-md border"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <Icon size={16} className={`text-${color}-500 flex-shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-gray-700 block truncate">
                      {filePath.split("/").pop()}
                    </span>
                    <p className="text-xs text-gray-500 truncate">
                      Path: {filePath}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="text-red-500 hover:text-red-700 p-1 ml-2 flex-shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

export default function PatientRegistration() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState({});
  const router = useRouter();

  const [employees, setEmployees] = useState({
    Agent: [],
    Counsellor: [],
    Doctor: [],
    Technician: [],
    Implanter: [],
    Others: [],
  });

  const [formData, setFormData] = useState({
    personal: {
      name: "",
      phone: "",
      email: "",
      age: "",
      gender: "",
      branch: "",
      address: "",
      profession: "",
      visitDate: "",
      reference: "",
      packageQuoted: "",
      techniqueQuoted: "",
      remarks: "",
    },
    medical: {
      allergies: "",
      medicalHistory: "",
      bloodGroup: "",
      sugar: "",
      bp: "",
      pulse: "",
      weight: "",
      hiv: "",
      hcv: "",
    },
    counselling: {
      counsellor: "",
      techniqueSuggested: "",
      finlpackage: "",
      graftsSuggested: "",
      readyForSurgery: false,
      notes: "",
      additionalbenefits: [],
      medicines: [],
      hairlossType: "",
      areaofConcern: "",
      hairlossreason: "",
      hairlossduration: "",
    },
    surgery: {
      surgeryDate: "",
      location: "",
      OT: "",
      technique: "",
      graftsneed: "",
      graftsImplanted: "",
      donorCondition: "",
      doctor: "",
      seniorTech: "",
      implanterRight: "",
      implanterLeft: "",
      graftingPerson: "",
      helper: "",
    },
    payments: {
      totalAmount: "",
      amountReceived: "",
      pendingAmount: "",
      medicineAmount: "",
      transactions: [],
    },
    documents: {
      images: [],
      consentForm: [],
      suregeryForm: [],
      consultForm: [],
    },
    ops: {
      status: "NEW",
    },
  });

  const stepConfig = [
    { number: 1, title: "Personal Details", icon: User, color: "blue" },
    { number: 2, title: "Counsellor Details", icon: FileText, color: "green" },
    { number: 3, title: "Medical Information", icon: Heart, color: "red" },
    { number: 4, title: "Surgery Details", icon: Scissors, color: "orange" },
    { number: 5, title: "Payment Details", icon: CreditCard, color: "purple" },
    { number: 6, title: "Document Upload", icon: FileUp, color: "indigo" },
  ];

  // Fetch employees on component mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await fetch(
          "http://localhost:3000/api/employees/get-id"
        );
        const result = await response.json();
        if (result.success) {
          setEmployees(result.data);
        }
      } catch (error) {
        console.error("Error fetching employees:", error);
      }
    };
    fetchEmployees();
  }, []);

  const handleChange = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const createChangeHandler = (section, field) => {
    return (e) => {
      const value =
        e.target.type === "checkbox" ? e.target.checked : e.target.value;
      handleChange(section, field, value);
    };
  };

  const handleArrayChange = (section, field, value, index) => {
    const newArray = [...formData[section][field]];
    newArray[index] = value;
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: newArray,
      },
    }));
  };

  const addArrayItem = (section, field) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: [...prev[section][field], ""],
      },
    }));
  };

  const removeArrayItem = (section, field, index) => {
    const newArray = formData[section][field].filter((_, i) => i !== index);
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: newArray,
      },
    }));
  };

  const handleFileUpload = async (section, files) => {
    if (!files || files.length === 0) return;

    setUploadingFiles((prev) => ({ ...prev, [section]: true }));

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formDataUpload = new FormData();
        formDataUpload.append("file", file);
        formDataUpload.append("section", section);
        // For new patients, we'll use a temporary ID that will be replaced on server
        formDataUpload.append("patientId", "temp");

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formDataUpload,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const data = await response.json();
        return data.filePath;
      });

      const uploadedPaths = await Promise.all(uploadPromises);

      setFormData((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          [section]: [...prev.documents[section], ...uploadedPaths],
        },
      }));

      setSubmitStatus({
        type: "success",
        message: `Successfully uploaded ${uploadedPaths.length} file(s)`,
      });

      // Clear success message after 3 seconds
      setTimeout(() => setSubmitStatus(null), 3000);
    } catch (error) {
      console.error("Error uploading files:", error);
      setSubmitStatus({
        type: "error",
        message: "Failed to upload some files. Please try again.",
      });
    } finally {
      setUploadingFiles((prev) => ({ ...prev, [section]: false }));
    }
  };

  const removeFile = async (section, index) => {
    const filePath = formData.documents[section][index];

    try {
      const response = await fetch("/api/upload", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filePath }),
      });

      if (response.ok) {
        setFormData((prev) => ({
          ...prev,
          documents: {
            ...prev.documents,
            [section]: prev.documents[section].filter((_, i) => i !== index),
          },
        }));

        setSubmitStatus({
          type: "success",
          message: "File removed successfully",
        });

        setTimeout(() => setSubmitStatus(null), 3000);
      } else {
        throw new Error("Failed to delete file");
      }
    } catch (error) {
      console.error("Error removing file:", error);
      setSubmitStatus({
        type: "error",
        message: "Failed to remove file. Please try again.",
      });
    }
  };

  const handleTransactionChange = (index, field, value) => {
    const newTransactions = [...formData.payments.transactions];
    newTransactions[index] = {
      ...newTransactions[index],
      [field]: value,
    };
    handleChange("payments", "transactions", newTransactions);
  };

  const addTransaction = () => {
    handleChange("payments", "transactions", [
      ...formData.payments.transactions,
      {
        date: "",
        paymentType: "",
        branch: "",
        amount: "",
      },
    ]);
  };

  const removeTransaction = (index) => {
    const newTransactions = formData.payments.transactions.filter(
      (_, i) => i !== index
    );
    handleChange("payments", "transactions", newTransactions);
  };

  // Clean empty ObjectId fields before sending to API
  const cleanObjectIdFields = (data) => {
    const cleaned = JSON.parse(JSON.stringify(data)); // Deep clone

    // List of ObjectId reference fields
    const objectIdFields = {
      personal: ["reference"],
      counselling: ["counsellor"],
      surgery: [
        "doctor",
        "seniorTech",
        "implanterRight",
        "implanterLeft",
        "graftingPerson",
        "helper",
      ],
    };

    // Convert empty strings to null for ObjectId fields
    Object.keys(objectIdFields).forEach((section) => {
      if (cleaned[section]) {
        objectIdFields[section].forEach((field) => {
          if (
            cleaned[section][field] === "" ||
            cleaned[section][field] === undefined
          ) {
            cleaned[section][field] = null;
          }
        });
      }
    });

    // Also clean empty number fields
    const numberFields = {
      personal: ["age", "packageQuoted"],
      counselling: ["finlpackage", "graftsSuggested"],
      surgery: ["OT", "graftsneed", "graftsImplanted"],
      payments: [
        "totalAmount",
        "amountReceived",
        "pendingAmount",
        "medicineAmount",
      ],
    };

    Object.keys(numberFields).forEach((section) => {
      if (cleaned[section]) {
        numberFields[section].forEach((field) => {
          if (
            cleaned[section][field] === "" ||
            cleaned[section][field] === undefined
          ) {
            cleaned[section][field] = null;
          }
        });
      }
    });

    return cleaned;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      // Clean the form data before sending
      const cleanedData = cleanObjectIdFields(formData);

      const response = await fetch("/api/patients/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cleanedData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      setSubmitStatus({
        type: "success",
        message: "Patient registered successfully!",
      });

      // Reset form after successful submission
      setTimeout(() => {
        setFormData({
          personal: {
            name: "",
            phone: "",
            email: "",
            age: "",
            gender: "",
            branch: "",
            address: "",
            profession: "",
            visitDate: "",
            reference: "",
            packageQuoted: "",
            techniqueQuoted: "",
            remarks: "",
          },
          medical: {
            allergies: "",
            medicalHistory: "",
            bloodGroup: "",
            sugar: "",
            bp: "",
            pulse: "",
            weight: "",
            hiv: "",
            hcv: "",
          },
          counselling: {
            counsellor: "",
            techniqueSuggested: "",
            finlpackage: "",
            graftsSuggested: "",
            readyForSurgery: false,
            notes: "",
            additionalbenefits: [],
            medicines: [],
            hairlossType: "",
            areaofConcern: "",
            hairlossreason: "",
            hairlossduration: "",
          },
          surgery: {
            surgeryDate: "",
            location: "",
            OT: "",
            technique: "",
            graftsneed: "",
            graftsImplanted: "",
            donorCondition: "",
            doctor: "",
            seniorTech: "",
            implanterRight: "",
            implanterLeft: "",
            graftingPerson: "",
            helper: "",
          },
          payments: {
            totalAmount: "",
            amountReceived: "",
            pendingAmount: "",
            medicineAmount: "",
            transactions: [],
          },
          documents: {
            images: [],
            consentForm: [],
            suregeryForm: [],
            consultForm: [],
          },
          ops: {
            status: "NEW",
          },
        });
        setStep(1);
        setSubmitStatus(null);
      }, 2000);
    } catch (error) {
      console.error("Error submitting patient data:", error);
      setSubmitStatus({
        type: "error",
        message: error.message || "Failed to save patient data. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => setStep(Math.min(step + 1, 6));
  const prevStep = () => setStep(Math.max(step - 1, 1));

  return (
    <section className="flex min-h-screen">
      <ReceptionSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="flex-1 px-12 py-4">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center space-x-2">
                  <UserPlus size={28} />
                  <span>Patient Registration</span>
                </h1>
                <p className="text-blue-100 mt-1">
                  Complete all steps to register a new patient
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-100">Current Status</p>
                <p className="font-medium">New Registration</p>
              </div>
            </div>
          </div>

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

          <div className="px-8 py-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div className="flex space-x-2">
                {stepConfig.map((stepInfo) => {
                  const Icon = stepInfo.icon;
                  return (
                    <button
                      key={stepInfo.number}
                      onClick={() => setStep(stepInfo.number)}
                      className={`flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 ${
                        stepInfo.number === step
                          ? `bg-${stepInfo.color}-600 text-white shadow-lg scale-110`
                          : stepInfo.number < step
                          ? "bg-green-500 text-white shadow-md hover:scale-105"
                          : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                      }`}
                    >
                      <Icon size={20} />
                    </button>
                  );
                })}
              </div>
              <div className="text-sm text-gray-600 font-medium">
                Step {step} of {stepConfig.length}: {stepConfig[step - 1].title}
              </div>
            </div>
          </div>

          <div className="px-8 py-8">
            {step === 1 && (
              <div className="space-y-8">
                <StepHeader
                  icon={User}
                  title="Personal Information"
                  description="Let's start with basic details"
                  color="blue"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 gap-x-12">
                  <InputField
                    label="Full Name"
                    required
                    value={formData.personal.name}
                    onChange={createChangeHandler("personal", "name")}
                    placeholder="Enter full name"
                  />

                  <InputField
                    label="Phone Number"
                    type="tel"
                    required
                    value={formData.personal.phone}
                    onChange={createChangeHandler("personal", "phone")}
                    placeholder="Enter phone number"
                  />

                  <InputField
                    label="Email Address"
                    type="email"
                    value={formData.personal.email}
                    onChange={createChangeHandler("personal", "email")}
                    placeholder="Enter email address"
                  />

                  <InputField
                    label="Age"
                    type="number"
                    value={formData.personal.age}
                    onChange={createChangeHandler("personal", "age")}
                    placeholder="Enter age"
                  />

                  <InputField
                    label="Gender"
                    type="select"
                    value={formData.personal.gender}
                    onChange={createChangeHandler("personal", "gender")}
                    options={[
                      { value: "MALE", label: "Male" },
                      { value: "FEMALE", label: "Female" },
                      { value: "OTHERS", label: "Others" },
                    ]}
                  />

                  <InputField
                    label="Branch"
                    type="select"
                    value={formData.personal.branch}
                    onChange={createChangeHandler("personal", "branch")}
                    options={[
                      { value: "Delhi", label: "Delhi" },
                      { value: "Mumbai", label: "Mumbai" },
                      { value: "Hyderabad", label: "Hyderabad" },
                    ]}
                  />

                  <InputField
                    label="Profession"
                    type="text"
                    value={formData.personal.profession}
                    onChange={createChangeHandler("personal", "profession")}
                    placeholder="Enter profession"
                  />

                  <InputField
                    label="Visit Date"
                    type="date"
                    value={formData.personal.visitDate}
                    onChange={createChangeHandler("personal", "visitDate")}
                  />

                  <InputField
                    label="Reference Source (Agent)"
                    type="select"
                    value={formData.personal.reference}
                    onChange={createChangeHandler("personal", "reference")}
                    options={employees.Agent.map((emp) => ({
                      value: emp._id,
                      label: emp.name,
                    }))}
                  />

                  <InputField
                    label="Package Quoted (₹)"
                    type="number"
                    value={formData.personal.packageQuoted}
                    onChange={createChangeHandler("personal", "packageQuoted")}
                    placeholder="Package amount"
                  />

                  <InputField
                    label="Technique Quoted"
                    type="select"
                    value={formData.personal.techniqueQuoted}
                    onChange={createChangeHandler(
                      "personal",
                      "techniqueQuoted"
                    )}
                    options={[
                      { value: "FUE", label: "FUE" },
                      { value: "INDIAN DHI", label: "Indian DHI" },
                      { value: "DHI", label: "DHI" },
                      { value: "HYBRID", label: "HYBRID" },
                      { value: "PRP", label: "PRP" },
                      { value: "GFC", label: "GFC" },
                      { value: "Other", label: "Other" },
                    ]}
                  />

                  <InputField
                    label="Address"
                    type="textarea"
                    value={formData.personal.address}
                    onChange={createChangeHandler("personal", "address")}
                    placeholder="Complete address"
                    className="md:col-span-2"
                  />

                  <InputField
                    label="Remarks"
                    type="textarea"
                    value={formData.personal.remarks}
                    onChange={createChangeHandler("personal", "remarks")}
                    placeholder="Additional remarks"
                    className="md:col-span-2"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8">
                <StepHeader
                  icon={FileText}
                  title="Counselling Details"
                  description="Professional consultation information"
                  color="green"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 gap-x-12">
                  <InputField
                    label="Counsellor"
                    type="select"
                    value={formData.counselling.counsellor}
                    onChange={createChangeHandler("counselling", "counsellor")}
                    options={employees.Counsellor.map((emp) => ({
                      value: emp._id,
                      label: emp.name,
                    }))}
                  />

                  <InputField
                    label="Technique Suggested"
                    type="select"
                    value={formData.counselling.techniqueSuggested}
                    onChange={createChangeHandler(
                      "counselling",
                      "techniqueSuggested"
                    )}
                    options={[
                      { value: "FUE", label: "FUE" },
                      { value: "INDIAN DHI", label: "INDIAN DHI" },
                      { value: "DHI", label: "DHI" },
                      { value: "HYBRID", label: "HYBRID" },
                      { value: "PRP", label: "PRP" },
                      { value: "GFC", label: "GFC" },
                      { value: "Other", label: "Other" },
                    ]}
                  />

                  <InputField
                    label="Final Package Amount (₹)"
                    type="number"
                    value={formData.counselling.finlpackage}
                    onChange={createChangeHandler("counselling", "finlpackage")}
                    placeholder="Final package amount"
                  />

                  <InputField
                    label="Grafts Suggested"
                    type="number"
                    value={formData.counselling.graftsSuggested}
                    onChange={createChangeHandler(
                      "counselling",
                      "graftsSuggested"
                    )}
                    placeholder="Number of grafts"
                  />

                  <InputField
                    label="Hair Loss Type"
                    type="text"
                    value={formData.counselling.hairlossType}
                    onChange={createChangeHandler(
                      "counselling",
                      "hairlossType"
                    )}
                    placeholder="Type of hair loss"
                  />

                  <InputField
                    label="Area of Concern"
                    type="text"
                    value={formData.counselling.areaofConcern}
                    onChange={createChangeHandler(
                      "counselling",
                      "areaofConcern"
                    )}
                    placeholder="Area of concern"
                  />

                  <InputField
                    label="Hair Loss Reason"
                    type="text"
                    value={formData.counselling.hairlossreason}
                    onChange={createChangeHandler(
                      "counselling",
                      "hairlossreason"
                    )}
                    placeholder="Reason for hair loss"
                  />

                  <InputField
                    label="Hair Loss Duration"
                    type="text"
                    value={formData.counselling.hairlossduration}
                    onChange={createChangeHandler(
                      "counselling",
                      "hairlossduration"
                    )}
                    placeholder="Duration of hair loss"
                  />

                  <div className="md:col-span-2">
                    <InputField
                      label="Ready for Surgery"
                      type="checkbox"
                      value={formData.counselling.readyForSurgery}
                      onChange={createChangeHandler(
                        "counselling",
                        "readyForSurgery"
                      )}
                      placeholder="Patient is ready for surgery"
                    />
                  </div>

                  <InputField
                    label="Notes"
                    type="textarea"
                    value={formData.counselling.notes}
                    onChange={createChangeHandler("counselling", "notes")}
                    placeholder="Additional counselling notes"
                    className="md:col-span-2"
                  />

                  <BenefitsManager
                    benefits={formData.counselling.additionalbenefits}
                    onChange={(value, index) =>
                      handleArrayChange(
                        "counselling",
                        "additionalbenefits",
                        value,
                        index
                      )
                    }
                    onAdd={() =>
                      addArrayItem("counselling", "additionalbenefits")
                    }
                    onRemove={(index) =>
                      removeArrayItem("counselling", "additionalbenefits", index)
                    }
                  />

                  <MedicineManager
                    medicines={formData.counselling.medicines}
                    onChange={(value, index) =>
                      handleArrayChange(
                        "counselling",
                        "medicines",
                        value,
                        index
                      )
                    }
                    onAdd={() => addArrayItem("counselling", "medicines")}
                    onRemove={(index) =>
                      removeArrayItem("counselling", "medicines", index)
                    }
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-8">
                <StepHeader
                  icon={Heart}
                  title="Medical Information"
                  description="Health history and vital signs"
                  color="red"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 gap-x-12">
                  <InputField
                    label="Allergies"
                    type="textarea"
                    value={formData.medical.allergies}
                    onChange={createChangeHandler("medical", "allergies")}
                    placeholder="List any known allergies"
                    className="md:col-span-2"
                  />

                  <InputField
                    label="Medical History"
                    type="select"
                    value={formData.medical.medicalHistory}
                    onChange={createChangeHandler("medical", "medicalHistory")}
                    options={[
                      { value: "YES", label: "Yes" },
                      { value: "NO", label: "No" },
                      { value: "UNKNOWN", label: "Unknown" },
                    ]}
                  />

                  <InputField
                    label="Blood Group"
                    type="select"
                    value={formData.medical.bloodGroup}
                    onChange={createChangeHandler("medical", "bloodGroup")}
                    options={[
                      { value: "A+", label: "A+" },
                      { value: "A-", label: "A-" },
                      { value: "B+", label: "B+" },
                      { value: "B-", label: "B-" },
                      { value: "AB+", label: "AB+" },
                      { value: "AB-", label: "AB-" },
                      { value: "O+", label: "O+" },
                      { value: "O-", label: "O-" },
                    ]}
                  />

                  <InputField
                    label="Sugar Level"
                    type="text"
                    value={formData.medical.sugar}
                    onChange={createChangeHandler("medical", "sugar")}
                    placeholder="Sugar level"
                  />

                  <InputField
                    label="Blood Pressure"
                    type="text"
                    value={formData.medical.bp}
                    onChange={createChangeHandler("medical", "bp")}
                    placeholder="Blood pressure reading"
                  />

                  <InputField
                    label="Pulse Rate"
                    type="text"
                    value={formData.medical.pulse}
                    onChange={createChangeHandler("medical", "pulse")}
                    placeholder="Pulse rate"
                  />

                  <InputField
                    label="Weight"
                    type="text"
                    value={formData.medical.weight}
                    onChange={createChangeHandler("medical", "weight")}
                    placeholder="Weight"
                  />

                  <InputField
                    label="HIV Status"
                    type="text"
                    value={formData.medical.hiv}
                    onChange={createChangeHandler("medical", "hiv")}
                    placeholder="HIV status"
                  />

                  <InputField
                    label="HCV Status"
                    type="text"
                    value={formData.medical.hcv}
                    onChange={createChangeHandler("medical", "hcv")}
                    placeholder="HCV status"
                  />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-8">
                <StepHeader
                  icon={Scissors}
                  title="Surgery Details"
                  description="Surgical procedure information"
                  color="orange"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 gap-x-12">
                  <InputField
                    label="Surgery Date"
                    type="date"
                    value={formData.surgery.surgeryDate}
                    onChange={createChangeHandler("surgery", "surgeryDate")}
                  />

                  <InputField
                    label="Surgery Location"
                    type="text"
                    value={formData.surgery.location}
                    onChange={createChangeHandler("surgery", "location")}
                    placeholder="Surgery location"
                  />

                  <InputField
                    label="Operation Theatre (OT) Number"
                    type="number"
                    value={formData.surgery.OT}
                    onChange={createChangeHandler("surgery", "OT")}
                    placeholder="OT number"
                  />

                  <InputField
                    label="Technique Used"
                    type="text"
                    value={formData.surgery.technique}
                    onChange={createChangeHandler("surgery", "technique")}
                    placeholder="Surgical technique"
                  />

                  <InputField
                    label="Grafts Needed"
                    type="number"
                    value={formData.surgery.graftsneed}
                    onChange={createChangeHandler("surgery", "graftsneed")}
                    placeholder="Number of grafts needed"
                  />

                  <InputField
                    label="Grafts Implanted"
                    type="number"
                    value={formData.surgery.graftsImplanted}
                    onChange={createChangeHandler("surgery", "graftsImplanted")}
                    placeholder="Number of grafts implanted"
                  />

                  <InputField
                    label="Donor Area Condition"
                    type="text"
                    value={formData.surgery.donorCondition}
                    onChange={createChangeHandler("surgery", "donorCondition")}
                    placeholder="Donor area condition"
                  />

                  <InputField
                    label="Operating Doctor"
                    type="select"
                    value={formData.surgery.doctor}
                    onChange={createChangeHandler("surgery", "doctor")}
                    options={employees.Doctor.map((emp) => ({
                      value: emp._id,
                      label: emp.name,
                    }))}
                  />

                  <InputField
                    label="Senior Technician"
                    type="select"
                    value={formData.surgery.seniorTech}
                    onChange={createChangeHandler("surgery", "seniorTech")}
                    options={employees.Technician.map((emp) => ({
                      value: emp._id,
                      label: emp.name,
                    }))}
                  />

                  <InputField
                    label="Right Side Implanter"
                    type="select"
                    value={formData.surgery.implanterRight}
                    onChange={createChangeHandler("surgery", "implanterRight")}
                    options={employees.Implanter.map((emp) => ({
                      value: emp._id,
                      label: emp.name,
                    }))}
                  />

                  <InputField
                    label="Left Side Implanter"
                    type="select"
                    value={formData.surgery.implanterLeft}
                    onChange={createChangeHandler("surgery", "implanterLeft")}
                    options={employees.Implanter.map((emp) => ({
                      value: emp._id,
                      label: emp.name,
                    }))}
                  />

                  <InputField
                    label="Grafting Specialist"
                    type="select"
                    value={formData.surgery.graftingPerson}
                    onChange={createChangeHandler("surgery", "graftingPerson")}
                    options={employees.Others.map((emp) => ({
                      value: emp._id,
                      label: emp.name,
                    }))}
                  />

                  <InputField
                    label="Surgery Helper"
                    type="select"
                    value={formData.surgery.helper}
                    onChange={createChangeHandler("surgery", "helper")}
                    options={employees.Others.map((emp) => ({
                      value: emp._id,
                      label: emp.name,
                    }))}
                  />
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-8">
                <StepHeader
                  icon={CreditCard}
                  title="Payment Details"
                  description="Financial information and transactions"
                  color="purple"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 gap-x-12">
                  <InputField
                    label="Total Amount (₹)"
                    type="number"
                    value={formData.payments.totalAmount}
                    onChange={createChangeHandler("payments", "totalAmount")}
                    placeholder="Total amount quoted"
                  />

                  <InputField
                    label="Amount Received (₹)"
                    type="number"
                    value={formData.payments.amountReceived}
                    onChange={createChangeHandler("payments", "amountReceived")}
                    placeholder="Amount received"
                  />

                  <InputField
                    label="Pending Amount (₹)"
                    type="number"
                    value={formData.payments.pendingAmount}
                    onChange={createChangeHandler("payments", "pendingAmount")}
                    placeholder="Pending amount"
                  />

                  <InputField
                    label="Medicine Amount (₹)"
                    type="number"
                    value={formData.payments.medicineAmount}
                    onChange={createChangeHandler("payments", "medicineAmount")}
                    placeholder="Medicine cost"
                  />

                  <TransactionManager
                    transactions={formData.payments.transactions}
                    onChange={handleTransactionChange}
                    onAdd={addTransaction}
                    onRemove={removeTransaction}
                  />
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-8">
                <StepHeader
                  icon={FileUp}
                  title="Document Upload"
                  description="Upload patient images and forms"
                  color="indigo"
                />

                <div className="space-y-8">
                  <DocumentUpload
                    title="Patient Images"
                    icon={Image}
                    color="indigo"
                    files={formData.documents.images}
                    onUpload={(files) => handleFileUpload("images", files)}
                    onRemove={(index) => removeFile("images", index)}
                    accept="image/*"
                    uploadId="images-upload"
                    isUploading={uploadingFiles.images}
                  />

                  <DocumentUpload
                    title="Consent Forms"
                    icon={FileText}
                    color="blue"
                    files={formData.documents.consentForm}
                    onUpload={(files) => handleFileUpload("consentForm", files)}
                    onRemove={(index) => removeFile("consentForm", index)}
                    accept=".pdf,.doc,.docx"
                    uploadId="consent-upload"
                    isUploading={uploadingFiles.consentForm}
                  />

                  <DocumentUpload
                    title="Surgery Forms"
                    icon={FileText}
                    color="green"
                    files={formData.documents.suregeryForm}
                    onUpload={(files) =>
                      handleFileUpload("suregeryForm", files)
                    }
                    onRemove={(index) => removeFile("suregeryForm", index)}
                    accept=".pdf,.doc,.docx"
                    uploadId="surgery-upload"
                    isUploading={uploadingFiles.suregeryForm}
                  />

                  <DocumentUpload
                    title="Consultation Forms"
                    icon={Calendar}
                    color="purple"
                    files={formData.documents.consultForm}
                    onUpload={(files) => handleFileUpload("consultForm", files)}
                    onRemove={(index) => removeFile("consultForm", index)}
                    accept=".pdf,.doc,.docx"
                    uploadId="consult-upload"
                    isUploading={uploadingFiles.consultForm}
                  />
                </div>
              </div>
            )}

            <div className="mt-12 flex justify-between items-center pt-6 border-t border-gray-200">
              {step > 1 ? (
                <button
                  type="button"
                  className="inline-flex items-center px-6 py-3 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200"
                  onClick={prevStep}
                >
                  ← Previous
                </button>
              ) : (
                <div></div>
              )}

              <div className="flex space-x-4">
                {step < 6 && (
                  <button
                    type="button"
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200"
                    onClick={nextStep}
                  >
                    Next →
                  </button>
                )}

                {step === 6 && (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin mr-2 h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2" size={20} />
                        Complete Registration
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </section>
  );
}