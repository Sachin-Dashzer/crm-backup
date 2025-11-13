"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, User, Phone, Mail, Calendar, MapPin, Briefcase, CheckCircle, XCircle, Clock } from "lucide-react";
import Sidebar from "../../../../components/SalesSidebar";

export default function SalesPatientDetail() {
  const params = useParams();
  const router = useRouter();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const res = await fetch(`/api/sales/patients/${params.id}`);
        const data = await res.json();
        if (data.success) {
          setPatient(data.patient);
        }
      } catch (err) {
        console.error("Error fetching patient:", err);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchPatient();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="flex-1 flex justify-center items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="flex-1 flex justify-center items-center">
          <div className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-red-500" />
            <p className="mt-4 text-gray-500 text-lg">Patient not found</p>
            <button
              onClick={() => router.back()}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    const colors = {
      NEW: "bg-blue-100 text-blue-800 border-blue-200",
      CONSULTED: "bg-green-100 text-green-800 border-green-200",
      SURGERY_SCHEDULED: "bg-yellow-100 text-yellow-800 border-yellow-200",
      POST_OP: "bg-purple-100 text-purple-800 border-purple-200",
      CLOSED: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="flex-1 overflow-auto p-4 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Patients
          </button>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {patient.personal?.name || "N/A"}
              </h1>
              <p className="text-gray-600 mt-1">Patient Personal Information</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded-lg text-sm font-semibold border ${getStatusBadge(patient.ops?.status)}`}>
                {patient.ops?.status || "NEW"}
              </span>
              {patient.converted ? (
                <span className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-100 text-green-800 border border-green-200 font-semibold">
                  <CheckCircle className="h-5 w-5" />
                  Converted
                </span>
              ) : (
                <span className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 text-red-800 border border-red-200 font-semibold">
                  <XCircle className="h-5 w-5" />
                  Not Converted
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Personal Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <User className="h-6 w-6 text-indigo-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Basic Information</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Full Name</label>
                  <p className="mt-2 text-gray-900 font-medium">{patient.personal?.name || "N/A"}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Age</label>
                  <p className="mt-2 text-gray-900 font-medium">{patient.personal?.age || "N/A"} years</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Gender</label>
                  <p className="mt-2 text-gray-900 font-medium">{patient.personal?.gender || "N/A"}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Branch</label>
                  <p className="mt-2">
                    <span className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-sm font-semibold border border-blue-200">
                      {patient.personal?.branch || "N/A"}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Phone className="h-6 w-6 text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Contact Information</h2>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Phone Number</label>
                  <div className="mt-2 flex items-center gap-2">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <a href={`tel:${patient.personal?.phone}`} className="text-indigo-600 hover:text-indigo-800 font-medium text-lg">
                      {patient.personal?.phone || "N/A"}
                    </a>
                  </div>
                </div>
                {patient.personal?.email && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Email Address</label>
                    <div className="mt-2 flex items-center gap-2">
                      <Mail className="h-5 w-5 text-gray-400" />
                      <a href={`mailto:${patient.personal?.email}`} className="text-indigo-600 hover:text-indigo-800 font-medium">
                        {patient.personal?.email}
                      </a>
                    </div>
                  </div>
                )}
                {patient.personal?.address && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Address</label>
                    <div className="mt-2 flex items-start gap-2">
                      <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                      <p className="text-gray-900 font-medium">{patient.personal?.address}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Professional Information */}
            {patient.personal?.profession && (
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Briefcase className="h-6 w-6 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Professional Information</h2>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Profession</label>
                  <p className="mt-2 text-gray-900 font-medium">{patient.personal?.profession}</p>
                </div>
              </div>
            )}

            {/* Initial Consultation */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-amber-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Initial Consultation Details</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {patient.personal?.visitDate && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Visit Date</label>
                    <p className="mt-2 text-gray-900 font-medium">
                      {new Date(patient.personal.visitDate).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                      })}
                    </p>
                  </div>
                )}
                {patient.personal?.packageQuoted && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Package Quoted</label>
                    <p className="mt-2 text-gray-900 font-medium">{patient.personal?.packageQuoted}</p>
                  </div>
                )}
                {patient.personal?.techniqueQuoted && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Technique Quoted</label>
                    <p className="mt-2 text-gray-900 font-medium">{patient.personal?.techniqueQuoted}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Conversion Status Card */}
            <div className={`rounded-xl shadow-sm p-6 border-2 ${patient.converted ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Conversion Status</h2>
                {patient.converted ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-600" />
                )}
              </div>
              <p className={`text-2xl font-bold ${patient.converted ? 'text-green-700' : 'text-red-700'}`}>
                {patient.converted ? 'Converted' : 'Not Converted'}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                {patient.converted 
                  ? 'This patient has been successfully converted to a paying customer.'
                  : 'This patient is still in the lead pipeline.'}
              </p>
            </div>

            {/* Reference Agent */}
            {patient.personal?.reference && (
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4 pb-4 border-b border-gray-100">
                  Reference Agent
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Agent Name</label>
                    <p className="mt-2 text-gray-900 font-semibold text-lg">
                      {patient.personal.reference.name || "N/A"}
                    </p>
                  </div>
                  {patient.personal.reference.phone && (
                    <div>
                      <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Contact</label>
                      <div className="mt-2 flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <a 
                          href={`tel:${patient.personal.reference.phone}`}
                          className="text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          {patient.personal.reference.phone}
                        </a>
                      </div>
                    </div>
                  )}
                  {patient.personal.reference.role && (
                    <div>
                      <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Role</label>
                      <p className="mt-2">
                        <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-sm font-semibold border border-green-200">
                          {patient.personal.reference.role}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 pb-4 border-b border-gray-100">Timeline</h2>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 bg-indigo-600 rounded-full"></div>
                    <div className="w-0.5 h-full bg-gray-200"></div>
                  </div>
                  <div className="pb-4 flex-1">
                    <p className="text-sm font-semibold text-gray-900">Patient Created</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(patient.createdAt).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>
                </div>
                {patient.personal?.visitDate && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                      <div className="w-0.5 h-full bg-gray-200"></div>
                    </div>
                    <div className="pb-4 flex-1">
                      <p className="text-sm font-semibold text-gray-900">First Visit</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(patient.personal.visitDate).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric"
                        })}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${patient.converted ? 'bg-green-600' : 'bg-gray-400'}`}></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Current Status</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${getStatusBadge(patient.ops?.status)}`}>
                        {patient.ops?.status || "NEW"}
                      </span>
                      {patient.converted ? (
                        <span className="px-3 py-1 rounded-lg bg-green-100 text-green-800 border border-green-200 text-xs font-semibold">
                          Converted
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-lg bg-red-100 text-red-800 border border-red-200 text-xs font-semibold">
                          Not Converted
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
