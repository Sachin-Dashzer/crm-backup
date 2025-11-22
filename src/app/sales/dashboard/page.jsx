"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  TrendingUp,
  Phone,
  CheckCircle,
  XCircle,
  IndianRupee,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Building,
} from "lucide-react";
import SalesSidebar from "../../../components/SalesSidebar";

// Topbar Component (unchanged)
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
                <h2 className="text-lg font-semibold text-gray-900">Sales Overview</h2>
                <p className="text-sm text-gray-600">Real-time performance metrics</p>
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

export default function SalesDashboard() {
  const router = useRouter();
  const [activePage, setActivePage] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [branch, setBranch] = useState("All");
  const [dateRange, setDateRange] = useState("Today");
  const [customDates, setCustomDates] = useState({ from: "", to: "" });

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    totalLeads: 0,
    newPatients: 0,
    contacted: 0,
    converted: 0,
    notConverted: 0,
    revenue: 0,
    activeAgents: 0,
    agentPerformance: [],
    trends: {
      totalLeads: 0,
      newPatients: 0,
      contacted: 0,
      converted: 0,
      revenue: 0
    }
  });

  // Fixed buildPayload function for consistent timezone handling
  const buildPayload = () => {
    // Always use ISO strings and let the server handle timezone conversion
    let fromDate = new Date();
    let toDate = new Date();

    if (dateRange === "Today") {
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);
    } else if (dateRange === "Yesterday") {
      fromDate.setDate(fromDate.getDate() - 1);
      fromDate.setHours(0, 0, 0, 0);
      toDate = new Date(fromDate);
      toDate.setHours(23, 59, 59, 999);
    } else if (dateRange === "Last 7 Days") {
      toDate.setHours(23, 59, 59, 999);
      fromDate = new Date(toDate);
      fromDate.setDate(fromDate.getDate() - 6);
      fromDate.setHours(0, 0, 0, 0);
    } else if (dateRange === "Custom" && customDates.from) {
      fromDate = new Date(customDates.from);
      fromDate.setHours(0, 0, 0, 0);
      toDate = customDates.to ? new Date(customDates.to) : new Date(customDates.from);
      toDate.setHours(23, 59, 59, 999);
    }

    return {
      branch,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    };
  };

  // Fixed API response handling for Vercel
  const fetchData = async () => {
    setLoading(true);
    try {
      const payload = buildPayload();
      console.log('Sending payload to admin API:', payload);
      
      const res = await fetch("/api/sales/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      console.log('Admin API response status:', res.status);
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const responseData = await res.json();
      console.log('Admin API full response:', responseData);
      
      if (responseData.success) {
        setDashboardData(responseData.data);
      } else {
        throw new Error(responseData.error || "Failed to fetch data");
      }
    } catch (err) {
      console.error("Error fetching admin dashboard:", err);
      // Set fallback data
      setDashboardData({
        totalLeads: 0,
        newPatients: 0,
        contacted: 0,
        converted: 0,
        notConverted: 0,
        revenue: 0,
        activeAgents: 0,
        agentPerformance: [],
        trends: {
          totalLeads: 0,
          newPatients: 0,
          contacted: 0,
          converted: 0,
          revenue: 0
        }
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [branch, dateRange, customDates]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

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

  const handleMetricClick = (metricType) => {
    const payload = buildPayload();
    const params = new URLSearchParams({
      branch,
      dateFrom: payload.from,
      dateTo: payload.to,
    });

    switch (metricType) {
      case "totalLeads":
        router.push(`/sales/patients?${params.toString()}`);
        break;
      case "newPatients":
        params.set("status", "NEW");
        router.push(`/sales/patients?${params.toString()}`);
        break;
      case "converted":
        params.set("converted", "true");
        router.push(`/sales/patients?${params.toString()}`);
        break;
      case "notConverted":
        params.set("converted", "false");
        router.push(`/sales/patients?${params.toString()}`);
        break;
      case "revenue":
        router.push(`/sales/revenue?${params.toString()}`);
        break;
      case "agents":
        router.push(`/sales/agents?${params.toString()}`);
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <SalesSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activePage={activePage}
        setActivePage={setActivePage}
      />

      <main className="flex-1 overflow-auto">
        <Topbar
          setSidebarOpen={setSidebarOpen}
          timeRange={dateRange}
          setTimeRange={setDateRange}
          branch={branch}
          setBranch={setBranch}
          customDates={customDates}
          setCustomDates={setCustomDates}
        />

        <div className="p-4 lg:p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Sales Dashboard
            </h1>
            <p className="text-gray-600">
              Track your sales performance and team metrics
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <IndianRupee className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <MetricCard
                  title="Total Appointment"
                  value={dashboardData?.totalLeads || 0}
                  icon={Users}
                  color="from-blue-500 to-blue-600"
                  trend={dashboardData?.trends?.totalLeads}
                  onClick={() => handleMetricClick("totalLeads")}
                />
                <MetricCard
                  title="Not Visited"
                  value={dashboardData?.newPatients || 0}
                  icon={UserPlus}
                  color="from-green-500 to-green-600"
                  trend={dashboardData?.trends?.newPatients}
                  onClick={() => handleMetricClick("newPatients")}
                />
                <MetricCard
                  title="Consulted"
                  value={dashboardData?.contacted || 0}
                  icon={Phone}
                  color="from-purple-500 to-purple-600"
                  trend={dashboardData?.trends?.contacted}
                  onClick={() => handleMetricClick("contacted")}
                />
                <MetricCard
                  title="Active Agents"
                  value={dashboardData?.activeAgents || 0}
                  icon={TrendingUp}
                  color="from-orange-500 to-orange-600"
                  trend={0}
                  onClick={() => handleMetricClick("agents")}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <MetricCard
                  title="Converted Patients"
                  value={dashboardData?.converted || 0}
                  icon={CheckCircle}
                  color="from-teal-500 to-teal-600"
                  trend={dashboardData?.trends?.converted}
                  onClick={() => handleMetricClick("converted")}
                />
                <MetricCard
                  title="Not Converted"
                  value={dashboardData?.notConverted || 0}
                  icon={XCircle}
                  color="from-red-500 to-red-600"
                  trend={0}
                  onClick={() => handleMetricClick("notConverted")}
                />
                <MetricCard
                  title="Total Revenue"
                  value={formatCurrency(dashboardData?.revenue)}
                  icon={IndianRupee}
                  color="from-emerald-500 to-emerald-600"
                  trend={dashboardData?.trends?.revenue}
                  onClick={() => handleMetricClick("revenue")}
                />
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        Agent Performance
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Top performing sales agents
                      </p>
                    </div>
                    <button
                      onClick={() => router.push("/sales/agents")}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                    >
                      View All
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {dashboardData?.agentPerformance?.length > 0 ? (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Agent
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Branch
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Total Leads
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Converted
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Conversion Rate
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {dashboardData.agentPerformance.slice(0, 5).map((agent, index) => (
                          <tr
                            key={index}
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => router.push(`/sales/agents`)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                                  <span className="text-white font-semibold text-sm">
                                    {agent.name?.charAt(0)?.toUpperCase() || "A"}
                                  </span>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {agent.name || "N/A"}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {agent.email || agent.phone || "N/A"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                {agent.branch || "N/A"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-semibold text-gray-900">
                                {agent.totalLeads || 0}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-semibold text-green-600">
                                {agent.converted || 0}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 bg-gray-200 rounded-full h-2.5 max-w-[100px]">
                                  <div
                                    className="bg-gradient-to-r from-green-500 to-emerald-600 h-2.5 rounded-full transition-all"
                                    style={{ width: `${agent.conversionRate || 0}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-semibold text-gray-900 min-w-[45px]">
                                  {agent.conversionRate || 0}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-12">
                      <Users className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">
                        No agent data
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Agent performance will appear here once data is available.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}