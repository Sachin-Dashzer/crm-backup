"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Sidebar from "@/components/Sidebars/Sidebar";
import { 
  Search, 
  ChevronDown, 
  ChevronUp,
  Calendar,
  User,
  Building,
  Download
} from "lucide-react";
import * as XLSX from 'xlsx';

// Utility functions
const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return "₹0";
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return "Invalid Date";
  }
};

// Transform API response to flat array
const transformApiData = (apiResponse) => {
  if (!apiResponse?.data) return [];
  
  const flatData = [];
  
  // Iterate through all cost types (Revenue, Expenses, etc.)
  Object.entries(apiResponse.data).forEach(([costType, items]) => {
    if (Array.isArray(items)) {
      items.forEach(item => {
        flatData.push({
          ...item,
          costType,
          patient: {
            name: item.patient?.personal?.name || "N/A",
            phone: item.patient?.personal?.phone || ""
          }
        });
      });
    }
  });
  
  return flatData;
};

// Filter logic
const applyFilters = (data, filters) => {
  return data.filter(item => {
    // Search filter
    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase().trim();
      const matchesSearch = 
        item.patient?.name?.toLowerCase().includes(searchLower) ||
        item.remarks?.toLowerCase().includes(searchLower) ||
        item.expense?.toLowerCase().includes(searchLower) ||
        item.paymentId?.toLowerCase().includes(searchLower) ||
        item.branch?.toLowerCase().includes(searchLower) ||
        item.procedure?.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
    }

    // Date range filters
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      const itemDate = new Date(item.date);
      if (itemDate < fromDate) return false;
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      const itemDate = new Date(item.date);
      if (itemDate > toDate) return false;
    }

    return true;
  });
};

