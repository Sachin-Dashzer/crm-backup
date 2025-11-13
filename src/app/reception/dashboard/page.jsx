"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  UserPlus,
  Users,
  DollarSign,
  Clock,
  CheckCircle,
  TrendingUp,
  Phone,
  Filter,
  Building,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import ReceptionSidebar from "@/components/ReceptionSidebar";
import { useToast } from "@/components/Toast";

// Topbar Component with Filters
const Topbar = ({ 
  setSidebarOpen, 
  timeRange, 
  setTimeRange, 
  branch, 
  setBranch, 
  customDates, 
  setCustomDates 
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleCustomDateChange = (field, value) => {
    setCustomDates(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const applyCustomDate = () => {
    if (customDates.from) {
      setTimeRange("Custom");
      setShowDatePicker(false);
    }
  };

  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-4 lg:px-8 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <Filter className="h-5 w-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-3">
              <Building className="h-6 w-6 text-indigo-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Reception Overview</h2>
                <p className="text-sm text-gray-600">Patient management and appointments</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Branch:
              </label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              >
                <option value="All">All Branches</option>
                <option value="Delhi">Delhi</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Hyderabad">Hyderabad</option>
              </select>
            </div>

            <div className="flex items-center gap-2 relative">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Date Range:
              </label>
              <select
                value={timeRange}
                onChange={(e) => {
                  setTimeRange(e.target.value);
                  if (e.target.value !== "Custom") {
                    setShowDatePicker(false);
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              >
                <option value="Today">Today</option>
                <option value="Yesterday">Yesterday</option>
                <option value="Last 7 Days">Last 7 Days</option>
                <option value="Custom">Custom Range</option>
              </select>

              {timeRange === "Custom" && (
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                >
                  <Calendar className="h-4 w-4" />
                </button>
              )}

              {showDatePicker && (
                <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-10 min-w-[300px]">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        From Date
                      </label>
                      <input
                        type="date"
                        value={customDates.from}
                        onChange={(e) => handleCustomDateChange("from", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        To Date
                      </label>
                      <input
                        type="date"
                        value={customDates.to}
                        onChange={(e) => handleCustomDateChange("to", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={applyCustomDate}
                        className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => setShowDatePicker(false)}
                        className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ReceptionDashboard() {
  const router = useRouter();
  const toast = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Filter states
  const [branch, setBranch] = useState("All");
  const [timeRange, setTimeRange] = useState("Today");
  const [customDates, setCustomDates] = useState({ from: "", to: "" });
  
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    todayAppointments: 0,
    todayVisits: 0,
    pendingAppointments: 0,
    totalPatients: 0,
    todayRevenue: 0,
    recentPatients: [],
    upcomingAppointments: [],
    trends: {
      appointments: 0,
      visits: 0,
      revenue: 0
    }
  });

  // Date helpers (same as sales dashboard)
  const getToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getWeekRange = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const last7 = new Date();
    last7.setDate(today.getDate() - 6);
    last7.setHours(0, 0, 0, 0);
    return { from: last7, to: today };
  };

  const buildPayload = () => {
    let fromDate = getToday();
    let toDate = new Date();
    toDate.setHours(23, 59, 59, 999);

    if (timeRange === "Yesterday") {
      fromDate = getYesterday();
      toDate = getYesterday();
      toDate.setHours(23, 59, 59, 999);
    } else if (timeRange === "Last 7 Days") {
      const { from, to } = getWeekRange();
      fromDate = from;
      toDate = to;
    } else if (timeRange === "Custom" && customDates.from) {
      fromDate = new Date(customDates.from);
      fromDate.setHours(0, 0, 0, 0);
      toDate = customDates.to
        ? new Date(customDates.to)
        : new Date(customDates.from);
      toDate.setHours(23, 59, 59, 999);
    }

    return {
      branch,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    };
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const payload = buildPayload();
      const res = await fetch("/api/reception/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      
      const responseData = await res.json();
      
      if (responseData.success) {
        setDashboardData(responseData.data);
      } else {
        throw new Error(responseData.error || "Failed to fetch data");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load dashboard data");
      // Set fallback data
      setDashboardData({
        todayAppointments: 0,
        todayVisits: 0,
        pendingAppointments: 0,
        totalPatients: 0,
        todayRevenue: 0,
        recentPatients: [],
        upcomingAppointments: [],
        trends: {
          appointments: 0,
          visits: 0,
          revenue: 0
        }
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [branch, timeRange, customDates]);

  // Trend display helpers
  const getTrendIcon = (trend) => {
    if (trend === undefined || trend === null || trend === 0) return null;
    const isPositive = trend >= 0;
    return isPositive ? (
      <ArrowUpRight className="h-4 w-4 text-green-600" />
    ) : (
      <ArrowDownRight className="h-4 w-4 text-red-600" />
    );
  };

  const getTrendColor = (trend) => {
    if (trend === undefined || trend === null || trend === 0) return "text-gray-600";
    return trend >= 0 ? "text-green-600" : "text-red-600";
  };

  const formatTrendDisplay = (trend) => {
    if (trend === undefined || trend === null) return "0%";
    const sign = trend >= 0 ? "+" : "";
    return `${sign}${trend}%`;
  };

  const MetricCard = ({ title, value, icon: Icon, color, trend, onClick }) => (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm p-6 border border-gray-100 transition-all hover:shadow-md ${
        onClick ? "cursor-pointer hover:scale-105" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg bg-gradient-to-br ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        {trend !== undefined && trend !== null && (
          <div className="flex items-center gap-1">
            {getTrendIcon(trend)}
            <span className={`text-sm font-semibold ${getTrendColor(trend)}`}>
              {formatTrendDisplay(trend)}
            </span>
          </div>
        )}
      </div>
      <h3 className="text-gray-600 text-sm font-medium mb-1">{title}</h3>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );

  const QuickAction = ({ title, icon: Icon, color, onClick }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r ${color} text-white hover:shadow-lg transition-all`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{title}</span>
    </button>
  );

  const handleMetricClick = (metricType) => {
    const payload = buildPayload();
    const params = new URLSearchParams({
      branch,
      dateFrom: payload.from,
      dateTo: payload.to,
    });

    switch (metricType) {
      case "appointments":
        router.push(`/reception/patients?${params.toString()}`);
        break;
      case "visits":
        params.set("visited", "true");
        router.push(`/reception/patients?${params.toString()}`);
        break;
      case "pending":
        params.set("pending", "true");
        router.push(`/reception/patients?${params.toString()}`);
        break;
      case "revenue":
        router.push(`/reception/transactions?${params.toString()}`);
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <ReceptionSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <Users className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <ReceptionSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <main className="flex-1 overflow-auto">
        <Topbar
          setSidebarOpen={setSidebarOpen}
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          branch={branch}
          setBranch={setBranch}
          customDates={customDates}
          setCustomDates={setCustomDates}
        />

        <div className="p-4 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Reception Dashboard
            </h1>
            <p className="text-gray-600">
              Welcome back! Here's what's happening today.
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Today's Appointments"
              value={dashboardData.todayAppointments}
              icon={Calendar}
              color="from-blue-500 to-blue-600"
              trend={dashboardData.trends?.appointments}
              onClick={() => handleMetricClick("appointments")}
            />
            <MetricCard
              title="Patients Visited"
              value={dashboardData.todayVisits}
              icon={CheckCircle}
              color="from-green-500 to-green-600"
              trend={dashboardData.trends?.visits}
              onClick={() => handleMetricClick("visits")}
            />
            <MetricCard
              title="Pending Appointments"
              value={dashboardData.pendingAppointments}
              icon={Clock}
              color="from-amber-500 to-amber-600"
              onClick={() => handleMetricClick("pending")}
            />
            <MetricCard
              title="Today's Revenue"
              value={`₹${dashboardData.todayRevenue.toLocaleString()}`}
              icon={DollarSign}
              color="from-purple-500 to-purple-600"
              trend={dashboardData.trends?.revenue}
              onClick={() => handleMetricClick("revenue")}
            />
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <QuickAction
                title="Add New Patient"
                icon={UserPlus}
                color="from-indigo-500 to-indigo-600"
                onClick={() => router.push("/reception/add-patient")}
              />
              <QuickAction
                title="View All Patients"
                icon={Users}
                color="from-blue-500 to-blue-600"
                onClick={() => router.push("/reception/patients")}
              />
              <QuickAction
                title="Create Bill"
                icon={DollarSign}
                color="from-green-500 to-green-600"
                onClick={() => router.push("/reception/create-bill")}
              />
              <QuickAction
                title="All Transaction"
                icon={TrendingUp}
                color="from-purple-500 to-purple-600"
                onClick={() => router.push("/reception/transactions")}
              />
            </div>
          </div>

          {/* Recent Patients & Upcoming Appointments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Patients */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Recent Patients
              </h3>
              <div className="space-y-3">
                {dashboardData.recentPatients.length > 0 ? (
                  dashboardData.recentPatients.map((patient) => (
                    <div
                      key={patient._id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() =>
                        router.push(`/reception/patients/${patient._id}`)
                      }
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {patient.personal?.name}
                        </p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-gray-600 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {patient.personal?.phone}
                          </span>
                          <span className="text-xs text-gray-600">
                            {patient.personal?.branch}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          patient.ops?.status === "NEW"
                            ? "bg-blue-100 text-blue-700"
                            : patient.ops?.status === "CONSULTED"
                            ? "bg-green-100 text-green-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {patient.ops?.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    No recent patients
                  </p>
                )}
              </div>
            </div>

            {/* Upcoming Appointments */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Upcoming Appointments
              </h3>
              <div className="space-y-3">
                {dashboardData.upcomingAppointments.length > 0 ? (
                  dashboardData.upcomingAppointments.map((appointment) => (
                    <div
                      key={appointment._id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() =>
                        router.push(`/reception/patients/${appointment._id}`)
                      }
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {appointment.personal?.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(
                            appointment.personal?.visitDate
                          ).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {appointment.personal?.branch}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    No upcoming appointments
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}