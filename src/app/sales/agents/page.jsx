"use client";

import { useState, useEffect } from "react";
import {
  Trophy,
  ChevronDown,
  ChevronUp,
  Search,
  Users,
  TrendingUp,
  IndianRupee,
  Calendar,
  Filter,
  Phone,
  Mail,
  Eye,
  EyeOff,
  UserCheck,
  UserPlus,
  Target,
  BarChart3,
} from "lucide-react";
import SalesSidebar from "@/components/Sidebars/SalesSidebar";
import { byName } from "@/lib/sortOptions";
import { motion, AnimatePresence } from "framer-motion";

export default function AgentDashboard() {
  const [activePage, setActivePage] = useState("Agents");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState("week");
  const [sortOrder, setSortOrder] = useState("desc");
  const [sortBy, setSortBy] = useState("revenue");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedAgent, setExpandedAgent] = useState(null);
  const [agentsData, setAgentsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Additional filters
  const [minRevenue, setMinRevenue] = useState("");
  const [minPatients, setMinPatients] = useState("");
  const [minConversion, setMinConversion] = useState("");
  const [selectedTechnique, setSelectedTechnique] = useState("all");

  // Fetch agents data
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/sales/agents`);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();
        if (data.success) {
          setAgentsData(data.data || []);
        } else {
          throw new Error("API returned unsuccessful response");
        }
      } catch (err) {
        setError(err.message);
        console.error("Error fetching agents:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, [timeFilter]);

  // Get all unique techniques for filter dropdown
  const allTechniques = Array.from(
    new Set(
      agentsData.flatMap((agent) =>
        agent.techniques ? Object.keys(agent.techniques) : []
      )
    )
  ).sort(byName);

  // Filter + sort agents
  const filteredAgents = agentsData
    .filter((agent) => {
      const matchesSearch = agent.name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase());
      
      const matchesRevenue = minRevenue
        ? agent.totalRevenue >= parseFloat(minRevenue)
        : true;
      
      const matchesPatients = minPatients
        ? agent.totalPatients >= parseInt(minPatients)
        : true;
      
      const matchesConversion = minConversion
        ? agent.conversionRate >= parseFloat(minConversion)
        : true;
      
      const matchesTechnique =
        selectedTechnique === "all" || !selectedTechnique
          ? true
          : agent.techniques && agent.techniques[selectedTechnique];

      return (
        matchesSearch &&
        matchesRevenue &&
        matchesPatients &&
        matchesConversion &&
        matchesTechnique
      );
    })
    .sort((a, b) => {
      let compareValue;
      switch (sortBy) {
        case "patients":
          compareValue = a.totalPatients - b.totalPatients;
          break;
        case "visited":
          compareValue = a.visitedPatients - b.visitedPatients;
          break;
        case "readyForSurgery":
          compareValue = a.readyForSurgery - b.readyForSurgery;
          break;
        case "conversionRate":
          compareValue = a.conversionRate - b.conversionRate;
          break;
        case "avgRevenue":
          compareValue = a.avgRevenue - b.avgRevenue;
          break;
        case "revenue":
        default:
          compareValue = a.totalRevenue - b.totalRevenue;
          break;
      }
      return sortOrder === "asc" ? compareValue : -compareValue;
    });

  // Calculate summary statistics
  const totalRevenue = filteredAgents.reduce(
    (sum, agent) => sum + agent.totalRevenue,
    0
  );
  const totalPatients = filteredAgents.reduce(
    (sum, agent) => sum + agent.totalPatients,
    0
  );
  const totalVisited = filteredAgents.reduce(
    (sum, agent) => sum + agent.visitedPatients,
    0
  );
  const totalReadyForSurgery = filteredAgents.reduce(
    (sum, agent) => sum + agent.readyForSurgery,
    0
  );
  const avgConversionRate = filteredAgents.length > 0 
    ? filteredAgents.reduce((sum, agent) => sum + agent.conversionRate, 0) / filteredAgents.length 
    : 0;

  // Format INR currency
  const formatCurrency = (amount = 0) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);

  const formatPercentage = (value) => `${value.toFixed(1)}%`;

  const toggleAgentDetails = (agentId) => {
    setExpandedAgent(expandedAgent === agentId ? null : agentId);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setMinRevenue("");
    setMinPatients("");
    setMinConversion("");
    setSelectedTechnique("all");
    setSortBy("revenue");
    setSortOrder("desc");
  };

  const getPerformanceColor = (conversionRate) => {
    if (conversionRate >= 70) return "text-green-600 bg-green-50";
    if (conversionRate >= 50) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SalesSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activePage={activePage}
        setActivePage={setActivePage}
      />

      <main className="flex-1 p-4 my-5 lg:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Agent Performance Dashboard
              </h1>
              <p className="text-gray-600 mt-1 mb-4">
                Track all agent performance and sales metrics
              </p>
            </div>
            {/* <div className="flex gap-2">
              {["day", "week", "month", "all"].map((filter) => (
                <button
                  key={filter}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    timeFilter === filter
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-100 border"
                  }`}
                  onClick={() => setTimeFilter(filter)}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div> */}
          </div>

          {/* Summary Cards */}
          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-indigo-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Agents</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {filteredAgents.length}
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-indigo-500" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(totalRevenue)}
                    </p>
                  </div>
                  <IndianRupee className="h-8 w-8 text-green-500" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Patients</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {totalPatients}
                    </p>
                  </div>
                  <UserPlus className="h-8 w-8 text-blue-500" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Visited</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {totalVisited}
                    </p>
                  </div>
                  <UserCheck className="h-8 w-8 text-purple-500" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-orange-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Ready for Surgery</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {totalReadyForSurgery}
                    </p>
                  </div>
                  {/* <Scalpel className="h-8 w-8 text-orange-500" /> */}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search and Sort Bar */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search agents by name..."
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Sort By */}
            <select
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="revenue">Sort by Revenue</option>
              <option value="patients">Sort by Patients</option>
              <option value="visited">Sort by Visit</option>
              <option value="readyForSurgery">Sort by Ready for Surgery</option>
              <option value="conversionRate">Sort by Conversion Rate</option>
              <option value="avgRevenue">Sort by Avg Revenue</option>
            </select>

            {/* Sort Order */}
            <button
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              title={sortOrder === "asc" ? "Ascending" : "Descending"}
            >
              {sortOrder === "asc" ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </button>

            {/* Advanced Filters Toggle */}
            <button
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                showFilters
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>
          </div>

          {/* Advanced Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-4 gap-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Revenue (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    value={minRevenue}
                    onChange={(e) => setMinRevenue(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Patients
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    value={minPatients}
                    onChange={(e) => setMinPatients(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Conversion Rate (%)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    step="0.1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    value={minConversion}
                    onChange={(e) => setMinConversion(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Technique
                  </label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    value={selectedTechnique}
                    onChange={(e) => setSelectedTechnique(e.target.value)}
                  >
                    <option value="all">All Techniques</option>
                    {allTechniques.map((tech) => (
                      <option key={tech} value={tech}>
                        {tech}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-4 flex justify-end">
                  <button
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    onClick={resetFilters}
                  >
                    Reset Filters
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Loader / Error / No Data */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 p-4 rounded-xl text-red-700 text-center">
            Error loading data: {error}
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <h3 className="text-lg font-medium text-gray-900">
              No agents found
            </h3>
            <p className="text-gray-500 mt-1">
              Try adjusting your filters or search criteria
            </p>
            <button
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              onClick={resetFilters}
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <>
            {/* Results Count */}
            <div className="mb-4 text-sm text-gray-600">
              Showing {filteredAgents.length} of {agentsData.length} agents
            </div>

            {/* Agents List Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b font-semibold text-gray-700 text-sm">
                <div className="col-span-3">Agent</div>
                <div className="col-span-1 text-center">Patients</div>
                <div className="col-span-1 text-center">Visited</div>
                <div className="col-span-1 text-center">Surgery</div>
                <div className="col-span-2 text-center">Conversion Rate</div>
                <div className="col-span-2 text-center">Revenue</div>
                <div className="col-span-2 text-center">Actions</div>
              </div>

              {/* Agents List */}
              <div className="divide-y">
                {filteredAgents.map((agent, idx) => (
                  <div key={agent._id || idx} className="bg-white">
                    {/* Agent Row */}
                    <div className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50 transition-colors">
                      {/* Agent Info */}
                      <div className="col-span-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {agent.name
                              ?.split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {agent.name}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                              
                              {agent.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  <span>{agent.phone}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Patients Count */}
                      <div className="col-span-1 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-bold text-gray-900">
                            {agent.totalPatients}
                          </span>
                          <span className="text-xs text-gray-500">Total</span>
                        </div>
                      </div>

                      <div className="col-span-1 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-bold text-green-600">
                            {agent.visitedPatients}
                          </span>
                          <span className="text-xs text-gray-500">Visited</span>
                        </div>
                      </div>

                      {/* Ready for Surgery */}
                      <div className="col-span-1 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-bold text-blue-600">
                            {agent.readyForSurgery}
                          </span>
                          <span className="text-xs text-gray-500">Surgery</span>
                        </div>
                      </div>

                      {/* Conversion Rate */}
                      <div className="col-span-2 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`text-lg font-bold px-2 py-1 rounded-full ${getPerformanceColor(agent.conversionRate)}`}>
                            {formatPercentage(agent.conversionRate)}
                          </span>
                          <span className="text-xs text-gray-500">Rate</span>
                        </div>
                      </div>

                      {/* Revenue */}
                      <div className="col-span-2 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-bold text-gray-900">
                            {formatCurrency(agent.totalRevenue)}
                          </span>
                          <span className="text-xs text-gray-500">
                            Avg: {formatCurrency(agent.avgRevenue)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 text-center">
                        <button
                          onClick={() => toggleAgentDetails(agent._id || idx)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm"
                        >
                          {expandedAgent === (agent._id || idx) ? (
                            <>
                              <EyeOff className="h-4 w-4" />
                              Hide
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4" />
                              View
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {expandedAgent === (agent._id || idx) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="bg-gray-50 border-t"
                        >
                          <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                              <div className="bg-white p-4 rounded-lg shadow-sm">
                                <div className="flex items-center gap-3">
                                  <BarChart3 className="h-8 w-8 text-indigo-500" />
                                  <div>
                                    <p className="text-sm text-gray-600">Performance Score</p>
                                    <p className={`text-xl font-bold ${getPerformanceColor(agent.conversionRate)}`}>
                                      {formatPercentage(agent.conversionRate)}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-lg shadow-sm">
                                <div className="flex items-center gap-3">
                                  <Target className="h-8 w-8 text-green-500" />
                                  <div>
                                    <p className="text-sm text-gray-600">Conversion Ratio</p>
                                    <p className="text-xl font-bold text-gray-900">
                                      {agent.visitedPatients}/{agent.totalPatients}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-lg shadow-sm">
                                <div className="flex items-center gap-3">
                                  {/* <Scalpel className="h-8 w-8 text-orange-500" /> */}
                                  <div>
                                    <p className="text-sm text-gray-600">Surgery Ready</p>
                                    <p className="text-xl font-bold text-gray-900">
                                      {agent.readyForSurgery}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-lg shadow-sm">
                                <div className="flex items-center gap-3">
                                  <IndianRupee className="h-8 w-8 text-purple-500" />
                                  <div>
                                    <p className="text-sm text-gray-600">Avg Revenue</p>
                                    <p className="text-xl font-bold text-gray-900">
                                      {formatCurrency(agent.avgRevenue)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Techniques */}
                            {agent.techniques && Object.keys(agent.techniques).length > 0 && (
                              <div className="bg-white p-4 rounded-lg shadow-sm">
                                <h4 className="font-semibold text-gray-900 mb-3">Techniques Sold</h4>
                                <div className="flex flex-wrap gap-3">
                                  {Object.entries(agent.techniques)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([tech, count]) => (
                                      <div
                                        key={tech}
                                        className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg flex items-center gap-2"
                                      >
                                        <span className="font-semibold">{tech}</span>
                                        <span className="bg-indigo-600 text-white px-2 py-1 rounded-full text-xs">
                                          {count}
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}