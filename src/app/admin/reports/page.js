"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { 
  Download, 
  Filter, 
  Search, 
  Calendar, 
  FileText,
  Users,
  DollarSign,
  Activity,
  TrendingUp,
  PieChart,
  BarChart2,
  Star,
  X
} from "lucide-react";

export default function ReportsPage() {
  const [activePage, setActivePage] = useState("Reports");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingId, setLoadingId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [favorites, setFavorites] = useState([]);
  
  const [filters, setFilters] = useState({
    period: "all",
    category: "all",
    startDate: "",
    endDate: "",
    branch: "",
    staffFilter: "",
    techniqueFilter: "",
    statusFilter: "",
    procedureFilter: "",
    paymentTypeFilter: "",
  });

  const [filterOptions, setFilterOptions] = useState({
    staff: [],
    techniques: [],
    status: [],
    branches: ["Delhi", "Mumbai", "Hyderabad"],
    procedures: ["Sapphire FUE", "DHI", "Turkish DHI", "Beard Transplant", "PRP", "GFC", "Medicine", "Other"],
    paymentTypes: ["Booking", "Pending", "Full-payment", "Other"],
  });

  // Color configuration for Tailwind - must be complete class names
  const colorConfig = {
    blue: {
      bg: "bg-blue-100",
      text: "text-blue-600",
      border: "border-blue-200",
      hover: "hover:bg-blue-50"
    },
    green: {
      bg: "bg-green-100",
      text: "text-green-600",
      border: "border-green-200",
      hover: "hover:bg-green-50"
    },
    red: {
      bg: "bg-red-100",
      text: "text-red-600",
      border: "border-red-200",
      hover: "hover:bg-red-50"
    },
    purple: {
      bg: "bg-purple-100",
      text: "text-purple-600",
      border: "border-purple-200",
      hover: "hover:bg-purple-50"
    },
    indigo: {
      bg: "bg-indigo-100",
      text: "text-indigo-600",
      border: "border-indigo-200",
      hover: "hover:bg-indigo-50"
    },
    teal: {
      bg: "bg-teal-100",
      text: "text-teal-600",
      border: "border-teal-200",
      hover: "hover:bg-teal-50"
    },
    cyan: {
      bg: "bg-cyan-100",
      text: "text-cyan-600",
      border: "border-cyan-200",
      hover: "hover:bg-cyan-50"
    },
    orange: {
      bg: "bg-orange-100",
      text: "text-orange-600",
      border: "border-orange-200",
      hover: "hover:bg-orange-50"
    },
  };

  const reports = [
    // Patient Reports
    {
      id: 1,
      name: "Comprehensive Patient Report",
      description: "Complete patient database with personal, medical, counselling, and surgery details",
      category: "Patient Reports",
      type: "patients-comprehensive",
      icon: Users,
      color: "blue",
    },
    {
      id: 2,
      name: "Patient Demographics Report",
      description: "Patient demographics including age, gender, profession, and location",
      category: "Patient Reports",
      type: "patients-demographics",
      icon: Users,
      color: "blue",
    },
    {
      id: 3,
      name: "Patient Status Pipeline Report",
      description: "Patient distribution across different status stages",
      category: "Patient Reports",
      type: "patients-status",
      icon: Activity,
      color: "green",
    },
    {
      id: 4,
      name: "Medical History Report",
      description: "Patient medical histories, allergies, blood group, and health conditions",
      category: "Patient Reports",
      type: "patients-medical",
      icon: FileText,
      color: "red",
    },

    // Staff Performance Reports
    {
      id: 5,
      name: "Counsellor Performance Report",
      description: "Counsellor conversion rates, packages quoted, and patient readiness metrics",
      category: "Staff Reports",
      type: "counsellors",
      icon: TrendingUp,
      color: "purple",
    },
    {
      id: 6,
      name: "Agent Referral Report",
      description: "Agent referral performance and patient acquisition metrics",
      category: "Staff Reports",
      type: "agents",
      icon: Users,
      color: "indigo",
    },
    {
      id: 7,
      name: "Doctor Performance Report",
      description: "Doctor surgery count, techniques performed, and patient outcomes",
      category: "Staff Reports",
      type: "doctors",
      icon: Activity,
      color: "blue",
    },
    {
      id: 8,
      name: "Implanter Efficiency Report",
      description: "Implanter grafts implanted, surgery efficiency, and performance metrics",
      category: "Staff Reports",
      type: "implanters",
      icon: BarChart2,
      color: "teal",
    },
    {
      id: 9,
      name: "Technician Workload Report",
      description: "Technician procedure count and workload distribution",
      category: "Staff Reports",
      type: "technicians",
      icon: Activity,
      color: "cyan",
    },

    // Surgery & Medical Reports
    {
      id: 10,
      name: "Surgical Technique Analysis",
      description: "Analysis of surgical techniques (FUE, Turkish DHI, Indian DHI, Hybrid) with success rates",
      category: "Medical Reports",
      type: "techniques",
      icon: PieChart,
      color: "purple",
    },
    {
      id: 11,
      name: "Surgery Schedule Report",
      description: "Upcoming and completed surgeries with details",
      category: "Medical Reports",
      type: "surgery-schedule",
      icon: Calendar,
      color: "orange",
    },
    {
      id: 12,
      name: "Grafts Analysis Report",
      description: "Grafts suggested vs implanted comparison and analysis",
      category: "Medical Reports",
      type: "grafts-analysis",
      icon: BarChart2,
      color: "green",
    },
    {
      id: 13,
      name: "Counselling Outcomes Report",
      description: "Counselling success rates and surgery readiness metrics",
      category: "Medical Reports",
      type: "counselling-outcomes",
      icon: TrendingUp,
      color: "blue",
    },

    // Financial Reports
    {
      id: 14,
      name: "Revenue Report",
      description: "Complete revenue analysis from all procedures and transactions",
      category: "Financial Reports",
      type: "revenue",
      icon: DollarSign,
      color: "green",
    },
    {
      id: 15,
      name: "Expenses Report",
      description: "All business expenses and cost analysis",
      category: "Financial Reports",
      type: "expenses",
      icon: DollarSign,
      color: "red",
    },
    {
      id: 16,
      name: "Transaction History Report",
      description: "Detailed transaction history with payment methods and types",
      category: "Financial Reports",
      type: "transactions",
      icon: FileText,
      color: "blue",
    },
    {
      id: 17,
      name: "Outstanding Payments Report",
      description: "Patients with pending payments and outstanding amounts",
      category: "Financial Reports",
      type: "outstanding-payments",
      icon: DollarSign,
      color: "orange",
    },
    {
      id: 18,
      name: "Payment Collection Report",
      description: "Payment collection efficiency by branch and staff",
      category: "Financial Reports",
      type: "payment-collection",
      icon: TrendingUp,
      color: "purple",
    },
    {
      id: 19,
      name: "Procedure-wise Revenue Report",
      description: "Revenue breakdown by procedure type",
      category: "Financial Reports",
      type: "procedure-revenue",
      icon: PieChart,
      color: "indigo",
    },

    // Branch Performance Reports
    {
      id: 20,
      name: "Branch Performance Comparison",
      description: "Comparative analysis of all branches",
      category: "Branch Reports",
      type: "branch-comparison",
      icon: BarChart2,
      color: "blue",
    },
    {
      id: 21,
      name: "Branch Revenue Report",
      description: "Revenue analysis by branch location",
      category: "Branch Reports",
      type: "branch-revenue",
      icon: DollarSign,
      color: "green",
    },
    {
      id: 22,
      name: "Branch Patient Volume Report",
      description: "Patient volume and conversion rates by branch",
      category: "Branch Reports",
      type: "branch-patients",
      icon: Users,
      color: "purple",
    },
  ];

  const categories = [
    "all",
    ...new Set(reports.map((report) => report.category)),
  ];

  useEffect(() => {
    fetchFilterOptions();
    loadFavorites();
  }, []);

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch("/api/admin/reports/filters");
      const result = await response.json();

      if (result.success) {
        setFilterOptions((prev) => ({
          ...prev,
          staff: result.data.staff || [],
          techniques: result.data.techniques || [],
          status: result.data.status || [],
        }));
      }
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  const loadFavorites = () => {
    try {
      const saved = localStorage.getItem("favoriteReports");
      if (saved) {
        setFavorites(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Error loading favorites:", error);
      setFavorites([]);
    }
  };

  const toggleFavorite = (reportId) => {
    try {
      const newFavorites = favorites.includes(reportId)
        ? favorites.filter((id) => id !== reportId)
        : [...favorites, reportId];
      
      setFavorites(newFavorites);
      localStorage.setItem("favoriteReports", JSON.stringify(newFavorites));
    } catch (error) {
      console.error("Error saving favorites:", error);
    }
  };

  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      filters.category === "all" || report.category === filters.category;

    return matchesSearch && matchesCategory;
  });

  // Sort favorites first
  const sortedReports = [...filteredReports].sort((a, b) => {
    const aIsFav = favorites.includes(a.id);
    const bIsFav = favorites.includes(b.id);
    if (aIsFav && !bIsFav) return -1;
    if (!aIsFav && bIsFav) return 1;
    return 0;
  });

  const downloadExcel = async (reportType, reportId, reportName) => {
    setLoadingId(reportId);
    
    try {
      const params = new URLSearchParams({
        type: reportType,
        period: filters.period,
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.branch && { branch: filters.branch }),
        ...(filters.staffFilter && { staffFilter: filters.staffFilter }),
        ...(filters.techniqueFilter && { techniqueFilter: filters.techniqueFilter }),
        ...(filters.statusFilter && { statusFilter: filters.statusFilter }),
        ...(filters.procedureFilter && { procedureFilter: filters.procedureFilter }),
        ...(filters.paymentTypeFilter && { paymentTypeFilter: filters.paymentTypeFilter }),
      });

      const response = await fetch(`/api/admin/reports?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to generate report");
      }

      if (!result.data || result.data.length === 0) {
        alert("No data found for the selected filters");
        return;
      }

      const { utils, writeFile } = await import("xlsx");
      const wb = utils.book_new();
      const ws = utils.json_to_sheet(result.data);
      
      const maxWidth = 50;
      const colWidths = Object.keys(result.data[0] || {}).map(key => ({
        wch: Math.min(Math.max(key.length, 10), maxWidth)
      }));
      ws['!cols'] = colWidths;

      utils.book_append_sheet(wb, ws, "Report");

      const fileName = `${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split("T")[0]}.xlsx`;
      writeFile(wb, fileName);

      // Success notification
      alert(`✓ Report downloaded successfully: ${fileName}`);
    } catch (error) {
      console.error("Download error:", error);
      alert(`✗ Error downloading report: ${error.message}`);
    } finally {
      setLoadingId(null);
    }
  };

  const clearFilters = () => {
    setFilters({
      period: "all",
      category: "all",
      startDate: "",
      endDate: "",
      branch: "",
      staffFilter: "",
      techniqueFilter: "",
      statusFilter: "",
      procedureFilter: "",
      paymentTypeFilter: "",
    });
    setSearchTerm("");
  };

  const showDateRange = filters.period === "custom";
  const activeFilterCount = Object.values(filters).filter(v => v && v !== "all").length;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activePage={activePage}
        setActivePage={setActivePage}
      />

      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                Reports Dashboard
              </h1>
              <p className="text-sm sm:text-base text-gray-600">
                Generate and download comprehensive reports for your clinic
              </p>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">All Reports</h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs sm:text-sm text-gray-500">
                    {sortedReports.length} report{sortedReports.length !== 1 ? "s" : ""} found
                  </span>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border transition-colors text-sm ${
                      showFilters 
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700" 
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                    <span className="hidden sm:inline">Filters</span>
                    {activeFilterCount > 0 && (
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-xs">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Basic Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                  <input
                    type="text"
                    placeholder="Search reports..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 sm:pl-10 pr-4 py-2 sm:py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                {/* Category Filter */}
                <select
                  value={filters.category}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                  className="px-3 sm:px-4 py-2 sm:py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category === "all" ? "All Categories" : category}
                    </option>
                  ))}
                </select>

                {/* Time Period */}
                <select
                  value={filters.period}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, period: e.target.value }))
                  }
                  className="px-3 sm:px-4 py-2 sm:py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="all">All Time</option>
                  <option value="daily">Today</option>
                  <option value="weekly">This Week</option>
                  <option value="monthly">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>

                {/* Clear Filters */}
                <button
                  onClick={clearFilters}
                  className="px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm"
                >
                  Clear Filters
                </button>
              </div>

              {/* Date Range */}
              {showDateRange && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          startDate: e.target.value,
                        }))
                      }
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          endDate: e.target.value,
                        }))
                      }
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {/* Advanced Filters */}
              {showFilters && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Advanced Filters
                    </h3>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="p-1 hover:bg-gray-100 rounded-lg transition-colors sm:hidden"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {/* Branch Filter */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Branch
                      </label>
                      <select
                        value={filters.branch}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            branch: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      >
                        <option value="">All Branches</option>
                        {filterOptions.branches.map((branch) => (
                          <option key={branch} value={branch}>
                            {branch}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Staff Filter */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Staff Member
                      </label>
                      <select
                        value={filters.staffFilter}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            staffFilter: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      >
                        <option value="">All Staff</option>
                        {filterOptions.staff.map((staff) => (
                          <option key={staff} value={staff}>
                            {staff}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Technique Filter */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Surgical Technique
                      </label>
                      <select
                        value={filters.techniqueFilter}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            techniqueFilter: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      >
                        <option value="">All Techniques</option>
                        {filterOptions.techniques.map((technique) => (
                          <option key={technique} value={technique}>
                            {technique}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Patient Status
                      </label>
                      <select
                        value={filters.statusFilter}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            statusFilter: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      >
                        <option value="">All Status</option>
                        {filterOptions.status.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Procedure Filter */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Procedure Type
                      </label>
                      <select
                        value={filters.procedureFilter}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            procedureFilter: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      >
                        <option value="">All Procedures</option>
                        {filterOptions.procedures.map((procedure) => (
                          <option key={procedure} value={procedure}>
                            {procedure}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Payment Type Filter */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Payment Type
                      </label>
                      <select
                        value={filters.paymentTypeFilter}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            paymentTypeFilter: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      >
                        <option value="">All Payment Types</option>
                        {filterOptions.paymentTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Favorites Section */}
            {favorites.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  Favorite Reports
                </h3>
              </div>
            )}

            {/* Reports Grid */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              {sortedReports.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {sortedReports.map((report) => {
                    const Icon = report.icon;
                    const isFavorite = favorites.includes(report.id);
                    const colors = colorConfig[report.color] || colorConfig.blue;
                    
                    return (
                      <div
                        key={report.id}
                        className="relative bg-white border-2 border-gray-200 rounded-xl p-4 sm:p-6 hover:border-indigo-400 hover:shadow-lg transition-all duration-200"
                      >
                        {/* Favorite Button */}
                        <button
                          onClick={() => toggleFavorite(report.id)}
                          className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 sm:p-2 rounded-full hover:bg-gray-100 transition-colors"
                          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                        >
                          <Star 
                            className={`w-4 h-4 sm:w-5 sm:h-5 ${isFavorite ? 'fill-yellow-500 text-yellow-500' : 'text-gray-400'}`}
                          />
                        </button>

                        {/* Report Icon */}
                        <div className={`inline-flex p-2.5 sm:p-3 rounded-xl ${colors.bg} mb-3 sm:mb-4`}>
                          <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${colors.text}`} />
                        </div>

                        {/* Report Info */}
                        <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2 pr-8 line-clamp-2">
                          {report.name}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4 line-clamp-2">
                          {report.description}
                        </p>

                        {/* Category Badge */}
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium mb-3 sm:mb-4 ${
                            report.category === "Patient Reports"
                              ? "bg-blue-100 text-blue-800"
                              : report.category === "Staff Reports"
                              ? "bg-purple-100 text-purple-800"
                              : report.category === "Medical Reports"
                              ? "bg-green-100 text-green-800"
                              : report.category === "Financial Reports"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-indigo-100 text-indigo-800"
                          }`}
                        >
                          {report.category}
                        </span>

                        {/* Download Button */}
                        <button
                          onClick={() => downloadExcel(report.type, report.id, report.name)}
                          disabled={loadingId === report.id}
                          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-colors text-sm"
                        >
                          {loadingId === report.id ? (
                            <>
                              <svg
                                className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              <span className="hidden sm:inline">Downloading...</span>
                              <span className="sm:hidden">Loading...</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                              <span className="hidden sm:inline">Download Excel</span>
                              <span className="sm:hidden">Download</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 sm:py-16">
                  <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                    No reports found
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
                    Try adjusting your search or filters
                  </p>
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}