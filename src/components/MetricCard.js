"use client";

export default function MetricCard({ title, value, icon: Icon, color, trend, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 p-6 ${
        onClick ? 'cursor-pointer hover:scale-105' : ''
      } animate-fadeIn`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg bg-linear-to-r ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <div>
        <p className="text-gray-600 text-sm font-medium mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {trend && (
          <p className="text-xs text-green-600 mt-2 flex items-center">
            <span className="ml-1">{trend}</span> 
          </p>
        )}
      </div>
    </div>
  );
}
