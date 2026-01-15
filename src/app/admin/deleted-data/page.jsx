"use client";

import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/Sidebars/Sidebar";
import { 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  Calendar,
  User,
  DollarSign,
  Building,
  AlertCircle
} from "lucide-react";

const DeletedData = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filteredData, setFilteredData] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    costType: "",
    method: "",
    procedure: "",
    paymentType: "",
    branch: "",
    dateFrom: "",
    dateTo: "",
    minAmount: "",
    maxAmount: ""
  });
  const [expandedRow, setExpandedRow] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/audit/get-data");
        if (!res.ok) throw new Error("Failed to fetch audit data");
        const result = await res.json();
        
        // Handle different response structures
        let fetchedData = [];
        if (Array.isArray(result)) {
          fetchedData = result;
        } else if (result && Array.isArray(result.data)) {
          fetchedData = result.data;
        } else if (result && typeof result === 'object') {
          // If result is an object, try to extract array from it
          const possibleArrays = Object.values(result).filter(val => Array.isArray(val));
          fetchedData = possibleArrays.length > 0 ? possibleArrays[0] : [];
        }
        
        setData(fetchedData);
        setFilteredData(fetchedData);
      } catch (e) {
        setError(e.message || "Error fetching data");
        console.error("Fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = Array.isArray(data) ? [...data] : [];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(item => {
        if (!item || typeof item !== 'object') return false;
        
        return Object.values(item).some(value => 
          value && value.toString().toLowerCase().includes(searchLower)
        ) ||
        (item.patient?.name && item.patient.name.toLowerCase().includes(searchLower)) ||
        (item.expense && item.expense.toLowerCase().includes(searchLower)) ||
        (item.expenseGiver && item.expenseGiver.toLowerCase().includes(searchLower)) ||
        (item.remarks && item.remarks.toLowerCase().includes(searchLower));
      });
    }

    // Cost Type filter
    if (filters.costType) {
      filtered = filtered.filter(item => item?.costType === filters.costType);
    }

    // Method filter
    if (filters.method) {
      filtered = filtered.filter(item => item?.method === filters.method);
    }

    // Procedure filter
    if (filters.procedure) {
      filtered = filtered.filter(item => item?.procedure === filters.procedure);
    }

    // Payment Type filter
    if (filters.paymentType) {
      filtered = filtered.filter(item => item?.paymentType === filters.paymentType);
    }

    // Branch filter
    if (filters.branch) {
      filtered = filtered.filter(item => item?.branch === filters.branch);
    }

    // Date range filter
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(item => item?.date && new Date(item.date) >= fromDate);
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => item?.date && new Date(item.date) <= toDate);
    }

    // Amount range filter
    if (filters.minAmount) {
      filtered = filtered.filter(item => item?.amount >= parseFloat(filters.minAmount));
    }

    if (filters.maxAmount) {
      filtered = filtered.filter(item => item?.amount <= parseFloat(filters.maxAmount));
    }

    setFilteredData(filtered);
    setCurrentPage(1);
  }, [filters, data]);

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      search: "",
      costType: "",
      method: "",
      procedure: "",
      paymentType: "",
      branch: "",
      dateFrom: "",
      dateTo: "",
      minAmount: "",
      maxAmount: ""
    });
  };

  // Toggle row expansion
  const toggleRowExpand = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil((Array.isArray(filteredData) ? filteredData.length : 0) / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = Array.isArray(filteredData) 
    ? filteredData.slice(startIndex, endIndex)
    : [];

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "₹0";
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return "Invalid Date";
    }
  };

  // Get status color
  const getCostTypeColor = (type) => {
    return type === "Revenue" 
      ? "bg-green-100 text-green-800" 
      : "bg-red-100 text-red-800";
  };

  // Calculate totals safely
  const calculateTotalRevenue = () => {
    if (!Array.isArray(filteredData)) return 0;
    return filteredData
      .filter(d => d?.costType === "Revenue")
      .reduce((sum, d) => sum + (d?.amount || 0), 0);
  };

  const calculateTotalExpenses = () => {
    if (!Array.isArray(filteredData)) return 0;
    return filteredData
      .filter(d => d?.costType === "Expenses")
      .reduce((sum, d) => sum + (d?.amount || 0), 0);
  };

  const countUniquePatients = () => {
    if (!Array.isArray(filteredData)) return 0;
    const patientIds = new Set();
    filteredData.forEach(d => {
      if (d?.patient?._id) patientIds.add(d.patient._id);
    });
    return patientIds.size;
  };

  // Export data
  const exportToCSV = () => {
    if (!Array.isArray(filteredData) || filteredData.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = [
      "Date", "Cost Type", "Method", "Procedure", "Payment Type", 
      "Patient", "Branch", "Amount", "Discount", "Expense", 
      "Expense Giver", "Remarks", "Created By", "Created Date"
    ];

    const csvData = filteredData.map(item => [
      formatDate(item?.date),
      item?.costType || "N/A",
      item?.method || "N/A",
      item?.procedure || "N/A",
      item?.paymentType || "N/A",
      item?.patient?.name || "N/A",
      item?.branch || "N/A",
      item?.amount || 0,
      item?.discount || 0,
      item?.expense || "N/A",
      item?.expenseGiver || "N/A",
      item?.remarks || "N/A",
      item?.createdBy?.name || "N/A",
      item?.createdBy?.date ? formatDate(item.createdBy.date) : "N/A"
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 p-4 lg:p-8">
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading audit data...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 p-4 lg:p-8">
          <div className="flex items-center justify-center h-screen">
            <div className="text-center max-w-md">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Data</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 p-4 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Audit & Deleted Records</h1>
              <p className="text-gray-600 mt-1">Track all financial transactions and audit trails</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={exportToCSV}
                disabled={!Array.isArray(filteredData) || filteredData.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl shadow border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Records</p>
                  <p className="text-2xl font-bold mt-1">
                    {Array.isArray(filteredData) ? filteredData.length : 0}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-xl shadow border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Revenue</p>
                  <p className="text-2xl font-bold mt-1 text-green-600">
                    {formatCurrency(calculateTotalRevenue())}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-xl shadow border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Expenses</p>
                  <p className="text-2xl font-bold mt-1 text-red-600">
                    {formatCurrency(calculateTotalExpenses())}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-xl shadow border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Patients Involved</p>
                  <p className="text-2xl font-bold mt-1">
                    {countUniquePatients()}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <User className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-xl shadow border mb-6 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-500" />
              <h2 className="text-lg font-semibold">Filters</h2>
            </div>
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear all filters
            </button>
          </div>

          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                name="search"
                placeholder="Search across all fields..."
                value={filters.search}
                onChange={handleFilterChange}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Cost Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost Type
                </label>
                <select
                  name="costType"
                  value={filters.costType}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="Revenue">Revenue</option>
                  <option value="Expenses">Expenses</option>
                </select>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  name="method"
                  value={filters.method}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Methods</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="banking">Banking</option>
                  <option value="Loan">Loan</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Procedure */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Procedure
                </label>
                <select
                  name="procedure"
                  value={filters.procedure}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Procedures</option>
                  <option value="Sapphire FUE">Sapphire FUE</option>
                  <option value="DHI">DHI</option>
                  <option value="Turkish DHI">Turkish DHI</option>
                  <option value="Beard Transplant">Beard Transplant</option>
                  <option value="PRP">PRP</option>
                  <option value="GFC">GFC</option>
                  <option value="Medicine">Medicine</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Payment Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Type
                </label>
                <select
                  name="paymentType"
                  value={filters.paymentType}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="Booking">Booking</option>
                  <option value="Pending">Pending</option>
                  <option value="Full-payment">Full-payment</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Branch */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch
                </label>
                <select
                  name="branch"
                  value={filters.branch}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Branches</option>
                  <option value="Delhi">Delhi</option>
                  <option value="Mumbai">Mumbai</option>
                  <option value="Hyderabad">Hyderabad</option>
                </select>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date From
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    name="dateFrom"
                    value={filters.dateFrom}
                    onChange={handleFilterChange}
                    className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date To
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    name="dateTo"
                    value={filters.dateTo}
                    onChange={handleFilterChange}
                    className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Amount Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Amount
                </label>
                <input
                  type="number"
                  name="minAmount"
                  placeholder="₹ Min"
                  value={filters.minAmount}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Amount
                </label>
                <input
                  type="number"
                  name="maxAmount"
                  placeholder="₹ Max"
                  value={filters.maxAmount}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Type</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Patient</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Procedure</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Branch</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Amount</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Method</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentData.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-gray-500">
                      {Array.isArray(data) && data.length === 0 
                        ? "No records found in the database" 
                        : "No records match your filters"}
                    </td>
                  </tr>
                ) : (
                  currentData.map((item, index) => (
                    <React.Fragment key={item?._id || `item-${index}`}>
                      <tr className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(item?.date)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCostTypeColor(item?.costType)}`}>
                            {item?.costType || "N/A"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">
                              {item?.patient?.name || "N/A"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-900">
                            {item?.procedure || "N/A"}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">{item?.branch || "N/A"}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className={`text-sm font-semibold ${item?.costType === "Revenue" ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(item?.amount)}
                            {item?.discount > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                Disc: ₹{item?.discount || 0}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-900 capitalize">
                            {item?.method || "N/A"}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => toggleRowExpand(item?._id || `item-${index}`)}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                          >
                            {expandedRow === (item?._id || `item-${index}`) ? (
                              <>
                                <ChevronUp className="h-4 w-4" />
                                Hide Details
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4" />
                                View Details
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                      
                      {/* Expanded Row Details */}
                      {expandedRow === (item?._id || `item-${index}`) && (
                        <tr>
                          <td colSpan="8" className="bg-blue-50 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Transaction Details</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Payment Type:</span>
                                    <span className="font-medium">{item?.paymentType || "N/A"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Payment ID:</span>
                                    <span className="font-medium">{item?.paymentId || "N/A"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Expense:</span>
                                    <span className="font-medium">{item?.expense || "N/A"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Expense Giver:</span>
                                    <span className="font-medium">{item?.expenseGiver || "N/A"}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Remarks</h4>
                                <p className="text-sm text-gray-600 bg-white p-3 rounded border">
                                  {item?.remarks || "No remarks provided"}
                                </p>
                              </div>
                              
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Created By</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Name:</span>
                                    <span className="font-medium">{item?.createdBy?.name || "N/A"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Email:</span>
                                    <span className="font-medium">{item?.createdBy?.email || "N/A"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Created Date:</span>
                                    <span className="font-medium">
                                      {item?.createdBy?.date ? formatDate(item.createdBy.date) : "N/A"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} records
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 rounded-lg ${
                            currentPage === pageNum
                              ? "bg-blue-600 text-white"
                              : "hover:bg-gray-100"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    {totalPages > 5 && currentPage < totalPages - 2 && (
                      <>
                        <span className="px-2">...</span>
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          className="px-3 py-1 hover:bg-gray-100 rounded-lg"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DeletedData;