const DeletedData = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    dateFrom: "",
    dateTo: "",
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
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const result = await res.json();
        
        if (!result.success) {
          throw new Error(result.message || "Failed to fetch data");
        }
        
        // Transform nested API response to flat array
        const flatData = transformApiData(result);
        setData(flatData);
        
      } catch (e) {
        setError(e.message || "Error fetching data");
        console.error("Fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Memoized filtered data
  const filteredData = useMemo(() => {
    return applyFilters(data, filters);
  }, [data, filters]);

  // Memoized pagination values
  const paginationData = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
    const currentData = filteredData.slice(startIndex, endIndex);
    
    return { totalPages, startIndex, endIndex, currentData };
  }, [filteredData, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Memoized event handlers
  const handleFilterChange = useCallback((e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      search: "",
      dateFrom: "",
      dateTo: "",
    });
  }, []);

  const toggleRowExpand = useCallback((id) => {
    setExpandedRow(prev => prev === id ? null : id);
  }, []);

  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(newPage);
  }, []);

  // Excel Export Function
  const handleExportExcel = useCallback(() => {
    if (filteredData.length === 0) {
      alert("No data to export");
      return;
    }

    // Prepare data for Excel
    const excelData = filteredData.map((item, index) => ({
      'Sr. No.': index + 1,
      'Date': formatDate(item.date),
      'Cost Type': item.costType || 'N/A',
      'Patient Name': item.patient?.name || 'N/A',
      'Patient Phone': item.patient?.phone || 'N/A',
      'Procedure': item.procedure || 'N/A',
      'Branch': item.branch || 'N/A',
      'Amount': item.amount || 0,
      'Payment Method': item.method || 'N/A',
      'Payment Type': item.paymentType || 'N/A',
      'Payment ID': item.paymentId || 'N/A',
      'Expense': item.expense || 'N/A',
      'Discount': item.discount || 0,
      'Remarks': item.remarks || 'No remarks',
      'Created By': item.createdBy?.name || 'N/A',
      'Created Date': item.createdBy?.date ? formatDate(item.createdBy.date) : 'N/A',
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const columnWidths = [
      { wch: 8 },  // Sr. No.
      { wch: 12 }, // Date
      { wch: 12 }, // Cost Type
      { wch: 20 }, // Patient Name
      { wch: 15 }, // Patient Phone
      { wch: 15 }, // Procedure
      { wch: 12 }, // Branch
      { wch: 12 }, // Amount
      { wch: 12 }, // Payment Method
      { wch: 15 }, // Payment Type
      { wch: 15 }, // Payment ID
      { wch: 15 }, // Expense
      { wch: 10 }, // Discount
      { wch: 30 }, // Remarks
      { wch: 20 }, // Created By
      { wch: 15 }, // Created Date
    ];
    ws['!cols'] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Transaction Records');

    // Generate filename with current date
    const fileName = `Transaction_Records_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.xlsx`;

    // Save file
    XLSX.writeFile(wb, fileName);
  }, [filteredData]);

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 p-4 lg:p-8">
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading data...</p>
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
        <Sidebar />
        <main className="flex-1 p-4 lg:p-8">
          <div className="flex items-center justify-center h-screen">
            <div className="text-center max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Data</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const { totalPages, currentData } = paginationData;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 p-4 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Transaction Records</h1>
              <p className="text-gray-600 mt-1">
                Showing {filteredData.length} of {data.length} transactions
              </p>
            </div>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
            >
              <Download className="h-4 w-4" />
              Export to Excel
            </button>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-lg border mb-6 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-gray-900">Search & Filter</h2>
            {(filters.search || filters.dateFrom || filters.dateTo) && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                name="search"
                placeholder="Search by patient name, payment ID, branch, procedure, remarks..."
                value={filters.search}
                onChange={handleFilterChange}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="date"
                    name="dateFrom"
                    value={filters.dateFrom}
                    onChange={handleFilterChange}
                    className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="date"
                    name="dateTo"
                    value={filters.dateTo}
                    onChange={handleFilterChange}
                    className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Date</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Type</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Patient</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Procedure</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Branch</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Amount</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Method</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentData.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-gray-500">
                      {data.length === 0 
                        ? "No records found" 
                        : "No records match your filters"}
                    </td>
                  </tr>
                ) : (
                  currentData.map((item) => (
                    <React.Fragment key={item._id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-900">
                            {formatDate(item.date)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.costType === "Revenue" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-red-100 text-red-800"
                          }`}>
                            {item.costType}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{item.patient?.name || "N/A"}</div>
                              {item.patient?.phone && (
                                <div className="text-xs text-gray-500">{item.patient.phone}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm">{item.procedure || "N/A"}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <span className="text-sm">{item.branch || "N/A"}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className={`text-sm font-medium ${
                            item.costType === "Revenue" ? "text-green-600" : "text-red-600"
                          }`}>
                            {formatCurrency(item.amount)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm capitalize">{item.method || "N/A"}</div>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => toggleRowExpand(item._id)}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                            aria-expanded={expandedRow === item._id}
                            aria-label={expandedRow === item._id ? "Hide details" : "View details"}
                          >
                            {expandedRow === item._id ? (
                              <>
                                <ChevronUp className="h-4 w-4" />
                                Hide
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4" />
                                View
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                      
                      {/* Expanded Row Details */}
                      {expandedRow === item._id && (
                        <tr>
                          <td colSpan="8" className="bg-gray-50 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-3">Transaction Details</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between py-1">
                                    <span className="text-gray-600">Payment Type:</span>
                                    <span className="font-medium">{item.paymentType || "N/A"}</span>
                                  </div>
                                  <div className="flex justify-between py-1">
                                    <span className="text-gray-600">Payment ID:</span>
                                    <span className="font-medium font-mono text-xs">{item.paymentId || "N/A"}</span>
                                  </div>
                                  {item.expense && (
                                    <div className="flex justify-between py-1">
                                      <span className="text-gray-600">Expense:</span>
                                      <span className="font-medium">{item.expense}</span>
                                    </div>
                                  )}
                                  {item.discount > 0 && (
                                    <div className="flex justify-between py-1">
                                      <span className="text-gray-600">Discount:</span>
                                      <span className="font-medium text-orange-600">{formatCurrency(item.discount)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-3">Additional Info</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between py-1">
                                    <span className="text-gray-600">Created By:</span>
                                    <span className="font-medium">{item.createdBy?.name || "N/A"}</span>
                                  </div>
                                  <div className="flex justify-between py-1">
                                    <span className="text-gray-600">Created Date:</span>
                                    <span className="font-medium">{item.createdBy?.date ? formatDate(item.createdBy.date) : "N/A"}</span>
                                  </div>
                                  <div className="pt-2">
                                    <span className="text-gray-600 block mb-1">Remarks:</span>
                                    <p className="text-gray-900 bg-white p-2 rounded border text-sm">
                                      {item.remarks || "No remarks"}
                                    </p>
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
            <div className="px-4 py-3 border-t bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {paginationData.startIndex + 1} to {paginationData.endIndex} of {filteredData.length} results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                    aria-label="Previous page"
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
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1 text-sm rounded transition-colors ${
                            currentPage === pageNum
                              ? "bg-blue-600 text-white"
                              : "hover:bg-gray-100"
                          }`}
                          aria-label={`Page ${pageNum}`}
                          aria-current={currentPage === pageNum ? "page" : undefined}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                    aria-label="Next page"
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