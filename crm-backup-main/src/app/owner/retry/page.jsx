"use client";

import { useEffect, useState, useCallback } from "react";
import OwnerSidebar from "@/components/Sidebars/OwnerSidebar";
import { OwnerTopbar, Card, DataTable, Badge, KpiRow } from "@/components/owner";

const STATUS_KIND = {
  interested: "good",
  contacted: "info",
  new: "neutral",
  not_connected: "warn",
};

function fmtDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function RetryRecoveryPage() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/retry-queue");
      const json = await res.json();
      if (json.success) {
        setItems(json.leads || []);
      } else {
        setError(json.message || "Failed to load");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="app">
      <OwnerSidebar />

      <div className="main">
        <OwnerTopbar
          title="Retry & Recovery"
          subtitle="Straight from callby's retry-queue — every lead currently due a follow-up"
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
              <KpiRow
                items={[
                  { label: "Total in Queue", value: loading ? "—" : items.length, sub: "P0–P4", kind: "info" },
                  { label: "P0", value: loading ? "—" : items.filter((r) => r.priority === "P0").length, sub: "Overdue follow-up", kind: "bad" },
                  { label: "P1", value: loading ? "—" : items.filter((r) => r.priority === "P1").length, sub: "Recently connected", kind: "warn" },
                  { label: "Unassigned", value: loading ? "—" : items.filter((r) => !r.assignedTo).length, sub: "No agent owner", kind: "warn" },
                  {
                    label: "Avg Age",
                    value: loading || items.length === 0 ? "—" : `${Math.round(items.reduce((s, r) => s + (r.ageHours || 0), 0) / items.length)}h`,
                    sub: "Hours since last touch",
                    kind: "info",
                  },
                  { label: "Max Attempts", value: loading || items.length === 0 ? "—" : Math.max(...items.map((r) => r.attempts || 0)), sub: "Single lead", kind: "info" },
                ]}
              />
              <Card title="Retry Queue" subtitle={loading ? "Loading…" : `${items.length} leads due`}>
              <DataTable
                tall
                emptyMessage={loading ? "Loading…" : "Nothing in the retry queue"}
                columns={[
                  { key: "priority", label: "Priority", render: (r) => <Badge kind={r.priority === "P0" ? "bad" : r.priority === "P1" ? "warn" : "neutral"}>{r.priority}</Badge> },
                  { key: "name", label: "Lead", render: (r) => r.name || "Unknown" },
                  { key: "phone", label: "Phone", render: (r) => r.phone || "—" },
                  { key: "status", label: "Status", render: (r) => (r.status ? <Badge kind={STATUS_KIND[r.status] || "neutral"}>{r.status}</Badge> : "—") },
                  { key: "attempts", label: "Attempts", render: (r) => r.attempts ?? "—" },
                  { key: "ageHours", label: "Age", render: (r) => `${Math.round(r.ageHours || 0)}h` },
                  { key: "lastCallAt", label: "Last Call", render: (r) => fmtDateTime(r.lastCallAt) },
                  { key: "followUpDate", label: "Follow-up Due", render: (r) => fmtDateTime(r.followUpDate) },
                  { key: "agent", label: "Agent", render: (r) => r.assignedTo?.name || "Unassigned" },
                ]}
                rows={loading ? [] : items.map((r, i) => ({ ...r, id: r.id || i }))}
              />
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
