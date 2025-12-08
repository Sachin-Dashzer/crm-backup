"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  User,
  Heart,
  Scissors,
  DollarSign,
  FileText,
  Upload,
  X,
  Eye,
  Download,
  Image,
  Save,
  ArrowLeft,
} from "lucide-react";

export default function PatientEditDetails() {
  const params = useParams();
  const router = useRouter();
  const patientId = params?.id;

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [formData, setFormData] = useState({
    personal: {
      name: "",
      age: "",
      gender: "",
      phone: "",
      email: "",
      branch: "",
      visitDate: "",
      reference: "",
      packageQuoted: "",
      techniqueQuoted: "",
      remarks: "",
    },
    medical: {
      bloodGroup: "",
      bp: "",
      sugar: "",
      pulse: "",
      weight: "",
      allergies: "",
      medicalHistory: "",
      hiv: false,
      hcv: false,
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
      graftingPerson: [],
      helpers: [],
      surgeryNotes: "",
    },
    payments: {
      totalAmount: "",
      amountReceived: "",
      discount: "",
      medicineAmount: "",
    },
    documents: {
      images: [],
      consentForm: [],
      suregeryForm: [],
      consultForm: [],
    },
  });

  const [employees, setEmployees] = useState({
    doctors: [],
    technicians: [],
    helpers: [],
    references: [],
  });

  const [uploading, setUploading] = useState({
    images: false,
    consentForm: false,
    suregeryForm: false,
    consultForm: false,
  });

  // Fetch patient data
  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const res = await fetch(`/api/admin/patient-data?id=${patientId}`);
        if (!res.ok) throw new Error("Failed to fetch patient");
        const data = await res.json();

        setFormData({
          personal: {
            name: data.personal?.name || "",
            age: data.personal?.age || "",
            gender: data.personal?.gender || "",
            phone: data.personal?.phone || "",
            email: data.personal?.email || "",
            branch: data.personal?.branch || "",
            visitDate: data.personal?.visitDate?.split("T")[0] || "",
            reference: data.personal?.reference?._id || "",
            packageQuoted: data.personal?.packageQuoted || "",
            techniqueQuoted: data.personal?.techniqueQuoted || "",
            remarks: data.personal?.remarks || "",
          },
          medical: {
            bloodGroup: data.medical?.bloodGroup || "",
            bp: data.medical?.bp || "",
            sugar: data.medical?.sugar || "",
            pulse: data.medical?.pulse || "",
            weight: data.medical?.weight || "",
            allergies: data.medical?.allergies || "",
            medicalHistory: data.medical?.medicalHistory || "",
            hiv: data.medical?.hiv || false,
            hcv: data.medical?.hcv || false,
          },
          surgery: {
            surgeryDate: data.surgery?.surgeryDate?.split("T")[0] || "",
            location: data.surgery?.location || "",
            OT: data.surgery?.OT || "",
            technique: data.surgery?.technique || "",
            graftsneed: data.surgery?.graftsneed || "",
            graftsImplanted: data.surgery?.graftsImplanted || "",
            donorCondition: data.surgery?.donorCondition || "",
            doctor: data.surgery?.doctor?._id || "",
            seniorTech: data.surgery?.seniorTech?._id || "",
            implanterRight: data.surgery?.implanterRight?._id || "",
            implanterLeft: data.surgery?.implanterLeft?._id || "",
            graftingPerson:
              data.surgery?.graftingPerson?.map((p) => p._id) || [],
            helpers: data.surgery?.helpers?.map((h) => h._id) || [],
            surgeryNotes: data.surgery?.surgeryNotes || "",
          },
          payments: {
            totalAmount: data.payments?.totalAmount || "",
            amountReceived: data.payments?.amountReceived || "",
            discount: data.payments?.discount || "",
            medicineAmount: data.payments?.medicineAmount || "",
          },
          documents: {
            images: data.documents?.images || [],
            consentForm: data.documents?.consentForm || [],
            suregeryForm: data.documents?.suregeryForm || [],
            consultForm: data.documents?.consultForm || [],
          },
        });
      } catch (error) {
        console.error("Error fetching patient:", error);
        showMessage("error", "Failed to load patient data");
      } finally {
        setLoading(false);
      }
    };

    const fetchEmployees = async () => {
      try {
        const res = await fetch("/api/admin/employees");
        if (res.ok) {
          const data = await res.json();
          setEmployees({
            doctors: data.doctors || [],
            technicians: data.technicians || [],
            helpers: data.helpers || [],
            references: data.references || [],
          });
        }
      } catch (error) {
        console.error("Error fetching employees:", error);
      }
    };

    if (patientId) {
      fetchPatient();
      fetchEmployees();
    }
  }, [patientId]);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  const handleInputChange = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleFileUpload = async (files, section) => {
    if (!files || files.length === 0) return;

    setUploading((prev) => ({ ...prev, [section]: true }));

    try {
      const uploadedUrls = [];

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("section", section);
        formData.append("patientId", patientId);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || "Upload failed");
        }

        const data = await res.json();
        uploadedUrls.push(data.filePath);
      }

      setFormData((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          [section]: [...prev.documents[section], ...uploadedUrls],
        },
      }));

      showMessage("success", "Files uploaded successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      showMessage("error", error.message || "Failed to upload files");
    } finally {
      setUploading((prev) => ({ ...prev, [section]: false }));
    }
  };

  const handleRemoveFile = async (section, index) => {
    if (!window.confirm("Are you sure you want to remove this file?")) return;

    try {
      const fileUrl = formData.documents[section][index];
      const publicId = extractPublicId(fileUrl);
      const resourceType = fileUrl.toLowerCase().endsWith(".pdf")
        ? "raw"
        : "image";

      const res = await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId, resourceType }),
      });

      if (!res.ok) {
        console.warn("Failed to delete from Cloudinary");
      }

      setFormData((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          [section]: prev.documents[section].filter((_, i) => i !== index),
        },
      }));

      showMessage("success", "File removed successfully!");
    } catch (error) {
      console.error("Remove error:", error);
      showMessage("error", "Failed to remove file");
    }
  };

  const extractPublicId = (url) => {
    if (!url || !url.includes("cloudinary.com")) return "";
    const parts = url.split("/upload/");
    if (parts.length !== 2) return "";
    const pathPart = parts[1];
    const segments = pathPart.split("/");
    let publicIdParts = [];
    let foundPath = false;
    for (const segment of segments) {
      if (!foundPath && /^[a-z]+_/.test(segment)) continue;
      foundPath = true;
      publicIdParts.push(segment);
    }
    const publicId = publicIdParts.join("/");
    return publicId.replace(/\.[^/.]+$/, "");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/patient-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: patientId, ...formData }),
      });

      if (!res.ok) throw new Error("Failed to save patient");

      showMessage("success", "Patient updated successfully!");
      setTimeout(() => router.push("/reception/patients"), 1500);
    } catch (error) {
      console.error("Save error:", error);
      showMessage("error", "Failed to save patient");
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { id: 1, name: "Personal", icon: User },
    { id: 2, name: "Medical", icon: Heart },
    { id: 3, name: "Surgery", icon: Scissors },
    { id: 4, name: "Payment", icon: DollarSign },
    { id: 5, name: "Documents", icon: FileText },
  ];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Edit Patient</h1>
          <p className="text-gray-600 mt-2">{formData.personal.name}</p>
        </div>

        {/* Success/Error Message */}
        {message.text && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Steps */}
        <div className="mb-8 bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between">
            {steps.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                className={`flex flex-col items-center flex-1 ${
                  idx !== steps.length - 1 ? "border-r" : ""
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                    currentStep === step.id
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  <step.icon className="w-6 h-6" />
                </div>
                <span
                  className={`text-sm font-medium ${
                    currentStep === step.id
                      ? "text-indigo-600"
                      : "text-gray-600"
                  }`}
                >
                  {step.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          {/* Step 1: Personal */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Personal Details</h2>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.personal.name}
                    onChange={(e) =>
                      handleInputChange("personal", "name", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Age
                  </label>
                  <input
                    type="number"
                    value={formData.personal.age}
                    onChange={(e) =>
                      handleInputChange("personal", "age", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender
                  </label>
                  <select
                    value={formData.personal.gender}
                    onChange={(e) =>
                      handleInputChange("personal", "gender", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    value={formData.personal.phone}
                    onChange={(e) =>
                      handleInputChange("personal", "phone", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.personal.email}
                    onChange={(e) =>
                      handleInputChange("personal", "email", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Branch
                  </label>
                  <select
                    value={formData.personal.branch}
                    onChange={(e) =>
                      handleInputChange("personal", "branch", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Branch</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Mumbai">Mumbai</option>
                    <option value="Hyderabad">Hyderabad</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Visit Date
                  </label>
                  <input
                    type="date"
                    value={formData.personal.visitDate}
                    onChange={(e) =>
                      handleInputChange("personal", "visitDate", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reference
                  </label>
                  <select
                    value={formData.personal.reference}
                    onChange={(e) =>
                      handleInputChange("personal", "reference", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Reference</option>
                    {employees.references.map((ref) => (
                      <option key={ref._id} value={ref._id}>
                        {ref.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Package Quoted
                  </label>
                  <input
                    type="number"
                    value={formData.personal.packageQuoted}
                    onChange={(e) =>
                      handleInputChange(
                        "personal",
                        "packageQuoted",
                        e.target.value
                      )
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Technique Quoted
                  </label>
                  <select
                    value={formData.personal.techniqueQuoted}
                    onChange={(e) =>
                      handleInputChange(
                        "personal",
                        "techniqueQuoted",
                        e.target.value
                      )
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Technique</option>
                    <option value="FUE">FUE</option>
                    <option value="FUT">FUT</option>
                    <option value="DHI">DHI</option>
                    <option value="BIO-FUE">BIO-FUE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remarks
                </label>
                <textarea
                  value={formData.personal.remarks}
                  onChange={(e) =>
                    handleInputChange("personal", "remarks", e.target.value)
                  }
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Step 2: Medical */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Medical History</h2>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Blood Group
                  </label>
                  <select
                    value={formData.medical.bloodGroup}
                    onChange={(e) =>
                      handleInputChange("medical", "bloodGroup", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Blood Group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Blood Pressure
                  </label>
                  <input
                    type="text"
                    value={formData.medical.bp}
                    onChange={(e) =>
                      handleInputChange("medical", "bp", e.target.value)
                    }
                    placeholder="120/80"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sugar Level
                  </label>
                  <input
                    type="text"
                    value={formData.medical.sugar}
                    onChange={(e) =>
                      handleInputChange("medical", "sugar", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pulse
                  </label>
                  <input
                    type="text"
                    value={formData.medical.pulse}
                    onChange={(e) =>
                      handleInputChange("medical", "pulse", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={formData.medical.weight}
                    onChange={(e) =>
                      handleInputChange("medical", "weight", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Allergies
                </label>
                <textarea
                  value={formData.medical.allergies}
                  onChange={(e) =>
                    handleInputChange("medical", "allergies", e.target.value)
                  }
                  rows={2}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Medical History
                </label>
                <textarea
                  value={formData.medical.medicalHistory}
                  onChange={(e) =>
                    handleInputChange(
                      "medical",
                      "medicalHistory",
                      e.target.value
                    )
                  }
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-6">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.medical.hiv}
                    onChange={(e) =>
                      handleInputChange("medical", "hiv", e.target.checked)
                    }
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    HIV
                  </span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.medical.hcv}
                    onChange={(e) =>
                      handleInputChange("medical", "hcv", e.target.checked)
                    }
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    HCV
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Step 3: Surgery */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Surgery Details</h2>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Surgery Date
                  </label>
                  <input
                    type="date"
                    value={formData.surgery.surgeryDate}
                    onChange={(e) =>
                      handleInputChange("surgery", "surgeryDate", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.surgery.location}
                    onChange={(e) =>
                      handleInputChange("surgery", "location", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    OT
                  </label>
                  <input
                    type="text"
                    value={formData.surgery.OT}
                    onChange={(e) =>
                      handleInputChange("surgery", "OT", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Technique
                  </label>
                  <select
                    value={formData.surgery.technique}
                    onChange={(e) =>
                      handleInputChange("surgery", "technique", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Technique</option>
                    <option value="FUE">FUE</option>
                    <option value="FUT">FUT</option>
                    <option value="DHI">DHI</option>
                    <option value="BIO-FUE">BIO-FUE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grafts Needed
                  </label>
                  <input
                    type="number"
                    value={formData.surgery.graftsneed}
                    onChange={(e) =>
                      handleInputChange("surgery", "graftsneed", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grafts Implanted
                  </label>
                  <input
                    type="number"
                    value={formData.surgery.graftsImplanted}
                    onChange={(e) =>
                      handleInputChange(
                        "surgery",
                        "graftsImplanted",
                        e.target.value
                      )
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Donor Condition
                  </label>
                  <input
                    type="text"
                    value={formData.surgery.donorCondition}
                    onChange={(e) =>
                      handleInputChange(
                        "surgery",
                        "donorCondition",
                        e.target.value
                      )
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Doctor
                  </label>
                  <select
                    value={formData.surgery.doctor}
                    onChange={(e) =>
                      handleInputChange("surgery", "doctor", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Doctor</option>
                    {employees.doctors.map((doc) => (
                      <option key={doc._id} value={doc._id}>
                        {doc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Senior Technician
                  </label>
                  <select
                    value={formData.surgery.seniorTech}
                    onChange={(e) =>
                      handleInputChange("surgery", "seniorTech", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Technician</option>
                    {employees.technicians.map((tech) => (
                      <option key={tech._id} value={tech._id}>
                        {tech.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Implanter (Right)
                  </label>
                  <select
                    value={formData.surgery.implanterRight}
                    onChange={(e) =>
                      handleInputChange(
                        "surgery",
                        "implanterRight",
                        e.target.value
                      )
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Implanter</option>
                    {employees.technicians.map((tech) => (
                      <option key={tech._id} value={tech._id}>
                        {tech.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Implanter (Left)
                  </label>
                  <select
                    value={formData.surgery.implanterLeft}
                    onChange={(e) =>
                      handleInputChange(
                        "surgery",
                        "implanterLeft",
                        e.target.value
                      )
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Implanter</option>
                    {employees.technicians.map((tech) => (
                      <option key={tech._id} value={tech._id}>
                        {tech.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grafting Person
                  </label>
                  <select
                    multiple
                    value={formData.surgery.graftingPerson}
                    onChange={(e) =>
                      handleInputChange(
                        "surgery",
                        "graftingPerson",
                        Array.from(
                          e.target.selectedOptions,
                          (opt) => opt.value
                        )
                      )
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    size={4}
                  >
                    {employees.technicians.map((tech) => (
                      <option key={tech._id} value={tech._id}>
                        {tech.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Hold Ctrl/Cmd to select multiple
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Helpers
                  </label>
                  <select
                    multiple
                    value={formData.surgery.helpers}
                    onChange={(e) =>
                      handleInputChange(
                        "surgery",
                        "helpers",
                        Array.from(
                          e.target.selectedOptions,
                          (opt) => opt.value
                        )
                      )
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    size={4}
                  >
                    {employees.helpers.map((helper) => (
                      <option key={helper._id} value={helper._id}>
                        {helper.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Hold Ctrl/Cmd to select multiple
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Surgery Notes
                </label>
                <textarea
                  value={formData.surgery.surgeryNotes}
                  onChange={(e) =>
                    handleInputChange("surgery", "surgeryNotes", e.target.value)
                  }
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Step 4: Payment */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Payment Details</h2>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Amount
                  </label>
                  <input
                    type="number"
                    value={formData.payments.totalAmount}
                    onChange={(e) =>
                      handleInputChange("payments", "totalAmount", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount Received
                  </label>
                  <input
                    type="number"
                    value={formData.payments.amountReceived}
                    onChange={(e) =>
                      handleInputChange(
                        "payments",
                        "amountReceived",
                        e.target.value
                      )
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount
                  </label>
                  <input
                    type="number"
                    value={formData.payments.discount}
                    onChange={(e) =>
                      handleInputChange("payments", "discount", e.target.value)
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Medicine Amount
                  </label>
                  <input
                    type="number"
                    value={formData.payments.medicineAmount}
                    onChange={(e) =>
                      handleInputChange(
                        "payments",
                        "medicineAmount",
                        e.target.value
                      )
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">
                    Pending Amount:
                  </span>
                  <span className="text-xl font-bold text-indigo-600">
                    ₹
                    {(
                      (parseFloat(formData.payments.totalAmount) || 0) -
                      (parseFloat(formData.payments.amountReceived) || 0)
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Documents */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Documents</h2>

              <div className="grid grid-cols-2 gap-6">
                <DocumentUpload
                  title="Patient Images"
                  icon={Image}
                  files={formData.documents.images}
                  onUpload={(files) => handleFileUpload(files, "images")}
                  onRemove={(idx) => handleRemoveFile("images", idx)}
                  accept="image/*"
                  uploadId="images-upload"
                  isUploading={uploading.images}
                />

                <DocumentUpload
                  title="Consent Form"
                  icon={FileText}
                  files={formData.documents.consentForm}
                  onUpload={(files) => handleFileUpload(files, "consentForm")}
                  onRemove={(idx) => handleRemoveFile("consentForm", idx)}
                  accept=".pdf,image/*"
                  uploadId="consent-upload"
                  isUploading={uploading.consentForm}
                />

                <DocumentUpload
                  title="Surgery Form"
                  icon={FileText}
                  files={formData.documents.suregeryForm}
                  onUpload={(files) => handleFileUpload(files, "suregeryForm")}
                  onRemove={(idx) => handleRemoveFile("suregeryForm", idx)}
                  accept=".pdf,image/*"
                  uploadId="surgery-upload"
                  isUploading={uploading.suregeryForm}
                />

                <DocumentUpload
                  title="Consultation Form"
                  icon={FileText}
                  files={formData.documents.consultForm}
                  onUpload={(files) => handleFileUpload(files, "consultForm")}
                  onRemove={(idx) => handleRemoveFile("consultForm", idx)}
                  accept=".pdf,image/*"
                  uploadId="consult-upload"
                  isUploading={uploading.consultForm}
                />
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <button
              onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
              disabled={currentStep === 1}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <div className="flex gap-3">
              {currentStep < 5 ? (
                <button
                  onClick={() => setCurrentStep((s) => Math.min(5, s + 1))}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// DocumentUpload Component
const DocumentUpload = ({
  title,
  icon: Icon,
  files,
  onUpload,
  onRemove,
  accept,
  uploadId,
  isUploading,
}) => {
  const [viewingFile, setViewingFile] = useState(null);

  const isPDF = (filename) => {
    return filename.toLowerCase().endsWith(".pdf");
  };

  const getFileName = (url) => {
    try {
      const parts = url.split("/");
      const fileNameWithParams = parts[parts.length - 1];
      const fileName = fileNameWithParams.split("?")[0];
      return decodeURIComponent(fileName);
    } catch (error) {
      return url;
    }
  };

  const handleViewFile = (fileUrl) => {
    setViewingFile(fileUrl);
  };

  const handleDownloadFile = (fileUrl) => {
    const fileName = getFileName(fileUrl);
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-gray-400 mb-4 flex items-center justify-center">
            <Icon size={48} />
          </div>
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
                : "bg-blue-600 hover:bg-blue-700 cursor-pointer"
            } transition-colors duration-200`}
          >
            <Upload className="mr-2" size={20} />
            {isUploading ? "Uploading..." : "Add Files"}
          </label>

          {files.length > 0 && (
            <div className="mt-4">
              <h5 className="text-sm font-medium text-gray-700 mb-2">
                Uploaded Files ({files.length}):
              </h5>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {files.map((filePath, index) => {
                  const fileName = getFileName(filePath);
                  const isPdf = isPDF(filePath);

                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white px-4 py-3 rounded-md border hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div
                          className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center ${
                            isPdf ? "bg-red-100" : "bg-blue-100"
                          }`}
                        >
                          {isPdf ? (
                            <FileText size={16} className="text-red-600" />
                          ) : (
                            <Image size={16} className="text-blue-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium text-gray-700 block truncate">
                            {fileName}
                          </span>
                          <p className="text-xs text-gray-500">
                            {isPdf ? "PDF Document" : "Image File"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleViewFile(filePath)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                          title="View file"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadFile(filePath)}
                          className="p-2 text-green-600 hover:bg-green-100 rounded transition-colors"
                          title="Download file"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(index)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
                          title="Remove file"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* File Viewer Modal */}
      {viewingFile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setViewingFile(null)}
        >
          <div
            className="relative bg-white rounded-lg w-full max-w-6xl h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-900">
                {getFileName(viewingFile)}
              </h3>
              <button
                onClick={() => setViewingFile(null)}
                className="text-gray-600 hover:text-gray-900 text-2xl font-bold px-3 hover:bg-gray-200 rounded"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-100">
              {isPDF(viewingFile) ? (
                <iframe
                  src={viewingFile}
                  className="w-full h-full border-0"
                  title="PDF Viewer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <img
                    src={viewingFile}
                    alt="Document"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};