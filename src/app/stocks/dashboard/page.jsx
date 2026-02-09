"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebars/StockSidebar";
import { useSession } from "next-auth/react";

export default function StocksPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [stocks, setStocks] = useState([]);
  const [statistics, setStatistics] = useState({
    totalItems: 0,
    totalStockValue: 0,
    lowStockCount: 0,
    expiredCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [filterExpired, setFilterExpired] = useState(false);
  const [threshold, setThreshold] = useState(10);
  const [selectedStock, setSelectedStock] = useState(null);
  const [saleData, setSaleData] = useState({
    quantity: 1,
    price: 0,
    discount: 0,
    patientName: "",
    patientContact: "",
  });

  useEffect(() => {
    fetchStocks();
  }, []);

  const fetchStocks = async () => {
    try {
      setLoading(true);
      let url = "/api/stocks/get";
      const params = new URLSearchParams();

      if (searchTerm) params.append("search", searchTerm);
      if (filterLowStock) {
        params.append("lowStock", "true");
        params.append("threshold", threshold.toString());
      }
      if (filterExpired) params.append("expired", "true");

      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setStocks(data.data);
        setStatistics(data.statistics);
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error("Error fetching stocks:", error);
      alert("Failed to fetch stocks");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchStocks();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const isLowStock = (quantity) => quantity <= threshold;
  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) <= new Date();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Stock Management
            </h1>
            <p className="text-gray-600 mt-1">
              Manage your inventory and stock
            </p>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-1">
                Total Items
              </h3>
              <p className="text-3xl font-bold text-gray-900">
                {statistics.totalItems}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-1">
                Stock Value
              </h3>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(statistics.totalStockValue)}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-1">
                Low Stock
              </h3>
              <p className="text-3xl font-bold text-orange-600">
                {statistics.lowStockCount}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-1">
                Expired
              </h3>
              <p className="text-3xl font-bold text-red-600">
                {statistics.expiredCount}
              </p>
            </div>
          </div>

          {/* Actions Bar */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
              {/* Search */}
              <div className="lg:col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Stock
                </label>
                <input
                  type="text"
                  placeholder="Search by product name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Threshold */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Low Stock Threshold
                </label>
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Filters */}
              <div className="lg:col-span-3 flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterLowStock}
                    onChange={(e) => setFilterLowStock(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Low Stock
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterExpired}
                    onChange={(e) => setFilterExpired(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Expired
                  </span>
                </label>
              </div>

              {/* Buttons */}
              <div className="lg:col-span-3 flex gap-2">
                <button
                  onClick={handleSearch}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                >
                  Search
                </button>
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterLowStock(false);
                    setFilterExpired(false);
                    fetchStocks();
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200 font-medium"
                >
                  Clear
                </button>
                <button
                  onClick={() => router.push("/stocks/create")}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium whitespace-nowrap"
                >
                  + Add Stock
                </button>
              </div>
            </div>
          </div>

          {/* Stocks Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Product Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      MRP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Unit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Expiry Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center">
                        <div className="flex justify-center items-center">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        </div>
                      </td>
                    </tr>
                  ) : stocks.length === 0 ? (
                    <tr>
                      <td
                        colSpan="7"
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        No stock items found. Click "Add Stock" to create one.
                      </td>
                    </tr>
                  ) : (
                    stocks.map((stock) => (
                      <tr key={stock._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">
                            {stock.name}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`font-semibold ${
                              isLowStock(stock.totalQuantity)
                                ? "text-orange-600"
                                : "text-gray-900"
                            }`}
                          >
                            {stock.totalQuantity}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600 text-sm">
                          {formatCurrency(stock.mrp)}
                        </td>
                        <td className="px-6 py-4 text-gray-600 text-sm">
                          {stock.unit || "N/A"}
                        </td>
                        <td className="px-6 py-4 text-gray-600 text-sm">
                          {stock.expiry
                            ? new Date(stock.expiry).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {isExpired(stock.expiry) && (
                              <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-red-50 text-red-700">
                                Expired
                              </span>
                            )}
                            {isLowStock(stock.totalQuantity) &&
                              !isExpired(stock.expiry) && (
                                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-orange-50 text-orange-700">
                                  Low Stock
                                </span>
                              )}
                            {!isExpired(stock.expiry) &&
                              !isLowStock(stock.totalQuantity) && (
                                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-green-50 text-green-700">
                                  In Stock
                                </span>
                              )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() =>
                                router.push(`/stocks/edit/${stock._id}`)
                              }
                              className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 text-sm font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() =>
                                router.push(`/stocks/view/${stock._id}`)
                              }
                              className="px-3 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-md hover:bg-gray-100 text-sm font-medium"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
