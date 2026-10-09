"use client";

import React from "react";
import { TrendingUp, TrendingDown, ArrowUpRight } from "lucide-react";

/**
 * Semantic palette matching executive standards:
 * BLUE:   Primary/general metrics (#2563EB)
 * PURPLE: Secondary/engagement metrics (#7C3AED)
 * CYAN:   Contact/communication metrics (#0891B2)
 * TEAL:   Pipeline/booking metrics (#0D9488)
 * GREEN:  Revenue/successful conversion metrics (#059669)
 * ORANGE: Activity/performance metrics (#EA580C)
 * RED:    Negative/not converted/pending metrics (#E11D48)
 * INDIGO: Analytics/conversion-rate metrics (#4F46E5)
 */
const COLOR_MAP = {
  blue: {
    accent: "bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600",
    iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/25",
    lightBg: "bg-blue-50/80",
    text: "text-blue-700",
    borderHover: "hover:border-blue-300 hover:shadow-blue-500/10",
    glow: "group-hover:from-blue-50/50",
    bar: "from-blue-500 to-indigo-600",
  },
  purple: {
    accent: "bg-gradient-to-r from-purple-500 via-purple-600 to-violet-600",
    iconBg: "bg-gradient-to-br from-purple-500 to-violet-600 shadow-purple-500/25",
    lightBg: "bg-purple-50/80",
    text: "text-purple-700",
    borderHover: "hover:border-purple-300 hover:shadow-purple-500/10",
    glow: "group-hover:from-purple-50/50",
    bar: "from-purple-500 to-violet-600",
  },
  cyan: {
    accent: "bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-600",
    iconBg: "bg-gradient-to-br from-cyan-500 to-teal-600 shadow-cyan-500/25",
    lightBg: "bg-cyan-50/80",
    text: "text-cyan-700",
    borderHover: "hover:border-cyan-300 hover:shadow-cyan-500/10",
    glow: "group-hover:from-cyan-50/50",
    bar: "from-cyan-500 to-teal-600",
  },
  teal: {
    accent: "bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600",
    iconBg: "bg-gradient-to-br from-teal-500 to-emerald-600 shadow-teal-500/25",
    lightBg: "bg-teal-50/80",
    text: "text-teal-700",
    borderHover: "hover:border-teal-300 hover:shadow-teal-500/10",
    glow: "group-hover:from-teal-50/50",
    bar: "from-teal-500 to-emerald-600",
  },
  green: {
    accent: "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600",
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/25",
    lightBg: "bg-emerald-50/80",
    text: "text-emerald-700",
    borderHover: "hover:border-emerald-300 hover:shadow-emerald-500/10",
    glow: "group-hover:from-emerald-50/50",
    bar: "from-emerald-500 to-teal-600",
  },
  orange: {
    accent: "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600",
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-600 shadow-orange-500/25",
    lightBg: "bg-orange-50/80",
    text: "text-orange-700",
    borderHover: "hover:border-orange-300 hover:shadow-orange-500/10",
    glow: "group-hover:from-orange-50/50",
    bar: "from-amber-500 to-orange-600",
  },
  red: {
    accent: "bg-gradient-to-r from-rose-500 via-pink-600 to-rose-600",
    iconBg: "bg-gradient-to-br from-rose-500 to-pink-600 shadow-rose-500/25",
    lightBg: "bg-rose-50/80",
    text: "text-rose-700",
    borderHover: "hover:border-rose-300 hover:shadow-rose-500/10",
    glow: "group-hover:from-rose-50/50",
    bar: "from-rose-500 to-pink-600",
  },
  indigo: {
    accent: "bg-gradient-to-r from-indigo-500 via-blue-600 to-indigo-600",
    iconBg: "bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-indigo-500/25",
    lightBg: "bg-indigo-50/80",
    text: "text-indigo-700",
    borderHover: "hover:border-indigo-300 hover:shadow-indigo-500/10",
    glow: "group-hover:from-indigo-50/50",
    bar: "from-indigo-500 to-indigo-600",
  },
};

export default function SalesKpiCard({
  title,
  value,
  icon: Icon,
  color = "blue",
  trend,
  footerLabel = "Active Period",
  footerValue,
  onClick,
  className = "",
}) {
  const scheme = COLOR_MAP[color] || COLOR_MAP.blue;
  const hasTrend = trend !== null && trend !== undefined && trend !== "";
  const isPositive = typeof trend === "number" ? trend >= 0 : !String(trend).startsWith("-");
  const trendDisplay = typeof trend === "number" ? `${Math.abs(trend)}%` : String(trend).replace(/^[+-]/, "");

  const valueStr = String(value ?? "");
  const textSizeClass =
    valueStr.length > 13
      ? "text-xl sm:text-2xl"
      : valueStr.length > 10
      ? "text-2xl sm:text-[28px] lg:text-3xl"
      : "text-2xl sm:text-3xl lg:text-[32px]";

  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-xs shadow-[0_2px_12px_-3px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col justify-between hover:shadow-[0_12px_24px_-6px_rgba(0,0,0,0.08)] hover:-translate-y-1 ${
        scheme.borderHover
      } ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {/* Background soft ambient hover glow */}
      <div
        className={`absolute inset-0 bg-gradient-to-br from-transparent to-transparent ${scheme.glow} transition-colors duration-300 pointer-events-none`}
      />

      {/* 3px Top gradient accent line */}
      <div className={`absolute inset-x-0 top-0 h-[3px] ${scheme.accent}`} />

      <div className="relative p-5 sm:p-5.5 flex flex-col flex-1 justify-between">
        {/* Top: Icon + Trend Badge + Interactive Affordance */}
        <div className="flex items-center justify-between mb-4">
          <div
            className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl ${scheme.iconBg} shadow-md text-white shrink-0 group-hover:scale-105 group-hover:rotate-1 transition-all duration-300`}
          >
            {Icon && <Icon className="h-5 w-5 sm:h-5.5 sm:w-5.5 drop-shadow-xs" />}
          </div>

          <div className="flex items-center gap-1.5">
            {hasTrend && (
              <div
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border shadow-2xs ${
                  isPositive
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200/70"
                    : "bg-rose-50 text-rose-700 border-rose-200/70"
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-3 h-3 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-rose-600" />
                )}
                <span>{trendDisplay}</span>
              </div>
            )}

            {onClick && (
              <div className="w-6 h-6 rounded-lg bg-slate-100/70 text-slate-400 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors shadow-2xs">
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            )}
          </div>
        </div>

        {/* Main: Metric Number + Label */}
        <div>
          <p
            className={`${textSizeClass} font-semibold text-slate-800 tracking-tight leading-none whitespace-nowrap truncate tabular-nums group-hover:text-slate-900 transition-colors`}
          >
            {value}
          </p>
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider truncate mt-2">
            {title}
          </p>
        </div>

        {/* Bottom: Thin Divider + Footer Metadata */}
        {(footerLabel || footerValue) && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-normal text-[11px] truncate">
              {footerLabel}
            </span>
            <span
              className={`font-medium ${scheme.text} text-[11px] truncate ml-2 px-2 py-0.5 rounded-md ${scheme.lightBg} border border-slate-100`}
            >
              {footerValue}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
