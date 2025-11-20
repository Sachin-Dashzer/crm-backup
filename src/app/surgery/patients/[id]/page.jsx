"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Activity,
  Heart,
  FileText,
  Edit,
  Stethoscope,
  Users as UsersIcon,
  DollarSign,
  Image as ImageIcon
} from "lucide-react";
import Sidebar from "@/components/SurgerySidebar";
import Link from "next/link";

export default function PatientDetail() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [activeTab, setActiveTab] = useState("personal");

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
      setPatient(data.patient);
    } catch (error) {
      console.error("Error fetching patient:", error);
      // Mock data for development
      setPatient({
        _id: params.id,
        personal: {
          name: "John Doe",
          phone: "9876543210",
          email: "john@example.com",
          age: 35,
          gender: "MALE",
          branch: "Delhi",
          address: "123 Main Street, Delhi",
          profession: "Software Engineer",
          visitDate: new Date().toISOString(),
          packageQuoted: 150000,
          techniqueQuoted: "FUE",
          remarks: "Interested in hair transplant"
        },
        counselling: {
          techniqueSuggested: "FUE",
          finlpackage: 145000,
          graftsSuggested: 2500,
          readyForSurgery: true,
          notes: "Good candidate for FUE technique",
          hairlossType: "Male Pattern Baldness",
          areaofConcern: "Crown and Hairline",
          hairlossreason: "Genetic",
          hairlossduration: "5 years"
        },
        medical: {
          bloodGroup: "O+",
          allergies: "None",
          medicalHistory: "NO",
          sugar: "Normal",
          bp: "120/80",
          pulse: "72",
          weight: "75kg",
          hiv: "Negative",
          hcv: "Negative"
        },
        surgery: {
          surgeryDate: new Date().toISOString(),
          location: "Delhi",
          OT: 1,
          technique: "FUE",
          graftsneed: 2500,
          graftsImplanted: 2500,
          donorCondition: "Good"
        },
        documents: {
          images: [],
          consentForm: [],
          suregeryForm: [],
          consultForm: []
        },
        payments: {
          totalAmount: 145000,
          amountReceived: 100000,
          pendingAmount: 45000,
          medicineAmount: 5000
        },
        ops: {
          status: "SURGERY_BOOKED"
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const getTechniqueColor = (technique) => {
    const colors = {
      FUE: "bg-blue-100 text-blue-700 border-blue-200",
      "TURKISH DHI": "bg-purple-100 text-purple-700 border-purple-200",
      "INDIAN DHI": "bg-pink-100 text-pink-700 border-pink-200",
      HYBRID: "bg-green-100 text-green-700 border-green-200",
      PRP: "bg-yellow-100 text-yellow-700 border-yellow-200",
      GFC: "bg-orange-100 text-orange-700 border-orange-200",
    };
    return colors[technique] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const tabs = [
    { id: "personal", label: "Personal Info", icon: User },
    { id: "medical", label: "Medical", icon: Heart },
    { id: "surgery", label: "Surgery", icon: Stethoscope },
    { id: "documents", label: "Documents", icon: FileText },
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

  if (!patient) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar role="surgery" />
        <main className="flex-1 p-4 lg:p-8">
          <div className="text-center py-12">
            <p className="text-gray-600">Patient not found</p>
            <Link href="/surgery/patients" className="text-green-600 hover:text-green-700 mt-4 inline-block">
              Back to Patients
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role="surgery" />
      <main className="flex-1 p-4 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{patient.personal?.name}</h1>
              <p className="text-sm text-gray-600 mt-1">Patient ID: {patient._id}</p>
            </div>
            <Link
              href={`/surgery/patients/edit/${patient._id}`}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit Patient
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Surgery Date</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatDate(patient.surgery?.surgeryDate)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Technique</p>
                <p className="text-sm font-semibold text-gray-900">
                  {patient.surgery?.technique || patient.counselling?.techniqueSuggested || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Stethoscope className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Grafts</p>
                <p className="text-sm font-semibold text-gray-900">
                  {patient.surgery?.graftsImplanted || patient.surgery?.graftsneed || patient.counselling?.graftsSuggested || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Pending Amount</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatCurrency(patient.payments?.pendingAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "text-green-600 border-b-2 border-green-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* Personal Info Tab */}
            {activeTab === "personal" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name</label>
                    <p className="text-gray-900">{patient.personal?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Phone Number</label>
                    <p className="text-gray-900">{patient.personal?.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
                    <p className="text-gray-900">{patient.personal?.email || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Age</label>
                    <p className="text-gray-900">{patient.personal?.age || 'N/A'} years</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Gender</label>
                    <p className="text-gray-900">{patient.personal?.gender || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Branch</label>
                    <p className="text-gray-900">{patient.personal?.branch || 'N/A'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Address</label>
                    <p className="text-gray-900">{patient.personal?.address || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Profession</label>
                    <p className="text-gray-900">{patient.personal?.profession || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Visit Date</label>
                    <p className="text-gray-900">{formatDate(patient.personal?.visitDate)}</p>
                  </div>
                </div>

                {/* Counselling Info */}
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Counselling Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Technique Suggested</label>
                      <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full border ${getTechniqueColor(patient.counselling?.techniqueSuggested)}`}>
                        {patient.counselling?.techniqueSuggested || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Grafts Suggested</label>
                      <p className="text-gray-900">{patient.counselling?.graftsSuggested || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Package Amount</label>
                      <p className="text-gray-900">{formatCurrency(patient.counselling?.finlpackage)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Ready for Surgery</label>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${patient.counselling?.readyForSurgery ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {patient.counselling?.readyForSurgery ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Hair Loss Type</label>
                      <p className="text-gray-900">{patient.counselling?.hairlossType || 'N/A'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Counselling Notes</label>
                      <p className="text-gray-900">{patient.counselling?.notes || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Medical Tab */}
            {activeTab === "medical" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Blood Group</label>
                  <p className="text-gray-900">{patient.medical?.bloodGroup || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Medical History</label>
                  <p className="text-gray-900">{patient.medical?.medicalHistory || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Blood Pressure</label>
                  <p className="text-gray-900">{patient.medical?.bp || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Sugar Level</label>
                  <p className="text-gray-900">{patient.medical?.sugar || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Pulse</label>
                  <p className="text-gray-900">{patient.medical?.pulse || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Weight</label>
                  <p className="text-gray-900">{patient.medical?.weight || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">HIV Status</label>
                  <p className="text-gray-900">{patient.medical?.hiv || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">HCV Status</label>
                  <p className="text-gray-900">{patient.medical?.hcv || 'N/A'}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Allergies</label>
                  <p className="text-gray-900">{patient.medical?.allergies || 'N/A'}</p>
                </div>
              </div>
            )}

            {/* Surgery Tab */}
            {activeTab === "surgery" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Surgery Date</label>
                  <p className="text-gray-900">{formatDate(patient.surgery?.surgeryDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Location</label>
                  <p className="text-gray-900">{patient.surgery?.location || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">OT Number</label>
                  <p className="text-gray-900">{patient.surgery?.OT || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Technique</label>
                  <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full border ${getTechniqueColor(patient.surgery?.technique)}`}>
                    {patient.surgery?.technique || 'N/A'}
                  </span>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Grafts Needed</label>
                  <p className="text-gray-900">{patient.surgery?.graftsneed || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Grafts Implanted</label>
                  <p className="text-gray-900">{patient.surgery?.graftsImplanted || 'N/A'}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Donor Condition</label>
                  <p className="text-gray-900">{patient.surgery?.donorCondition || 'N/A'}</p>
                </div>
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === "documents" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Patient Images</h3>
                  {patient.documents?.images?.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {patient.documents.images.map((img, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-2">
                          <img src={img} alt={`Patient ${idx + 1}`} className="w-full h-32 object-cover rounded" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No images uploaded</p>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Consent Forms</h3>
                  {patient.documents?.consentForm?.length > 0 ? (
                    <div className="space-y-2">
                      {patient.documents.consentForm.map((doc, idx) => (
                        <a key={idx} href={doc} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
                          <FileText className="w-4 h-4" />
                          Consent Form {idx + 1}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No consent forms uploaded</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}