"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/financeUI";

/**
 * Row 4 of the admin dashboard — the three charts.
 *
 * Extracted from admin/dashboard/page.jsx purely so `recharts` can be code-split. It was a static
 * top-level import there, which meant the whole charting library had to download and parse before
 * the page rendered at all — including the nine KPI cards above, which need none of it. The page
 * now pulls this in with next/dynamic and shows a skeleton in its place until it arrives.
 *
 * Purely presentational: every figure is computed in the page and passed in, so the charts and the
 * cards above them can never disagree about the period they describe.
 */

const fmtK = (n) =>
  Math.abs(n) >= 100000
    ? `₹${(n / 100000).toFixed(1)}L`
    : Math.abs(n) >= 1000
      ? `₹${(n / 1000).toFixed(0)}K`
      : `₹${n || 0}`;

function ChartCard({ title, children, extra }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {extra}
      </div>
      {children}
    </div>
  );
}

export default function DashboardCharts({
  expenseByHead,
  monthlyTrend,
  ageingChartData,
  batchStatus,
  buildFilterQS,
  basisTag,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <ChartCard title="Expense by Head — Top 10">
        {expenseByHead.length === 0 && batchStatus === "ready" ? (
          <p className="text-sm text-gray-400 py-16 text-center">No data for this period</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={expenseByHead} layout="vertical" margin={{ left: 8, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar
                dataKey="movement"
                name="Raised"
                radius={[0, 6, 6, 0]}
                fill="#f43f5e"
                cursor="pointer"
                onClick={(data) => {
                  window.location.href = `/admin/payments?head=${encodeURIComponent(data.label)}&${buildFilterQS()}`;
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Income vs Expense — Last 6 Months" extra={basisTag}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthlyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Ageing — Payables vs Receivables">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={ageingChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="bucket" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey="Payables"
              stackId="a"
              fill="#f97316"
              cursor="pointer"
              onClick={(data) => {
                window.location.href = `/admin/liabilities?section=payables&ageing=${data.bucket}&${buildFilterQS()}`;
              }}
            />
            <Bar
              dataKey="Receivables"
              stackId="a"
              fill="#0ea5e9"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={(data) => {
                window.location.href = `/admin/assets?section=receivables&ageing=${data.bucket}&${buildFilterQS()}`;
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
