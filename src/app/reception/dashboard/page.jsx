"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  UserPlus,
  Users,
  IndianRupee,
  Clock,
  CheckCircle,
  TrendingUp,
  Phone,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import ReceptionSidebar from "@/components/ReceptionSidebar";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";


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
      revenue: 0,
    },
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
    // Always use ISO strings and let the server handle timezone conversion
    let fromDate = new Date();
    let toDate = new Date();

    if (timeRange === "Today") {
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);
    } else if (timeRange === "Yesterday") {
      fromDate.setDate(fromDate.getDate() - 1);
      fromDate.setHours(0, 0, 0, 0);
      toDate = new Date(fromDate);
      toDate.setHours(23, 59, 59, 999);
    } else if (timeRange === "Last 7 Days") {
      toDate.setHours(23, 59, 59, 999);
      fromDate = new Date(toDate);
      fromDate.setDate(fromDate.getDate() - 6);
      fromDate.setHours(0, 0, 0, 0);
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
          revenue: 0,
        },
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
    if (trend === undefined || trend === null || trend === 0)
      return "text-gray-600";
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
        <div className={`p-3 rounded-lg bg-linear-to-br ${color}`}>
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
      className={`flex items-center gap-3 p-4 rounded-lg bg-linear-to-r ${color} text-white hover:shadow-lg transition-all`}
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
        params.set("status", "NOT_VISITED");
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
      <div className="flex min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
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
    <div className="flex min-h-screen bg-gray-50">
      <ReceptionSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <main className="flex-1 p-4 lg:p-8">
        <Topbar
        title="Reception Dashboard"
          setSidebarOpen={setSidebarOpen}
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          branch={branch}
          setBranch={setBranch}
          customDates={customDates}
          setCustomDates={setCustomDates}
        />

         
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
              icon={IndianRupee}
              color="from-purple-500 to-purple-600"
              trend={dashboardData.trends?.revenue}
              onClick={() => handleMetricClick("revenue")}
            />
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Quick Actions
            </h2>
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
                icon={IndianRupee}
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
                      <div className="w-12 h-12 rounded-full bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
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
      </main>
    </div>
  );
}
