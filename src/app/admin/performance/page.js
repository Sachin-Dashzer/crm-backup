"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Users,
  Activity,
  Target,
  Zap,
  Download,
  Award,
  ArrowUp,
  ArrowDown,
  Minus,
  Star,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/Topbar";

export default function PerformancePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState("Performance");

  // Filters
  const [branch, setBranch] = useState("All");
  const [dateRange, setDateRange] = useState("Last 7 Days");
  const [customDates, setCustomDates] = useState({ from: "", to: "" });
  const [selectedProcedure, setSelectedProcedure] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);
  const [chartComponents, setChartComponents] = useState({
    Line: null,
    Bar: null,
    Doughnut: null,
  });

  // Load charts
  useEffect(() => {
    const loadCharts = async () => {
      try {
        const ChartJS = await import("chart.js");
        const { Line, Bar, Doughnut } = await import("react-chartjs-2");

        ChartJS.Chart.register(
          ChartJS.CategoryScale,
          ChartJS.LinearScale,
          ChartJS.BarElement,
          ChartJS.LineElement,
          ChartJS.PointElement,
          ChartJS.ArcElement,
          ChartJS.Title,
          ChartJS.Tooltip,
          ChartJS.Legend
        );

        setChartComponents({ Line, Bar, Doughnut });
      } catch (error) {
        console.error("Error loading charts:", error);
      }
    };
    loadCharts();
  }, []);

  // Fetch real-time data
  useEffect(() => {
    const fetchPerformanceData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/performance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branch,
            dateRange,
            customDates,
            procedure: selectedProcedure,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || "Failed to fetch performance data");
        }

        setPerformanceData(data);
      } catch (error) {
        console.error("Error fetching performance:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPerformanceData();
  }, [branch, dateRange, customDates, selectedProcedure]);

  const { Line, Bar, Doughnut } = chartComponents;

  // Extract real data from API response
  const overallMetrics = performanceData?.overall || performanceData?.metrics || {
    totalRevenue: 0,
    revenueGrowth: 0,
    totalPatients: 0,
    patientGrowth: 0,
    avgRevenue: 0,
    avgGrowth: 0,
    conversionRate: 0,
    conversionGrowth: 0,
  };

  const branchData = performanceData?.branches || performanceData?.branchPerformance || [];
  const procedureData = performanceData?.procedures || performanceData?.procedurePerformance || [];
  const dailyData = performanceData?.daily || performanceData?.dailyStats || [];
  
  const topPerformers = performanceData?.topPerformers || {
    counsellors: performanceData?.topCounsellors || [],
    agents: performanceData?.topAgents || [],
    doctors: performanceData?.topDoctors || [],
  };

  // Calculate totals for doughnut chart
  const procedureTotals = procedureData.reduce((acc, proc) => {
    acc.revenue += proc.revenue || proc.totalRevenue || 0;
    acc.count += proc.count || proc.totalCount || 0;
    return acc;
  }, { revenue: 0, count: 0 });

  // Chart data configurations
  const lineChartData = dailyData.length > 0 ? {
    labels: dailyData.map((d) => {
      const date = new Date(d.date || d._id);
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    }),
    datasets: [
      {
        label: "Revenue (₹)",
        data: dailyData.map((d) => d.revenue || d.totalRevenue || 0),
        borderColor: "rgba(99, 102, 241, 1)",
        backgroundColor: "rgba(99, 102, 241, 0.1)",
        tension: 0.4,
        fill: true,
        borderWidth: 3,
        pointRadius: 4,
        pointBackgroundColor: "rgba(99, 102, 241, 1)",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
      },
      {
        label: "Patients",
        data: dailyData.map((d) => (d.patients || d.totalPatients || 0) * 10000),
        borderColor: "rgba(16, 185, 129, 1)",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        tension: 0.4,
        fill: true,
        borderWidth: 3,
        pointRadius: 4,
        pointBackgroundColor: "rgba(16, 185, 129, 1)",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
      },
    ],
  } : null;

  const barChartData = branchData.length > 0 ? {
    labels: branchData.map((b) => b.name || b.branch || b._id),
    datasets: [
      {
        label: "Revenue (₹)",
        data: branchData.map((b) => b.revenue || b.totalRevenue || 0),
        backgroundColor: [
          "rgba(99, 102, 241, 0.8)",
          "rgba(16, 185, 129, 0.8)",
          "rgba(245, 158, 11, 0.8)",
        ],
        borderRadius: 8,
        barThickness: 60,
      },
    ],
  } : null;

  const procedureDoughnutData = procedureData.length > 0 ? {
    labels: procedureData.map((p) => p.name || p.procedure || p._id),
    datasets: [
      {
        data: procedureData.map((p) => p.revenue || p.totalRevenue || 0),
        backgroundColor: [
          "rgba(99, 102, 241, 0.8)",
          "rgba(16, 185, 129, 0.8)",
          "rgba(245, 158, 11, 0.8)",
          "rgba(239, 68, 68, 0.8)",
          "rgba(168, 85, 247, 0.8)",
          "rgba(59, 130, 246, 0.8)",
        ],
        borderWidth: 0,
      },
    ],
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top",
        labels: {
          color: "#4B5563",
          font: { size: 12, weight: 500 },
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
        cornerRadius: 8,
        titleFont: { size: 13, weight: 600 },
        bodyFont: { size: 12 },
        callbacks: {
          label: (context) => {
            if (context.dataset.label?.includes("Revenue")) {
              return `${context.dataset.label}: ₹${context.raw.toLocaleString('en-IN')}`;
            }
            return `${context.dataset.label}: ${Math.round(context.raw / 10000)}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: "#6B7280",
          font: { size: 11 },
          callback: (value) => `₹${(value / 1000).toFixed(0)}K`,
        },
        grid: { color: "rgba(0, 0, 0, 0.05)" },
      },
      x: {
        ticks: {
          color: "#6B7280",
          font: { size: 11 },
        },
        grid: { display: false },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right",
        labels: {
          color: "#4B5563",
          font: { size: 11 },
          padding: 10,
          boxWidth: 15,
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context) => {
            const value = context.raw;
            const percentage = ((value / procedureTotals.revenue) * 100).toFixed(1);
            return `₹${value.toLocaleString('en-IN')} (${percentage}%)`;
          },
        },
      },
    },
  };

  // Export function with real data
  const exportData = async () => {
    try {
      if (!performanceData) {
        alert("No data available to export");
        return;
      }

      const { utils, writeFile } = await import("xlsx");
      const wb = utils.book_new();

      // Overall Metrics Sheet
      if (overallMetrics) {
        const metricsSheet = utils.json_to_sheet([overallMetrics]);
        utils.book_append_sheet(wb, metricsSheet, "Overall Metrics");
      }

      // Branch Performance Sheet
      if (branchData.length > 0) {
        const branchSheet = utils.json_to_sheet(branchData);
        utils.book_append_sheet(wb, branchSheet, "Branch Performance");
      }

      // Procedure Performance Sheet
      if (procedureData.length > 0) {
        const procedureSheet = utils.json_to_sheet(procedureData);
        utils.book_append_sheet(wb, procedureSheet, "Procedure Performance");
      }

      // Daily Data Sheet
      if (dailyData.length > 0) {
        const dailySheet = utils.json_to_sheet(dailyData);
        utils.book_append_sheet(wb, dailySheet, "Daily Performance");
      }

      // Top Performers Sheets
      if (topPerformers.counsellors?.length > 0) {
        const counsellorSheet = utils.json_to_sheet(topPerformers.counsellors);
        utils.book_append_sheet(wb, counsellorSheet, "Top Counsellors");
      }

      if (topPerformers.agents?.length > 0) {
        const agentSheet = utils.json_to_sheet(topPerformers.agents);
        utils.book_append_sheet(wb, agentSheet, "Top Agents");
      }

      if (topPerformers.doctors?.length > 0) {
        const doctorSheet = utils.json_to_sheet(topPerformers.doctors);
        utils.book_append_sheet(wb, doctorSheet, "Top Doctors");
      }

      const fileName = `Performance_Report_${branch}_${dateRange}_${new Date().toISOString().split("T")[0]}.xlsx`;
      writeFile(wb, fileName);

      alert(`✓ Report exported successfully: ${fileName}`);
    } catch (error) {
      console.error("Export error:", error);
      alert(`✗ Failed to export report: ${error.message}`);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          activePage={activePage}
          setActivePage={setActivePage}
        />
        <main className="flex-1 p-4 lg:p-8">
          <div className="flex justify-center items-center h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-500 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading performance data...</p>
              <p className="text-gray-500 text-sm mt-2">
                {branch !== "All" ? `Branch: ${branch}` : "All Branches"} • {dateRange}
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          activePage={activePage}
          setActivePage={setActivePage}
        />
        <main className="flex-1 p-4 lg:p-8">
          <div className="flex justify-center items-center h-screen">
            <div className="text-center max-w-md">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Data</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // No data state
  if (!performanceData || (!branchData.length && !procedureData.length && !dailyData.length)) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          activePage={activePage}
          setActivePage={setActivePage}
        />
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8">
            <Topbar
              title="Performance Analytics"
              setSidebarOpen={setSidebarOpen}
              timeRange={dateRange}
              setTimeRange={setDateRange}
              branch={branch}
              setBranch={setBranch}
              customDates={customDates}
              setCustomDates={setCustomDates}
            />
            <div className="flex justify-center items-center h-96">
              <div className="text-center">
                <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Data Available</h3>
                <p className="text-gray-600 mb-4">
                  No performance data found for the selected filters.
                </p>
                <p className="text-sm text-gray-500">
                  Try adjusting your date range or branch selection.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activePage={activePage}
        setActivePage={setActivePage}
      />

      <main className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Topbar with Export */}
          <div className="mb-6">
            <Topbar
              title="Performance Analytics"
              setSidebarOpen={setSidebarOpen}
              timeRange={dateRange}
              setTimeRange={setDateRange}
              branch={branch}
              setBranch={setBranch}
              customDates={customDates}
              setCustomDates={setCustomDates}
            />
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={exportData}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
              >
                <Download className="w-4 h-4" />
                Export Report
              </button>
              <div className="text-xs text-gray-500">
                Last updated: {new Date().toLocaleTimeString('en-IN')}
              </div>
            </div>
          </div>

          {/* Overall Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <MetricCard
              title="Total Revenue"
              value={`₹${(overallMetrics.totalRevenue / 1000).toFixed(0)}K`}
              change={overallMetrics.revenueGrowth || 0}
              icon={IndianRupee}
              color="indigo"
            />
            <MetricCard
              title="Total Patients"
              value={overallMetrics.totalPatients || 0}
              change={overallMetrics.patientGrowth || 0}
              icon={Users}
              color="green"
            />
            <MetricCard
              title="Avg Revenue"
              value={`₹${((overallMetrics.avgRevenue || 0) / 1000).toFixed(0)}K`}
              change={overallMetrics.avgGrowth || 0}
              icon={Activity}
              color="purple"
            />
            <MetricCard
              title="Conversion Rate"
              value={`${(overallMetrics.conversionRate || 0).toFixed(1)}%`}
              change={overallMetrics.conversionGrowth || 0}
              icon={Target}
              color="orange"
            />
          </div>

          {/* Branch Performance Cards */}
          {branchData.length > 0 && (
            <div className="mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Zap className="w-6 h-6 text-indigo-600" />
                Branch Performance
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {branchData.map((branchItem, index) => {
                  const branchName = branchItem.name || branchItem.branch || branchItem._id;
                  const branchRevenue = branchItem.revenue || branchItem.totalRevenue || 0;
                  const branchPatients = branchItem.patients || branchItem.totalPatients || 0;
                  const branchGrowth = branchItem.growth || branchItem.revenueGrowth || 0;
                  const branchSurgeries = branchItem.surgeries || branchItem.totalSurgeries || 0;
                  const branchConversion = branchItem.conversionRate || branchItem.conversion || 0;

                  return (
                    <div
                      key={branchName}
                      className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100"
                    >
                      {/* linear Top Border */}
                      <div
                        className={`h-1.5 bg-linear-to-r ${
                          index === 0
                            ? "from-indigo-500 to-purple-500"
                            : index === 1
                            ? "from-green-500 to-teal-500"
                            : "from-orange-500 to-red-500"
                        }`}
                      />

                      <div className="p-6">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                              {branchName}
                            </p>
                            <h3 className="text-3xl font-bold text-gray-900 mt-2">
                              ₹{(branchRevenue / 1000).toFixed(0)}K
                            </h3>
                          </div>
                          <div
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                              branchGrowth > 0
                                ? "bg-green-100 text-green-700"
                                : branchGrowth < 0
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {branchGrowth > 0 ? (
                              <ArrowUp className="w-4 h-4" />
                            ) : branchGrowth < 0 ? (
                              <ArrowDown className="w-4 h-4" />
                            ) : (
                              <Minus className="w-4 h-4" />
                            )}
                            {Math.abs(branchGrowth).toFixed(1)}%
                          </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-gray-900">{branchPatients}</p>
                            <p className="text-xs text-gray-500 mt-1">Patients</p>
                          </div>
                          <div className="text-center border-x border-gray-200">
                            <p className="text-2xl font-bold text-gray-900">{branchSurgeries}</p>
                            <p className="text-xs text-gray-500 mt-1">Surgeries</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-gray-900">
                              {branchConversion.toFixed(0)}%
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Conversion</p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-6">
                          <div className="flex justify-between text-xs text-gray-600 mb-2">
                            <span>Performance</span>
                            <span>{branchConversion.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                index === 0
                                  ? "bg-linear-to-r from-indigo-500 to-purple-500"
                                  : index === 1
                                  ? "bg-linear-to-r from-green-500 to-teal-500"
                                  : "bg-linear-to-r from-orange-500 to-red-500"
                              }`}
                              style={{ width: `${Math.min(branchConversion, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {/* Daily Trend Chart */}
            {dailyData.length > 0 && (
              <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">
                    Daily Performance Trend
                  </h2>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-indigo-500" />
                      <span className="text-xs text-gray-600 hidden sm:inline">Revenue</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-xs text-gray-600 hidden sm:inline">Patients</span>
                    </div>
                  </div>
                </div>
                <div className="h-64 sm:h-80">
                  {Line && lineChartData ? (
                    <Line data={lineChartData} options={chartOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No chart data available
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Branch Comparison Chart */}
            {branchData.length > 0 && (
              <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-100">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-4">
                  Branch Revenue Comparison
                </h2>
                <div className="h-64 sm:h-80">
                  {Bar && barChartData ? (
                    <Bar data={barChartData} options={chartOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No chart data available
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Procedure Distribution */}
          {procedureData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
              {/* Doughnut Chart */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-100">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-4">
                  Revenue Distribution
                </h2>
                <div className="h-64">
                  {Doughnut && procedureDoughnutData ? (
                    <Doughnut data={procedureDoughnutData} options={doughnutOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No chart data available
                    </div>
                  )}
                </div>
              </div>

              {/* Procedure Table */}
              <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">
                    Procedure Performance
                  </h2>
                  <select
                    value={selectedProcedure}
                    onChange={(e) => setSelectedProcedure(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="all">All Procedures</option>
                    <option value="sapphire fue">Sapphire FUE</option>
                    <option value="dhi">DHI</option>
                    <option value="turkish dhi">Turkish DHI</option>
                    <option value="prp">PRP</option>
                    <option value="beard transplant">Beard Transplant</option>
                    <option value="medicine">Medicine</option>
                  </select>
                </div>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Procedure
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Count
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider hidden sm:table-cell">
                            Revenue
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Avg/Patient
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">
                            Growth
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {procedureData.map((proc, index) => {
                          const procName = proc.name || proc.procedure || proc._id;
                          const procCount = proc.count || proc.totalCount || 0;
                          const procRevenue = proc.revenue || proc.totalRevenue || 0;
                          const procAvg = procCount > 0 ? procRevenue / procCount : 0;
                          const procGrowth = proc.growth || proc.revenueGrowth || 0;

                          return (
                            <tr key={procName} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-2 h-2 rounded-full ${
                                      index === 0
                                        ? "bg-indigo-500"
                                        : index === 1
                                        ? "bg-green-500"
                                        : index === 2
                                        ? "bg-orange-500"
                                        : index === 3
                                        ? "bg-red-500"
                                        : index === 4
                                        ? "bg-purple-500"
                                        : "bg-blue-500"
                                    }`}
                                  />
                                  <span className="text-sm font-medium text-gray-900">
                                    {procName}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm font-semibold text-gray-900">
                                  {procCount}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right hidden sm:table-cell">
                                <span className="text-sm font-medium text-gray-900">
                                  ₹{(procRevenue / 1000).toFixed(0)}K
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm font-medium text-gray-900">
                                  ₹{(procAvg / 1000).toFixed(1)}K
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right hidden md:table-cell">
                                <span
                                  className={`inline-flex items-center gap-1 text-xs font-semibold ${
                                    procGrowth > 0
                                      ? "text-green-600"
                                      : procGrowth < 0
                                      ? "text-red-600"
                                      : "text-gray-600"
                                  }`}
                                >
                                  {procGrowth > 0 ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : procGrowth < 0 ? (
                                    <ArrowDown className="w-3 h-3" />
                                  ) : (
                                    <Minus className="w-3 h-3" />
                                  )}
                                  {Math.abs(procGrowth).toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top Performers Section */}
          {(topPerformers.counsellors?.length > 0 ||
            topPerformers.agents?.length > 0 ||
            topPerformers.doctors?.length > 0) && (
            <div className="mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Award className="w-6 h-6 text-yellow-500" />
                Top Performers
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Top Counsellors */}
                {topPerformers.counsellors?.length > 0 && (
                  <TopPerformerCard
                    title="Top Counsellors"
                    icon={Users}
                    color="indigo"
                    performers={topPerformers.counsellors}
                    metricKey="revenue"
                    metricLabel="Revenue"
                    metricFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                    secondaryKey="conversion"
                    secondaryLabel="Conv"
                  />
                )}

                {/* Top Agents */}
                {topPerformers.agents?.length > 0 && (
                  <TopPerformerCard
                    title="Top Referral Agents"
                    icon={Target}
                    color="green"
                    performers={topPerformers.agents}
                    metricKey="conversions"
                    metricLabel="Conversions"
                    metricFormatter={(value) => value}
                    secondaryKey="rate"
                    secondaryLabel="Rate"
                  />
                )}

                {/* Top Doctors */}
                {topPerformers.doctors?.length > 0 && (
                  <TopPerformerCard
                    title="Top Surgeons"
                    icon={Activity}
                    color="purple"
                    performers={topPerformers.doctors}
                    metricKey="surgeries"
                    metricLabel="Surgeries"
                    metricFormatter={(value) => value}
                    secondaryKey="rating"
                    secondaryLabel="Rating"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Reusable Metric Card Component
function MetricCard({ title, value, change, icon: Icon, color }) {
  const colorClasses = {
    indigo: "from-indigo-500 to-purple-500",
    green: "from-green-500 to-teal-500",
    purple: "from-purple-500 to-pink-500",
    orange: "from-orange-500 to-red-500",
  };

  return (
    <div className="relative bg-white rounded-2xl shadow-lg p-4 sm:p-6 overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 group">
      {/* linear Background */}
      <div
        className={`absolute top-0 right-0 w-24 h-24 bg-linear-to-br ${colorClasses[color]} opacity-10 rounded-bl-full transform group-hover:scale-150 transition-transform duration-500`}
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div
            className={`p-2.5 sm:p-3 rounded-xl bg-linear-to-br ${colorClasses[color]} bg-opacity-10`}
          >
            <Icon className={`w-5 h-5 sm:w-6 sm:h-6 text-${color}-600`} />
          </div>
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
              change > 0
                ? "bg-green-100 text-green-700"
                : change < 0
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {change > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : change < 0 ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            {Math.abs(change).toFixed(1)}%
          </div>
        </div>
        <p className="text-xs sm:text-sm text-gray-500 font-medium mb-1">{title}</p>
        <p className="text-2xl sm:text-3xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

// Top Performer Card Component
function TopPerformerCard({
  title,
  icon: Icon,
  color,
  performers,
  metricKey,
  metricLabel,
  metricFormatter,
  secondaryKey,
  secondaryLabel,
}) {
  const colorClasses = {
    indigo: "from-indigo-500 to-purple-500",
    green: "from-green-500 to-teal-500",
    purple: "from-purple-500 to-pink-500",
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-100">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div
          className={`p-2.5 rounded-xl bg-linear-to-br ${colorClasses[color]} bg-opacity-10`}
        >
          <Icon className={`w-5 h-5 text-${color}-600`} />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-gray-900">{title}</h3>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {performers.slice(0, 3).map((performer, index) => {
          const performerName = performer.name || performer._id;
          const metricValue = performer[metricKey] || 0;
          const secondaryValue = performer[secondaryKey] || 0;

          return (
            <div
              key={performerName}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              {/* Rank Badge */}
              <div
                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  index === 0
                    ? "bg-yellow-100 text-yellow-700"
                    : index === 1
                    ? "bg-gray-100 text-gray-700"
                    : "bg-orange-100 text-orange-700"
                }`}
              >
                {index === 0 && <Star className="w-4 h-4 fill-current" />}
                {index !== 0 && index + 1}
              </div>

              {/* Performer Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {performerName}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-600">
                    {metricLabel}:{" "}
                    <span className="font-semibold text-gray-900">
                      {metricFormatter(metricValue)}
                    </span>
                  </span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-600">
                    {secondaryLabel}:{" "}
                    <span className="font-semibold text-gray-900">
                      {secondaryValue}
                      {secondaryKey === "rate" || secondaryKey === "conversion"
                        ? "%"
                        : secondaryKey === "rating"
                        ? "★"
                        : ""}
                    </span>
                  </span>
                </div>
              </div>

              {/* Arrow */}
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
}