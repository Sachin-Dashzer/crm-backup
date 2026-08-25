"use client";

import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";

export default function ChartsSection({ data }) {
  const [chartComponents, setChartComponents] = useState({
    Bar: null,
    Line: null,
    Doughnut: null,
  });
  const [activeChart, setActiveChart] = useState("weekly"); // "weekly" | "monthly" | "methods"

  useEffect(() => {
    const loadCharts = async () => {
      try {
        const ChartJS = await import("chart.js");
        const { Bar, Line, Doughnut } = await import("react-chartjs-2");

        ChartJS.Chart.register(
          ChartJS.CategoryScale,
          ChartJS.LinearScale,
          ChartJS.BarElement,
          ChartJS.LineElement,
          ChartJS.PointElement,
          ChartJS.Title,
          ChartJS.Tooltip,
          ChartJS.Legend,
          ChartJS.ArcElement
        );

        setChartComponents({ Bar, Line, Doughnut });
      } catch (error) {
        console.error("Error loading charts:", error);
      }
    };
    loadCharts();
  }, []);

  const { Bar, Line, Doughnut } = chartComponents;

  if (!data?.last7Days || !data?.last30Days) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow">
          <div className="text-gray-500">Loading data...</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow">
          <div className="text-gray-500">Loading data...</div>
        </div>
      </div>
    );
  }

  // Format label helper
  const formatDateLabel = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  /* ---------------- Weekly & Monthly Line Data ---------------- */
  const weeklyLineData = {
    labels: data.last7Days.perDay.map((d) => formatDateLabel(d.date)),
    datasets: [
      {
        label: "Daily Revenue (₹)",
        data: data.last7Days.perDay.map((d) => d.total),
        borderColor: "rgba(99,102,241,1)",
        backgroundColor: "rgba(99,102,241,0.2)",
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const monthlyLineData = {
    labels: data.last30Days.perDay.map((d) => formatDateLabel(d.date)),
    datasets: [
      {
        label: "Daily Revenue (₹)",
        data: data.last30Days.perDay.map((d) => d.total),
        borderColor: "rgba(16,185,129,1)",
        backgroundColor: "rgba(16,185,129,0.2)",
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const lineOptions = {
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

  /* ---------------- Method Bar Data ---------------- */
  const methodData = {
    labels: data.last7Days.amountByMethod.map((m) => m.method),
    datasets: [
      {
        label: "Revenue (₹)",
        data: data.last7Days.amountByMethod.map((m) => m.total),
        backgroundColor: [
          "rgba(99,102,241,0.8)",
          "rgba(139,92,246,0.8)",
          "rgba(236,72,153,0.8)",
          "rgba(239,68,68,0.8)",
        ],
        borderRadius: 6,
      },
    ],
  };

  const barOptions = {
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
      y: { ticks: { color: "#4B5563" }, grid: { color: "#F3F4F6" } },
      x: { ticks: { color: "#4B5563" }, grid: { display: false } },
    },
  };

  /* ---------------- Technique Doughnut Data ---------------- */
  const doughnutData = {
    labels: data.amountByTechnique.map((t) => t.method),
    datasets: [
      {
        data: data.amountByTechnique.map((t) => t.total),
        backgroundColor: [
          "rgba(59, 130, 246, 0.8)", // Professional blue (medical)
          "rgba(16, 185, 129, 0.8)", // Healthcare green (growth/health)
          "rgba(19, 92, 246, 0.8)", // Medical purple (specialty)
          "rgba(245, 158, 11, 0.8)", // Warning amber (surgery ready)
          "rgba(239, 68, 68, 0.8)", // Alert red (important notices)
          "rgba(6, 182, 212, 0.8)", // Teal (clean/sterile)
        ],
        borderWidth: 0,
        hoverOffset: 12,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          padding: 20,
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 8,
          font: { size: 11 },
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || "";
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${label}: ₹${value.toLocaleString()} (${percentage}%)`;
          },
        },
      },
    },
    cutout: "70%",
  };

  // Calculate total for technique chart
  const totalTechniqueRevenue = data.amountByTechnique.reduce(
    (sum, tech) => sum + tech.total,
    0
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      {/* Main Chart */}
      <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-800">
            Revenue Trends
          </h2>
          <div className="flex space-x-2">
            <button
              className={`px-3 py-1 rounded-md text-sm ${
                activeChart === "weekly"
                  ? "bg-indigo-100 text-indigo-700"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
              onClick={() => setActiveChart("weekly")}
            >
              Weekly
            </button>
            <button
              className={`px-3 py-1 rounded-md text-sm ${
                activeChart === "monthly"
                  ? "bg-indigo-100 text-indigo-700"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
              onClick={() => setActiveChart("monthly")}
            >
              Monthly
            </button>
            <button
              className={`px-3 py-1 rounded-md text-sm ${
                activeChart === "methods"
                  ? "bg-indigo-100 text-indigo-700"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
              onClick={() => setActiveChart("methods")}
            >
              By Method
            </button>
          </div>
        </div>
        <div className="barChart h-80 flex items-center justify-center">
          {Line && activeChart === "weekly" && (
            <Line data={weeklyLineData} options={lineOptions} />
          )}
          {Line && activeChart === "monthly" && (
            <Line data={monthlyLineData} options={lineOptions} />
          )}
          {Bar && activeChart === "methods" && (
            <Bar data={methodData} options={barOptions} />
          )}
          {!Line && !Bar && (
            <div className="text-gray-500">Loading Chart...</div>
          )}
        </div>
      </div>

      {/* Technique Doughnut */}
      <div className="bg-white p-6 rounded-2xl shadow">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-800">By Technique</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              Total: ₹{totalTechniqueRevenue.toLocaleString()}
            </span>
            <button className="text-gray-400 hover:text-gray-600">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="h-64 w-full flex items-center justify-center">
          {Doughnut ? (
            <Doughnut data={doughnutData} options={doughnutOptions} />
          ) : (
            <div className="text-gray-500">Loading Chart...</div>
          )}
        </div>
        {/* Technique Summary */}
        <div className="mt-4 space-y-2">
          {data.amountByTechnique.map((tech, index) => {
            const percentage = Math.round(
              (tech.total / totalTechniqueRevenue) * 100
            );
            return (
              <div
                key={index}
                className="flex justify-between items-center text-sm"
              >
                <span className="text-gray-600">{tech.method}</span>
                <span className="font-medium">
                  ₹{tech.total.toLocaleString()} ({percentage}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
