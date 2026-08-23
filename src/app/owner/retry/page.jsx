"use client";

import { useEffect, useState, useCallback } from "react";
import OwnerSidebar from "@/components/Sidebars/OwnerSidebar";
import { OwnerTopbar, Card, DataTable, Badge } from "@/components/owner";

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
        const list = Array.isArray(json.leads) ? json.leads : Array.isArray(json.data) ? json.data : Array.isArray(json.queue) ? json.queue : [];
        setItems(list);
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
            <Card title="Retry Queue" subtitle={loading ? "Loading…" : `${items.length} leads due`}>
              <DataTable
                tall
                emptyMessage={loading ? "Loading…" : "Nothing in the retry queue"}
                columns={[
                  { key: "name", label: "Lead", render: (r) => r.name || "Unknown" },
                  { key: "phone", label: "Phone", render: (r) => r.phone || "—" },
                  { key: "status", label: "Status", render: (r) => (r.status ? <Badge kind={STATUS_KIND[r.status] || "neutral"}>{r.status}</Badge> : "—") },
                  { key: "attempts", label: "Attempts", render: (r) => r.attempts ?? "—" },
                  { key: "connectedCallCount", label: "Connected", render: (r) => r.connectedCallCount ?? "—" },
                  { key: "lastCallAt", label: "Last Call", render: (r) => fmtDateTime(r.lastCallAt) },
                  { key: "followUpDate", label: "Follow-up Due", render: (r) => fmtDateTime(r.followUpDate) },
                  { key: "agent", label: "Agent", render: (r) => r.agent?.name || r.agentName || "—" },
                ]}
                rows={loading ? [] : items.map((r, i) => ({ ...r, id: r.id || r._id || i }))}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
