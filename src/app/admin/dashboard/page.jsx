"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Activity,
  CheckCircle,
  Stethoscope,
  Wallet,
} from "lucide-react";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/Topbar";
import MetricCard from "../../../components/MetricCard";
import ChartsSection from "../../../components/ChartsSection";

export default function AdminDashboard() {
  const router = useRouter();
  const [activePage, setActivePage] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Branch + Date states
  const [branch, setBranch] = useState("All");
  const [dateRange, setDateRange] = useState("Today");
  const [customDates, setCustomDates] = useState({ from: "", to: "" });

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);

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

  // --- Fetch dashboard data ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const payload = buildPayload();
      const res = await fetch("/api/admin/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setDashboardData(data);
    } catch (err) {
      console.error("Error fetching dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [branch, dateRange, customDates]);

  const plusDaysUTC = (dateInput, days = 1) => {
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return dateInput;
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString();
  };

  const handleMetricClick = (metricTitle) => {
    if (!dashboardData) return;
    const from = dashboardData?.dateRange?.from;
    const to = dashboardData?.dateRange?.to;
    const branchParam = dashboardData?.branch ?? "All";

    const filterParams = new URLSearchParams({
      dateFrom: from,
      dateTo: to,
      branch: branchParam,
    });

    switch (metricTitle) {
      case "Appointments":
        filterParams.set("status", "");
        router.push(`/admin/patients?${filterParams.toString()}`);
        break;

      case "Patients Visited":
        filterParams.set("visited", "true");
        router.push(`/admin/patients?${filterParams.toString()}`);
        break;

      case "Ready for Surgery":
        filterParams.set("status", "CONSULTED");
        router.push(`/admin/patients?${filterParams.toString()}`);
        break;

      case "Amount Received":
        router.push(`/admin/amounts`);

        filterParams.set("status", "CONSULTED");
        break;

      case "Surgery Performed":
        filterParams.set("status", "CLOSED");
        router.push(`/admin/patients?${filterParams.toString()}`);
        break;

      default:
        break;
    }
  };

  // Format currency for Amount Received
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // --- Metrics ---
  const metricCards = [
    {
      title: "Appointments",
      value: dashboardData?.appointment?.count || 0,
      trend: `${dashboardData?.appointment?.growth > 0 ? "↑" : "↓"} ${
        dashboardData?.appointment?.growth || 0
      }% from yesterday`,
      icon: Calendar,
      color: "from-indigo-500 to-indigo-600",
    },
    {
      title: "Patients Visited",
      value: dashboardData?.visitPatient?.count || 0,
      trend: `${dashboardData?.visitPatient?.growth > 0 ? "↑" : "↓"} ${
        dashboardData?.visitPatient?.growth || 0
      }% from yesterday`,
      icon: Activity,
      color: "from-green-500 to-green-600",
    },
    {
      title: "Ready for Surgery",
      value: dashboardData?.readyforSurgery?.count || 0,
      trend: `${dashboardData?.readyforSurgery?.growth > 0 ? "↑" : "↓"} ${
        dashboardData?.readyforSurgery?.growth || 0
      }% from yesterday`,
      icon: CheckCircle,
      color: "from-amber-500 to-amber-600",
    },
    {
      title: "Surgery Performed",
      value: dashboardData?.surgeryPatient?.count || 0,
      trend: `${dashboardData?.surgeryPatient?.growth > 0 ? "↑" : "↓"} ${
        dashboardData?.surgeryPatient?.growth || 0
      }% from yesterday`,
      icon: Stethoscope,
      color: "from-rose-500 to-rose-600",
    },
    {
      title: "Amount Received",
      value: formatCurrency(dashboardData?.amountReceived?.total || 0),
      trend: `${
        dashboardData?.amountReceived?.growth > 0 ? "↑" : "↓"
      } ${formatCurrency(
        dashboardData?.amountReceived?.growth || 0
      )}% from yesterday`,
      icon: Wallet,
      color: "from-purple-500 to-purple-600",
      isCurrency: true,
    },
  ];

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
          title={"Admin Dashboard"}
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
            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              {metricCards.map((card, index) => (
                <MetricCard
                  key={index}
                  title={card.title}
                  value={card.value}
                  growth={card.growth}
                  icon={card.icon}
                  color={card.color}
                  trend={card.trend}
                  onClick={() => handleMetricClick(card.title)}
                />
              ))}
            </div>

            <ChartsSection data={dashboardData} />
          </>
        )}
      </main>
    </div>
  );
}
