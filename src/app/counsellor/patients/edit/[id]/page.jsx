"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { useParams } from "next/navigation";

import { X, FileText, User, Save, ArrowLeft, Edit3 } from "lucide-react";
import InputField from "@/components/InputField";

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

export default function PatientEditDetails() {
  const [step, setStep] = useState(1);
  const [isUpdating, setIsUpdating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);
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
    ops: {
      status: "",
      patientId: "",
      lastUpdated: "",
    },
  });

  const params = useParams();
  const id = params.id;
  const router = useRouter();
  const toast = useToast();

  // Fetch employees on component mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await fetch("/api/employees/get-id");
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

  useEffect(() => {
    if (!id) return;

    const fetchPatientData = async () => {
      try {
        const res = await fetch(`/api/admin/patient-data?id=${id}`, {
          method: "GET",
        });

        if (!res.ok) {
          router.push("/404");
          return;
        }

        const data = await res.json();
        if (data.success && data.patient) {
          const patientData = data.patient;
          setFormData({
            personal: {
              name: patientData.personal?.name || "",
              phone: patientData.personal?.phone || "",
              email: patientData.personal?.email || "",
              age: patientData.personal?.age || "",
              gender: patientData.personal?.gender || "",
              branch: patientData.personal?.branch || "",
              address: patientData.personal?.address || "",
              profession: patientData.personal?.profession || "",
              visitDate: patientData.personal?.visitDate
                ? patientData.personal.visitDate.split("T")[0]
                : "",
              reference: patientData.personal?.reference?._id || "",
              packageQuoted: patientData.personal?.packageQuoted || "",
              techniqueQuoted: patientData.personal?.techniqueQuoted || "",
              remarks: patientData.personal?.remarks || "",
            },
            counselling: {
              counsellor: patientData.counselling?.counsellor?._id || "",
              techniqueSuggested:
                patientData.counselling?.techniqueSuggested || "",
              finlpackage: patientData.counselling?.finlpackage || "",
              graftsSuggested: patientData.counselling?.graftsSuggested || "",
              readyForSurgery:
                patientData.counselling?.readyForSurgery || false,
              notes: patientData.counselling?.notes || "",
              additionalbenefits:
                patientData.counselling?.additionalbenefits || [],
              medicines: patientData.counselling?.medicines || [],
              hairlossType: patientData.counselling?.hairlossType || "",
              areaofConcern: patientData.counselling?.areaofConcern || "",
              hairlossreason: patientData.counselling?.hairlossreason || "",
              hairlossduration: patientData.counselling?.hairlossduration || "",
            },
            ops: {
              status: patientData.ops?.status || "",
              patientId: patientData._id || "",
              lastUpdated: patientData.updatedAt || "",
            },
          });
        }
      } catch (err) {
        console.error("Error fetching patient data:", err);
        router.push("/404");
      }
    };

    fetchPatientData();
  }, [id]);

  const stepConfig = [
    { number: 1, title: "Personal Details", icon: User, color: "blue" },
    { number: 2, title: "Counsellor Details", icon: FileText, color: "green" },
  ];

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

  // Clean empty ObjectId fields before sending to API
  const cleanObjectIdFields = (data) => {
    const cleaned = JSON.parse(JSON.stringify(data)); // Deep clone

    // List of ObjectId reference fields
    const objectIdFields = {
      personal: ["reference"],
      counselling: ["counsellor"],
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

  const handleUpdate = async () => {
    setIsUpdating(true);
    setUpdateStatus(null);

    try {
      // Clean the form data before sending
      const cleanedData = cleanObjectIdFields(formData);

      const updateData = {
        ...cleanedData,
        ops: {
          ...cleanedData.ops,
          lastUpdated: new Date().toISOString(),
        },
      };

      const response = await fetch(`/api/patients/update?id=${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        toast.success("Updated successfully!");
        setUpdateStatus({
          type: "success",
          message: "Patient details updated successfully!",
        });

        setTimeout(() => {
          router.push("/counsellor/patients");
        }, 1000);
      } else {
        toast.error("Update failed!");
      }
    } catch (error) {
      console.error("Error updating patient data:", error);
      setUpdateStatus({
        type: "error",
        message: "Failed to update patient details. Please try again.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const nextStep = () => setStep(Math.min(step + 1, 2));
  const prevStep = () => setStep(Math.max(step - 1, 1));

  return (
    <section className="flex min-h-screen px-24">
      <main className="flex-1 px-12 py-4">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  onClick={() => router.back()}
                >
                  <ArrowLeft size={24} />
                </button>
                <div>
                  <h1 className="text-2xl font-bold flex items-center space-x-2">
                    <Edit3 size={28} />
                    <span>Edit Patient Details</span>
                  </h1>
                  <p className="text-blue-100 mt-1">
                    Patient ID: {formData.ops.patientId} | Status:{" "}
                    {formData.ops.status}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-100">Last Updated</p>
                <p className="font-medium">
                  {formData.ops.lastUpdated
                    ? new Date(formData.ops.lastUpdated).toLocaleDateString()
                    : "Not available"}
                </p>
              </div>
            </div>
          </div>

          {updateStatus && (
            <div
              className={`px-8 py-4 ${
                updateStatus.type === "success"
                  ? "bg-green-50 text-green-800 border-l-4 border-green-400"
                  : "bg-red-50 text-red-800 border-l-4 border-red-400"
              }`}
            >
              <div className="flex">
                <div className="flex-shrink-0">
                  {updateStatus.type === "success" ? "✓" : "⚠"}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{updateStatus.message}</p>
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
                  description="Update basic personal details"
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

                  {/* <InputField
                    label="Reference Source (Agent)"
                    type="select"
                    value={formData.personal.reference}
                    onChange={createChangeHandler("personal", "reference")}
                    options={employees.Agent.map((emp) => ({
                      value: emp._id,
                      label: emp.name,
                    }))}
                  /> */}

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
                      { value: "TURKISH DHI", label: "Turkish DHI" },
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
                  description="Update consultation information"
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
                      { value: "TURKISH DHI", label: "Turkish DHI" },
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
                      removeArrayItem(
                        "counselling",
                        "additionalbenefits",
                        index
                      )
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
                {step < 2 && (
                  <button
                    type="button"
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200"
                    onClick={nextStep}
                  >
                    Next →
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleUpdate}
                  className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <>
                      <div className="animate-spin mr-2 h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2" size={20} />
                      Update Details
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </section>
  );
}
