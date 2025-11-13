"use client";

import { useState, useEffect, Suspense } from "react";
import { 
  Users, 
  Search, 
  Filter, 
  Calendar,
  MapPin,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  Activity,
  Edit,
  Eye
} from "lucide-react";
import Sidebar from "@/components/SurgerySidebar";
import Topbar from "@/components/Topbar";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Content component that uses useSearchParams
function SurgeryPatientsContent() {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');
  
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState(filterParam || "all");
  const [filterTechnique, setFilterTechnique] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [branch, setBranch] = useState("All");

  useEffect(() => {
    fetchPatients();
  }, [branch]);

  useEffect(() => {
    applyFilters();
  }, [patients, searchTerm, filterStatus, filterTechnique, filterLocation]);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/surgery/patients?branch=${branch}`);
      const data = await response.json();
      setPatients(data.patients || []);
    } catch (error) {
      console.error("Error fetching patients:", error);
      // Mock data for development
      setPatients([
        {
          _id: "1",
          personal: { 
            name: "John Doe", 
            phone: "9876543210", 
            email: "john@example.com",
            branch: "Delhi",
            age: 35,
            gender: "MALE"
          },
          surgery: { 
            surgeryDate: new Date().toISOString(), 
            technique: "FUE", 
            location: "Delhi",
            graftsneed: 2500,
            graftsImplanted: 2500
          },
          counselling: { 
            techniqueSuggested: "FUE",
            readyForSurgery: true
          },
          medical: {
            bloodGroup: "O+",
            allergies: "None"
          },
          ops: { status: "SURGERY_BOOKED" }
        },
        {
          _id: "2",
          personal: { 
            name: "Jane Smith", 
            phone: "9876543211", 
            email: "jane@example.com",
            branch: "Mumbai",
            age: 42,
            gender: "FEMALE"
          },
          surgery: { 
            surgeryDate: new Date(Date.now() + 86400000).toISOString(), 
            technique: "DHI", 
            location: "Mumbai",
            graftsneed: 3000
          },
          counselling: { 
            techniqueSuggested: "DHI",
            readyForSurgery: true
          },
          medical: {
            bloodGroup: "A+",
            allergies: "None"
          },
          ops: { status: "SURGERY_BOOKED" }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...patients];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(patient =>
        patient.personal?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.personal?.phone?.includes(searchTerm)
      );
    }

    // Status filter
    if (filterStatus !== "all") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (filterStatus === "upcoming") {
        filtered = filtered.filter(patient => {
          const surgeryDate = new Date(patient.surgery?.surgeryDate);
          return surgeryDate >= today && surgeryDate < tomorrow && !patient.surgery?.graftsImplanted;
        });
      } else if (filterStatus === "performed") {
        filtered = filtered.filter(patient => {
          const surgeryDate = new Date(patient.surgery?.surgeryDate);
          return surgeryDate >= today && surgeryDate < tomorrow && patient.surgery?.graftsImplanted;
        });
      } else if (filterStatus === "ready") {
        filtered = filtered.filter(patient => 
          patient.counselling?.readyForSurgery && !patient.surgery?.surgeryDate
        );
      }
    }

    // Technique filter
    if (filterTechnique !== "all") {
      filtered = filtered.filter(patient =>
        patient.surgery?.technique === filterTechnique || 
        patient.counselling?.techniqueSuggested === filterTechnique
      );
    }

    // Location filter
    if (filterLocation !== "all") {
      filtered = filtered.filter(patient =>
        patient.surgery?.location === filterLocation || 
        patient.personal?.branch === filterLocation
      );
    }

    setFilteredPatients(filtered);
  };

  const getTechniqueColor = (technique) => {
    const colors = {
      FUE: "bg-blue-100 text-blue-700 border-blue-200",
      DHI: "bg-purple-100 text-purple-700 border-purple-200",
      "INDIAN DHI": "bg-pink-100 text-pink-700 border-pink-200",
      HYBRID: "bg-green-100 text-green-700 border-green-200",
      PRP: "bg-yellow-100 text-yellow-700 border-yellow-200",
      GFC: "bg-orange-100 text-orange-700 border-orange-200",
    };
    return colors[technique] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const getStatusBadge = (patient) => {
    if (patient.surgery?.graftsImplanted) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 border border-green-200">
          Completed
        </span>
      );
    } else if (patient.surgery?.surgeryDate) {
      const surgeryDate = new Date(patient.surgery.surgeryDate);
      const today = new Date();
      if (surgeryDate.toDateString() === today.toDateString()) {
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-200">
            Today
          </span>
        );
      }
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700 border border-amber-200">
          Scheduled
        </span>
      );
    } else if (patient.counselling?.readyForSurgery) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
          Ready
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 border border-gray-200">
        New
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role="surgery" />
      <main className="flex-1 p-4 lg:p-8">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Patients Management</h1>
              <p className="text-sm text-gray-600 mt-1">View and manage all surgery patients</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="All">All Branches</option>
                <option value="Delhi">Delhi</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Hyderabad">Hyderabad</option>
              </select>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="upcoming">Today's Upcoming</option>
                <option value="performed">Today's Completed</option>
                <option value="ready">Ready for Surgery</option>
              </select>

              {/* Technique Filter */}
              <select
                value={filterTechnique}
                onChange={(e) => setFilterTechnique(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Techniques</option>
                <option value="FUE">FUE</option>
                <option value="DHI">DHI</option>
                <option value="INDIAN DHI">INDIAN DHI</option>
                <option value="HYBRID">HYBRID</option>
                <option value="PRP">PRP</option>
                <option value="GFC">GFC</option>
              </select>

              {/* Location Filter */}
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Locations</option>
                <option value="Delhi">Delhi</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Hyderabad">Hyderabad</option>
              </select>
            </div>

            {/* Active Filters Summary */}
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">Showing {filteredPatients.length} of {patients.length} patients</span>
              {(searchTerm || filterStatus !== "all" || filterTechnique !== "all" || filterLocation !== "all") && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterStatus("all");
                    setFilterTechnique("all");
                    setFilterLocation("all");
                  }}
                  className="text-green-600 hover:text-green-700 font-medium"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            {filteredPatients.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No patients found</h3>
                <p className="text-gray-600">Try adjusting your filters or search terms</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Patient Details
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Surgery Info
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Medical
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPatients.map((patient) => (
                      <tr key={patient._id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4">
                          <div>
                            <div className="font-semibold text-gray-900">{patient.personal?.name}</div>
                            <div className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" />
                              {patient.personal?.branch} • {patient.personal?.age}y • {patient.personal?.gender}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <Phone className="w-3 h-3 text-gray-400" />
                              {patient.personal?.phone}
                            </div>
                            {patient.personal?.email && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Mail className="w-3 h-3 text-gray-400" />
                                {patient.personal?.email}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="space-y-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getTechniqueColor(patient.surgery?.technique || patient.counselling?.techniqueSuggested)}`}>
                              {patient.surgery?.technique || patient.counselling?.techniqueSuggested || 'N/A'}
                            </span>
                            {patient.surgery?.surgeryDate && (
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <Calendar className="w-3 h-3" />
                                {formatDate(patient.surgery.surgeryDate)}
                              </div>
                            )}
                            {(patient.surgery?.graftsneed || patient.counselling?.graftsSuggested) && (
                              <div className="text-xs text-gray-600">
                                Grafts: {patient.surgery?.graftsneed || patient.counselling?.graftsSuggested}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="space-y-1 text-xs">
                            {patient.medical?.bloodGroup && (
                              <div className="text-gray-700">
                                <span className="font-medium">Blood:</span> {patient.medical.bloodGroup}
                              </div>
                            )}
                            {patient.medical?.allergies && patient.medical.allergies !== "None" && (
                              <div className="text-red-600">
                                <span className="font-medium">Allergies:</span> {patient.medical.allergies}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {getStatusBadge(patient)}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/surgery/patients/${patient._id}`}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <Link
                              href={`/surgery/patients/edit/${patient._id}`}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Edit Patient"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/* ===================================================
   Main Surgery Patients Component with Suspense
=================================================== */
export default function SurgeryPatients() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar role="surgery" />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading patients...</p>
          </div>
        </main>
      </div>
    }>
      <SurgeryPatientsContent />
    </Suspense>
  );
}