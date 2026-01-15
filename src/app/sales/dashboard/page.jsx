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
} from "lucide-react";
import Topbar from "@/components/Topbar";
import SalesSidebar from "../../../components/Sidebars/SalesSidebar";



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
      
      const res = await fetch("/api/sales/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const responseData = await res.json();
      
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
    <div className="flex min-h-screen bg-gray-50">
      <SalesSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activePage={activePage}
        setActivePage={setActivePage}
      />

      <main className="flex-1 p-4 lg:p-8">
        <Topbar
          title={"Sales Dashboard"}
          setSidebarOpen={setSidebarOpen}
          timeRange={dateRange}
          setTimeRange={setDateRange}
          branch={branch}
          setBranch={setBranch}
          customDates={customDates}
          setCustomDates={setCustomDates}
        />

         
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
                <div className="px-6 py-5 border-b border-gray-100 bg-linear-to-r from-indigo-50 to-purple-50">
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
                                <div className="shrink-0 h-10 w-10 bg-linear-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
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
                                <div className="flex-1 bg-gray-200 rounded-full h-2.5 max-w-25">
                                  <div
                                    className="bg-linear-to-r from-green-500 to-emerald-600 h-2.5 rounded-full transition-all"
                                    style={{ width: `${agent.conversionRate || 0}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-semibold text-gray-900 min-w-11.25">
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
      </main>
    </div>
  );
}