"use client";

// Bordered card + heading — the WHAT / MONEY / HOW section container used across every
// transaction form. Pure presentation, extracted so the four (soon five) panels stop
// redefining the same `bg-white rounded-lg shadow-sm border ...` wrapper by hand.
export default function TransactionSectionCard({ title, subtitle, icon: Icon, children, className = "" }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      {title && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            {Icon && <Icon className="w-4.5 h-4.5 text-gray-500" />}
            {title}
          </h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
