"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
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
  const [performanceData, setPerformanceData] = useState(null);
  const [chartComponents, setChartComponents] = useState({
    Line: null,
    Bar: null,
  });

  // Load charts
  useEffect(() => {
    const loadCharts = async () => {
      try {
        const ChartJS = await import("chart.js");
        const { Line, Bar } = await import("react-chartjs-2");

        ChartJS.Chart.register(
          ChartJS.CategoryScale,
          ChartJS.LinearScale,
          ChartJS.BarElement,
          ChartJS.LineElement,
          ChartJS.PointElement,
          ChartJS.Title,
          ChartJS.Tooltip,
          ChartJS.Legend
        );

        setChartComponents({ Line, Bar });
      } catch (error) {
        console.error("Error loading charts:", error);
      }
    };
    loadCharts();
  }, []);

  const fetchPerformanceData = async () => {
    setLoading(true);
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
      const data = await response.json();
      setPerformanceData(data);
    } catch (error) {
      console.error("Error fetching performance:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data
  useEffect(() => {
    fetchPerformanceData();
  }, [branch, dateRange, customDates, selectedProcedure]);

  const { Line, Bar } = chartComponents;

  // Sample data - replace with actual API data
  const branchData = performanceData?.branches || [
    { name: "Delhi", revenue: 450000, patients: 45, growth: 12 },
    { name: "Mumbai", revenue: 380000, patients: 38, growth: 8 },
    { name: "Hyderabad", revenue: 320000, patients: 32, growth: -5 },
  ];

  const procedureData = performanceData?.procedures || [
    { name: "Hair Transplant", count: 85, revenue: 850000 },
    { name: "PRP", count: 120, revenue: 180000 },
    { name: "Beard Transplant", count: 25, revenue: 200000 },
    { name: "Medicine", count: 200, revenue: 150000 },
  ];

  const dailyData = performanceData?.daily || [
    { date: "Oct 25", revenue: 45000 },
    { date: "Oct 26", revenue: 52000 },
    { date: "Oct 27", revenue: 48000 },
    { date: "Oct 28", revenue: 65000 },
    { date: "Oct 29", revenue: 58000 },
    { date: "Oct 30", revenue: 72000 },
    { date: "Oct 31", revenue: 68000 },
  ];

  // Chart data
  const lineChartData = {
    labels: dailyData.map((d) => d.date),
    datasets: [
      {
        label: "Daily Revenue (₹)",
        data: dailyData.map((d) => d.revenue),
        borderColor: "rgba(99,102,241,1)",
        backgroundColor: "rgba(99,102,241,0.1)",
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const barChartData = {
    labels: branchData.map((b) => b.name),
    datasets: [
      {
        label: "Revenue (₹)",
        data: branchData.map((b) => b.revenue),
        backgroundColor: [
          "rgba(99,102,241,0.8)",
          "rgba(16,185,129,0.8)",
          "rgba(245,158,11,0.8)",
        ],
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `₹${context.raw.toLocaleString()}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: "#4B5563" },
        grid: { color: "#F3F4F6" },
      },
      x: { ticks: { color: "#4B5563" }, grid: { display: false } },
    },
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activePage={activePage}
        setActivePage={setActivePage}
      />

      <main className="flex-1 p-4 lg:p-8">
        <Topbar
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
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <>
            {/* Branch Performance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {branchData.map((branch) => (
                <div
                  key={branch.name}
                  className="bg-white p-6 rounded-2xl shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-gray-500 text-sm">{branch.name}</p>
                      <h3 className="text-2xl font-bold text-gray-800 mt-1">
                        ₹{(branch.revenue / 1000).toFixed(0)}K
                      </h3>
                    </div>
                    <div
                      className={`flex items-center gap-1 text-sm ${
                        branch.growth > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {branch.growth > 0 ? (
                        <TrendingUp size={16} />
                      ) : (
                        <TrendingDown size={16} />
                      )}
                      {Math.abs(branch.growth)}%
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm">
                    {branch.patients} patients
                  </p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Daily Revenue Chart */}
              <div className="bg-white p-6 rounded-2xl shadow">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Daily Revenue
                </h2>
                <div className="h-64">
                  {Line ? (
                    <Line data={lineChartData} options={chartOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      Loading Chart...
                    </div>
                  )}
                </div>
              </div>

              {/* Branch Comparison Chart */}
              <div className="bg-white p-6 rounded-2xl shadow">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Branch Comparison
                </h2>
                <div className="h-64">
                  {Bar ? (
                    <Bar data={barChartData} options={chartOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      Loading Chart...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Procedure Performance Table */}
            <div className="bg-white p-6 rounded-2xl shadow">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">
                  Procedure Performance
                </h2>
                <select
                  value={selectedProcedure}
                  onChange={(e) => setSelectedProcedure(e.target.value)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="all">All Procedures</option>
                  <option value="hair transplant">Hair Transplant</option>
                  <option value="prp">PRP</option>
                  <option value="beard transplant">Beard Transplant</option>
                  <option value="medicine">Medicine</option>
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-gray-600 font-medium">
                        Procedure
                      </th>
                      <th className="text-right py-3 px-4 text-gray-600 font-medium">
                        Count
                      </th>
                      <th className="text-right py-3 px-4 text-gray-600 font-medium">
                        Revenue
                      </th>
                      <th className="text-right py-3 px-4 text-gray-600 font-medium">
                        Avg/Patient
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {procedureData.map((proc) => (
                      <tr key={proc.name} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-800">{proc.name}</td>
                        <td className="py-3 px-4 text-right text-gray-800">
                          {proc.count}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-800">
                          ₹{proc.revenue.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-800">
                          ₹{(proc.revenue / proc.count).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
