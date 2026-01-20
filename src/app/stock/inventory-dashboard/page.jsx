"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebars/Sidebar";
import Topbar from "@/components/Topbar";

export default function InventoryDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stocks, setStocks] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [statistics, setStatistics] = useState({
    totalItems: 0,
    totalStockValue: 0,
    lowStockCount: 0,
    expiredCount: 0,
  });
  const [lowStockItems, setLowStockItems] = useState([]);
  const [expiredItems, setExpiredItems] = useState([]);
  const [recentPurchases, setRecentPurchases] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all stocks
      const stocksResponse = await fetch("/api/stocks/get");
      const stocksData = await stocksResponse.json();

      if (stocksData.success) {
        setStocks(stocksData.data);
        setStatistics(stocksData.statistics);

        // Filter low stock items
        const lowStock = stocksData.data.filter((stock) => stock.totalQuantity <= 10);
        setLowStockItems(lowStock);

        // Filter expired items
        const expired = stocksData.data.filter(
          (stock) => stock.expiry && new Date(stock.expiry) <= new Date()
        );
        setExpiredItems(expired);

        // Get recent purchases (flatten all purchases with stock info)
        const purchases = [];
        stocksData.data.forEach((stock) => {
          if (stock.purchase && stock.purchase.length > 0) {
            stock.purchase.forEach((purchase) => {
              purchases.push({
                ...purchase,
                stockName: stock.name,
                stockId: stock._id,
              });
            });
          }
        });
        // Sort by date and get latest 5
        purchases.sort((a, b) => new Date(b.date) - new Date(a.date));
        setRecentPurchases(purchases.slice(0, 5));
      }

      // Fetch vendors
      const vendorsResponse = await fetch("/api/vendors/get");
      const vendorsData = await vendorsResponse.json();
      if (vendorsData.success) {
        setVendors(vendorsData.data);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50">
        <Topbar />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50">
      {/* <Topbar /> */}
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Inventory Dashboard
            </h1>
            <p className="text-gray-600 mt-2">Overview of your stock and vendors</p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-linear-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold opacity-90">Total Stock Items</h3>
                <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-4xl font-bold">{statistics.totalItems}</p>
            </div>

            <div className="bg-linear-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold opacity-90">Total Stock Value</h3>
                <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(statistics.totalStockValue)}</p>
            </div>

            <div className="bg-linear-to-br from-yellow-500 to-orange-500 rounded-xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold opacity-90">Low Stock Alert</h3>
                <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-4xl font-bold">{statistics.lowStockCount}</p>
            </div>

            <div className="bg-linear-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold opacity-90">Expired Items</h3>
                <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-4xl font-bold">{statistics.expiredCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Low Stock Alert */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Low Stock Items</h2>
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                  {lowStockItems.length} items
                </span>
              </div>
              
              {lowStockItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="font-medium">All items are well stocked!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lowStockItems.slice(0, 5).map((item) => (
                    <div
                      key={item._id}
                      className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-600">MRP: {formatCurrency(item.mrp)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-yellow-600">{item.totalQuantity}</p>
                        <p className="text-xs text-gray-500">units left</p>
                      </div>
                    </div>
                  ))}
                  {lowStockItems.length > 5 && (
                    <button
                      onClick={() => router.push("/admin/stocks?lowStock=true")}
                      className="w-full py-2 text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      View all {lowStockItems.length} items →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Expired Items Alert */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Expired Items</h2>
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                  {expiredItems.length} items
                </span>
              </div>
              
              {expiredItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="font-medium">No expired items!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {expiredItems.slice(0, 5).map((item) => (
                    <div
                      key={item._id}
                      className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-600">
                          Expired: {new Date(item.expiry).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-red-600">{item.totalQuantity}</p>
                        <p className="text-xs text-gray-500">units</p>
                      </div>
                    </div>
                  ))}
                  {expiredItems.length > 5 && (
                    <button
                      onClick={() => router.push("/admin/stocks?expired=true")}
                      className="w-full py-2 text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      View all {expiredItems.length} items →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Purchases */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Purchases</h2>
              
              {recentPurchases.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No recent purchases</div>
              ) : (
                <div className="space-y-3">
                  {recentPurchases.map((purchase, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{purchase.stockName}</p>
                        <p className="text-sm text-gray-600">
                          {purchase.vender?.name || "Unknown Vendor"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(purchase.date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {purchase.quantity} units
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatCurrency(purchase.price * purchase.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
              
              <div className="space-y-3">
                <button
                  onClick={() => router.push("/admin/stocks/create")}
                  className="w-full p-4 bg-linear-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md text-left flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold">Add New Stock Item</p>
                    <p className="text-sm opacity-90">Create a new inventory item</p>
                  </div>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                </button>

                <button
                  onClick={() => router.push("/admin/vendors/create")}
                  className="w-full p-4 bg-linear-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-all shadow-md text-left flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold">Add New Vendor</p>
                    <p className="text-sm opacity-90">Register a new supplier</p>
                  </div>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                </button>

                <button
                  onClick={() => router.push("/admin/stocks")}
                  className="w-full p-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all text-left flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold">View All Stock</p>
                    <p className="text-sm">Manage inventory items</p>
                  </div>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  onClick={() => router.push("/admin/vendors")}
                  className="w-full p-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all text-left flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold">View All Vendors</p>
                    <p className="text-sm">Manage suppliers</p>
                  </div>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}