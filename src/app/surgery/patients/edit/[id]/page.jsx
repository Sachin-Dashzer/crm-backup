"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader } from "lucide-react";
import Sidebar from "@/components/SurgerySidebar";
import InputField from "@/components/InputField";

export default function EditPatient() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState("surgery");
  const [formData, setFormData] = useState({
    surgery: {},
    medical: {},
    documents: {}
  });

  useEffect(() => {
    if (params.id) {
      fetchPatientData();
    }
  }, [params.id]);

  const fetchPatientData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/surgery/patients/${params.id}`);
      const data = await response.json();
      setFormData({
        surgery: data.patient?.surgery || {},
        medical: data.patient?.medical || {},
        documents: data.patient?.documents || {}
      });
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const response = await fetch(`/api/surgery/patients/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        alert('Patient updated successfully!');
        router.push(`/surgery/patients/${params.id}`);
      } else {
        alert('Failed to update patient');
      }
    } catch (error) {
      console.error("Error:", error);
      alert('Error updating patient');
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { id: "surgery", label: "Surgery Details" },
    { id: "medical", label: "Medical Information" },
    { id: "documents", label: "Documents" }
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar role="surgery" />
        <main className="flex-1 p-4 lg:p-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role="surgery" />
      <main className="flex-1 p-4 lg:p-8">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Edit Patient Details</h1>
          <p className="text-sm text-gray-600 mt-1">Update patient information</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                    activeSection === section.id
                      ? "text-green-600 border-b-2 border-green-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            {/* Surgery Section */}
            {activeSection === "surgery" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputField
                    label="Surgery Date"
                    type="datetime-local"
                    value={formData.surgery.surgeryDate ? new Date(formData.surgery.surgeryDate).toISOString().slice(0, 16) : ''}
                    onChange={(e) => handleInputChange('surgery', 'surgeryDate', e.target.value)}
                  />
                  <InputField
                    label="Location"
                    select
                    value={formData.surgery.location || ''}
                    onChange={(e) => handleInputChange('surgery', 'location', e.target.value)}
                    options={[
                      { value: '', label: 'Select Location' },
                      { value: 'Delhi', label: 'Delhi' },
                      { value: 'Mumbai', label: 'Mumbai' },
                      { value: 'Hyderabad', label: 'Hyderabad' }
                    ]}
                  />
                  <InputField
                    label="OT Number"
                    type="number"
                    value={formData.surgery.OT || ''}
                    onChange={(e) => handleInputChange('surgery', 'OT', e.target.value)}
                  />
                  <InputField
                    label="Technique"
                    select
                    value={formData.surgery.technique || ''}
                    onChange={(e) => handleInputChange('surgery', 'technique', e.target.value)}
                    options={[
                      { value: '', label: 'Select Technique' },
                      { value: 'FUE', label: 'FUE' },
                      { value: 'TURKISH DHI', label: 'Turkish DHI' },
                      { value: 'INDIAN DHI', label: 'Indian DHI' },
                      { value: 'HYBRID', label: 'HYBRID' },
                      { value: 'PRP', label: 'PRP' },
                      { value: 'GFC', label: 'GFC' },
                      { value: 'Other', label: 'Other' }
                    ]}
                  />
                  <InputField
                    label="Grafts Needed"
                    type="number"
                    value={formData.surgery.graftsneed || ''}
                    onChange={(e) => handleInputChange('surgery', 'graftsneed', e.target.value)}
                  />
                  <InputField
                    label="Grafts Implanted"
                    type="number"
                    value={formData.surgery.graftsImplanted || ''}
                    onChange={(e) => handleInputChange('surgery', 'graftsImplanted', e.target.value)}
                  />
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Donor Condition
                    </label>
                    <textarea
                      value={formData.surgery.donorCondition || ''}
                      onChange={(e) => handleInputChange('surgery', 'donorCondition', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Medical Section */}
            {activeSection === "medical" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputField
                    label="Blood Group"
                    select
                    value={formData.medical.bloodGroup || ''}
                    onChange={(e) => handleInputChange('medical', 'bloodGroup', e.target.value)}
                    options={[
                      { value: '', label: 'Select Blood Group' },
                      { value: 'A+', label: 'A+' },
                      { value: 'A-', label: 'A-' },
                      { value: 'B+', label: 'B+' },
                      { value: 'B-', label: 'B-' },
                      { value: 'AB+', label: 'AB+' },
                      { value: 'AB-', label: 'AB-' },
                      { value: 'O+', label: 'O+' },
                      { value: 'O-', label: 'O-' }
                    ]}
                  />
                  <InputField
                    label="Medical History"
                    select
                    value={formData.medical.medicalHistory || ''}
                    onChange={(e) => handleInputChange('medical', 'medicalHistory', e.target.value)}
                    options={[
                      { value: '', label: 'Select' },
                      { value: 'YES', label: 'YES' },
                      { value: 'NO', label: 'NO' },
                      { value: 'UNKNOWN', label: 'UNKNOWN' }
                    ]}
                  />
                  <InputField
                    label="Blood Pressure"
                    value={formData.medical.bp || ''}
                    onChange={(e) => handleInputChange('medical', 'bp', e.target.value)}
                    placeholder="e.g., 120/80"
                  />
                  <InputField
                    label="Sugar Level"
                    value={formData.medical.sugar || ''}
                    onChange={(e) => handleInputChange('medical', 'sugar', e.target.value)}
                    placeholder="e.g., Normal, 110 mg/dL"
                  />
                  <InputField
                    label="Pulse"
                    value={formData.medical.pulse || ''}
                    onChange={(e) => handleInputChange('medical', 'pulse', e.target.value)}
                    placeholder="e.g., 72 bpm"
                  />
                  <InputField
                    label="Weight"
                    value={formData.medical.weight || ''}
                    onChange={(e) => handleInputChange('medical', 'weight', e.target.value)}
                    placeholder="e.g., 75kg"
                  />
                  <InputField
                    label="HIV Status"
                    value={formData.medical.hiv || ''}
                    onChange={(e) => handleInputChange('medical', 'hiv', e.target.value)}
                    placeholder="e.g., Negative"
                  />
                  <InputField
                    label="HCV Status"
                    value={formData.medical.hcv || ''}
                    onChange={(e) => handleInputChange('medical', 'hcv', e.target.value)}
                    placeholder="e.g., Negative"
                  />
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Allergies
                    </label>
                    <textarea
                      value={formData.medical.allergies || ''}
                      onChange={(e) => handleInputChange('medical', 'allergies', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="List any known allergies"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Documents Section */}
            {activeSection === "documents" && (
              <div className="space-y-6">
                <p className="text-gray-600">Document upload functionality will be implemented here.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Patient Images
                    </label>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Consent Forms
                    </label>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="mt-8 flex items-center gap-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
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