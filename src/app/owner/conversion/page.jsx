"use client";

import { useEffect, useState, useCallback } from "react";
import OwnerSidebar from "@/components/Sidebars/OwnerSidebar";
import { OwnerTopbar, Card, Funnel, DataTable, KpiRow } from "@/components/owner";
import { ALL_BRANCHES } from "@/lib/branches";

const BRANCHES = ["All", ...ALL_BRANCHES];
const DATE_RANGES = ["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "Custom"];

const STATUS_LABEL = {
  NEW: "New",
  NOT_VISITED: "Not Visited",
  NOT_CONVERTED: "Not Converted",
  BOOKING_DONE: "Booking Done",
  SURGERY_BOOKED: "Surgery Booked",
  CLOSED: "Closed",
};

function buildDateRange(range, custom) {
  const now = new Date();
  let from = new Date(), to = new Date();
  to.setHours(23, 59, 59, 999);

  if (range === "Today") {
    from.setHours(0, 0, 0, 0);
  } else if (range === "Yesterday") {
    from = new Date(now); from.setDate(from.getDate() - 1); from.setHours(0, 0, 0, 0);
    to   = new Date(from); to.setHours(23, 59, 59, 999);
  } else if (range === "Last 7 Days") {
    from = new Date(now); from.setDate(from.getDate() - 6); from.setHours(0, 0, 0, 0);
  } else if (range === "Last 30 Days") {
    from = new Date(now); from.setDate(from.getDate() - 29); from.setHours(0, 0, 0, 0);
  } else if (range === "Custom" && custom.from) {
    from = new Date(custom.from); from.setHours(0, 0, 0, 0);
    to   = custom.to ? new Date(custom.to) : new Date(custom.from);
    to.setHours(23, 59, 59, 999);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function ConversionIntelligencePage() {
  const [branch, setBranch]       = useState("All");
  const [dateRange, setDateRange] = useState("Last 30 Days");
  const [custom, setCustom]       = useState({ from: "", to: "" });

  const [funnel, setFunnel]   = useState([]);
  const [sources, setSources] = useState([]);
  const [note, setNote]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchData = useCallback(async () => {
    if (dateRange === "Custom" && !custom.from) return;
    setLoading(true);
    setError(null);
    try {
      const { from, to } = buildDateRange(dateRange, custom);
      const res = await fetch("/api/owner/conversion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch, from, to }),
      });
      const json = await res.json();
      if (json.success) {
        setFunnel(json.funnel || []);
        setSources(json.sources || []);
        setNote(json.note);
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

  const totalSources = sources.reduce((s, r) => s + r.count, 0);

  return (
    <div className="app">
      <OwnerSidebar />

      <div className="main">
        <OwnerTopbar
          title="Conversion Intelligence"
          subtitle="Patient status funnel and lead source mix"
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
              {note && (
                <div className="notice">
                  <div>
                    <strong>Scope note</strong>
                    <p style={{ margin: "3px 0 0" }}>{note}</p>
                  </div>
                </div>
              )}

              <KpiRow
                items={[
                  { label: "Total Patients", value: loading ? "—" : funnel.reduce((s, f) => s + f.count, 0), sub: dateRange, kind: "info" },
                  { label: "Total Leads", value: loading ? "—" : totalSources, sub: "Meta + Google + Form + Collab", kind: "info" },
                  {
                    label: "Converted",
                    value: loading ? "—" : funnel.filter((f) => ["BOOKING_DONE", "SURGERY_BOOKED", "CLOSED"].includes(f.status)).reduce((s, f) => s + f.count, 0),
                    sub: "Booked or closed",
                    kind: "good",
                  },
                  {
                    label: "Conversion Rate",
                    value: loading ? "—" : (() => {
                      const total = funnel.reduce((s, f) => s + f.count, 0);
                      const converted = funnel.filter((f) => ["BOOKING_DONE", "SURGERY_BOOKED", "CLOSED"].includes(f.status)).reduce((s, f) => s + f.count, 0);
                      return total > 0 ? `${Math.round((converted / total) * 100)}%` : "—";
                    })(),
                    sub: "Of total patients",
                    kind: "good",
                  },
                  {
                    label: "Not Converted",
                    value: loading ? "—" : (funnel.find((f) => f.status === "NOT_CONVERTED")?.count ?? 0),
                    sub: "Visited, didn't book",
                    kind: "warn",
                  },
                  { label: "Top Source", value: loading || sources.length === 0 ? "—" : sources[0].tag, sub: loading || sources.length === 0 ? "" : `${sources[0].count} leads`, kind: "info" },
                ]}
              />

              <div className="grid cols-2">
                <Card title="Patient Status Funnel" subtitle={`${dateRange} · ${branch === "All" ? "All branches" : branch}`}>
                  {loading ? (
                    <p className="muted">Loading…</p>
                  ) : (
                    <Funnel items={funnel.map((f) => ({ label: STATUS_LABEL[f.status] || f.status, value: f.count }))} />
                  )}
                </Card>

                <Card title="Lead Source Mix" subtitle={`${dateRange} (not branch-scoped)`}>
                  <DataTable
                    emptyMessage={loading ? "Loading…" : "No leads in this period"}
                    columns={[
                      { key: "tag", label: "Source" },
                      { key: "count", label: "Leads" },
                      {
                        key: "pct",
                        label: "Share",
                        render: (r) => (totalSources > 0 ? `${Math.round((r.count / totalSources) * 100)}%` : "—"),
                      },
                    ]}
                    rows={loading ? [] : sources.map((s, i) => ({ ...s, id: s.tag || i }))}
                  />
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
