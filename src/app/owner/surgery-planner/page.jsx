"use client";

import { useEffect, useState, useCallback } from "react";
import OwnerSidebar from "@/components/Sidebars/OwnerSidebar";
import { OwnerTopbar, Card, DataTable, Badge } from "@/components/owner";
import { ALL_BRANCHES } from "@/lib/branches";

const BRANCHES = ["All", ...ALL_BRANCHES];
// Forward-looking presets — unlike the reporting pages, OT planning is primarily about what's
// coming up, not what already happened.
const DATE_RANGES = ["Today", "Next 7 Days", "Next 30 Days", "Custom"];

function fmtDate(v) {
  return v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

function buildDateRange(range, custom) {
  const now = new Date();
  let from = new Date(now), to = new Date(now);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  if (range === "Next 7 Days") {
    to = new Date(now); to.setDate(to.getDate() + 6); to.setHours(23, 59, 59, 999);
  } else if (range === "Next 30 Days") {
    to = new Date(now); to.setDate(to.getDate() + 29); to.setHours(23, 59, 59, 999);
  } else if (range === "Custom" && custom.from) {
    from = new Date(custom.from); from.setHours(0, 0, 0, 0);
    to   = custom.to ? new Date(custom.to) : new Date(custom.from);
    to.setHours(23, 59, 59, 999);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function SurgeryPlannerPage() {
  const [branch, setBranch]       = useState("All");
  const [dateRange, setDateRange] = useState("Next 7 Days");
  const [custom, setCustom]       = useState({ from: "", to: "" });

  const [surgeries, setSurgeries] = useState([]);
  const [capacity, setCapacity]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const fetchData = useCallback(async () => {
    if (dateRange === "Custom" && !custom.from) return;
    setLoading(true);
    setError(null);
    try {
      const { from, to } = buildDateRange(dateRange, custom);
      const res = await fetch("/api/owner/surgery-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch, from, to }),
      });
      const json = await res.json();
      if (json.success) {
        setSurgeries(json.surgeries || []);
        setCapacity(json.todayOTCapacity || []);
      } else {
        setError(json.message || "Failed to load");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }, [branch, dateRange, custom]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="app">
      <OwnerSidebar />

      <div className="main">
        <OwnerTopbar
          title="Surgery & OT Planner"
          subtitle="Scheduled surgeries and today's real OT load"
          controls={
            <>
              <select className="control" value={branch} onChange={(e) => setBranch(e.target.value)}>
                {BRANCHES.map((b) => <option key={b}>{b}</option>)}
              </select>
              <select className="control" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                {DATE_RANGES.map((r) => <option key={r}>{r}</option>)}
              </select>
              {dateRange === "Custom" && (
                <>
                  <input type="date" className="control" value={custom.from} onChange={(e) => setCustom((p) => ({ ...p, from: e.target.value }))} />
                  <input type="date" className="control" value={custom.to} onChange={(e) => setCustom((p) => ({ ...p, to: e.target.value }))} />
                </>
              )}
              <button className="icon-btn" onClick={fetchData} disabled={loading} title="Refresh">
                {loading ? "…" : "⟳"}
              </button>
            </>
          }
        />

        <div className="content">
          {error ? (
            <div className="card">
              <p><strong>{error}</strong></p>
              <button className="link-btn" onClick={fetchData}>Try again</button>
            </div>
          ) : (
            <>
              <Card title="Today's OT Capacity" subtitle="Real count of surgeries scheduled today, by OT — not a fabricated utilization %">
                {loading ? (
                  <p className="muted">Loading…</p>
                ) : capacity.length === 0 ? (
                  <p className="muted">No surgeries scheduled today</p>
                ) : (
                  <div className="status-grid">
                    {capacity.map((c) => (
                      <div className="status-card" key={c.OT}>
                        <strong>{c.count}</strong>
                        <span>OT {c.OT}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card
                title="Scheduled Surgeries"
                subtitle={loading ? "Loading…" : `${surgeries.length} surgeries · ${dateRange}${branch !== "All" ? ` · ${branch}` : ""}`}
              >
                <DataTable
                  tall
                  emptyMessage={loading ? "Loading…" : "No surgeries scheduled in this window"}
                  columns={[
                    { key: "name", label: "Patient" },
                    { key: "branch", label: "Branch" },
                    { key: "surgeryDate", label: "Date", render: (r) => fmtDate(r.surgeryDate) },
                    { key: "OT", label: "OT", render: (r) => (r.OT != null ? <Badge kind="info">OT {r.OT}</Badge> : "—") },
                    { key: "technique", label: "Technique" },
                    { key: "graftsneed", label: "Grafts Needed" },
                    { key: "graftsImplanted", label: "Grafts Implanted" },
                    { key: "doctor", label: "Doctor" },
                    { key: "seniorTech", label: "Senior Tech" },
                    { key: "implanterRight", label: "Implanter R" },
                    { key: "implanterLeft", label: "Implanter L" },
                  ]}
                  rows={loading ? [] : surgeries}
                />
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
