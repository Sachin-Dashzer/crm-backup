"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import OwnerSidebar from "@/components/Sidebars/OwnerSidebar";
import { OwnerTopbar, Card, DataTable, Heatmap } from "@/components/owner";

const METRICS = [
  { key: "leads", label: "Leads" },
  { key: "connectedCallCount", label: "Connected" },
  { key: "converted", label: "Converted" },
  { key: "conversionRate", label: "Conv. Rate" },
];

// Min-max normalizes each metric column independently to 0–100 so columns on very different
// scales (leads in the hundreds vs. a conversion % 0–100) are visually comparable in one heatmap.
function normalizeColumn(rows, key) {
  const values = rows.map((r) => r[key]).filter((v) => v != null);
  if (values.length === 0) return rows.map(() => null);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return rows.map((r) => (r[key] == null ? null : Math.round(((r[key] - min) / range) * 100)));
}

export default function LeadershipPage() {
  const [tlRows, setTlRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/leadership");
      const json = await res.json();
      if (json.success) setTlRows(json.tlRows || []);
      else setError(json.message || "Failed to load");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const heatmapData = useMemo(() => {
    const columns = METRICS.map((m) => normalizeColumn(tlRows, m.key));
    // transpose columns-of-rows into rows-of-columns (one row per TL, one value per metric)
    return tlRows.map((_, ri) => columns.map((col) => col[ri]));
  }, [tlRows]);

  return (
    <div className="app">
      <OwnerSidebar />

      <div className="main">
        <OwnerTopbar
          title="TL & Manager"
          subtitle="Team-lead ranking from callby's teamTotals — no manager tier in this data model"
          controls={
            <button className="icon-btn" onClick={fetchData} disabled={loading} title="Refresh">
              {loading ? "…" : "⟳"}
            </button>
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
              <Card title="TL Ranking" subtitle={loading ? "Loading…" : `${tlRows.length} team leads`}>
                <DataTable
                  emptyMessage={loading ? "Loading…" : "No team data available"}
                  columns={[
                    { key: "tlName", label: "Team Lead" },
                    { key: "leads", label: "Leads", render: (r) => r.leads ?? "—" },
                    { key: "connectedCallCount", label: "Connected", render: (r) => r.connectedCallCount ?? "—" },
                    { key: "converted", label: "Converted", render: (r) => r.converted ?? "—" },
                    { key: "conversionRate", label: "Conv. Rate", render: (r) => (r.conversionRate != null ? `${r.conversionRate}%` : "—") },
                  ]}
                  rows={loading ? [] : tlRows.map((r, i) => ({ ...r, id: r.tlName || i }))}
                />
              </Card>

              {!loading && tlRows.length > 0 && (
                <Card title="Relative Performance" subtitle="Each metric normalized 0–100 across TLs — not an absolute score">
                  <Heatmap
                    rows={tlRows.map((r) => r.tlName)}
                    cols={METRICS.map((m) => m.label)}
                    data={heatmapData}
                    formatValue={(v) => v}
                  />
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
