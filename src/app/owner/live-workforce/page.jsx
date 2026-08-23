"use client";

import { useEffect, useState, useCallback } from "react";
import OwnerSidebar from "@/components/Sidebars/OwnerSidebar";
import { OwnerTopbar, Card, DataTable, Badge } from "@/components/owner";

const LANES = [
  { key: "P0", label: "P0 · Interested, overdue follow-up" },
  { key: "P1", label: "P1 · Recently connected" },
  { key: "P2", label: "P2 · New, untouched" },
  { key: "P3", label: "P3 · Not connected, due" },
  { key: "P4", label: "P4 · Still open" },
];

const STATUS_KIND = {
  interested: "good",
  contacted: "info",
  new: "neutral",
  not_connected: "warn",
};

export default function LiveWorkforcePage() {
  const [agents, setAgents]         = useState([]);
  const [agentsError, setAgentsError] = useState(null);
  const [queue, setQueue]           = useState({ P0: [], P1: [], P2: [], P3: [], P4: [] });
  const [queueError, setQueueError] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [fatalError, setFatalError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFatalError(null);
    try {
      const res = await fetch("/api/owner/live-workforce");
      const json = await res.json();
      if (json.success) {
        setAgents(json.agents || []);
        setAgentsError(json.agentsError);
        setQueue(json.queue || { P0: [], P1: [], P2: [], P3: [], P4: [] });
        setQueueError(json.queueError);
      } else {
        setFatalError(json.message || "Failed to load");
      }
    } catch {
      setFatalError("Network error — please try again");
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
          title="Live Workforce & Queue"
          subtitle="Per-agent status and the P0–P4 retry queue, live from callby"
          controls={
            <button className="icon-btn" onClick={fetchData} disabled={loading} title="Refresh">
              {loading ? "…" : "⟳"}
            </button>
          }
        />

        <div className="content">
          {fatalError ? (
            <div className="card">
              <p><strong>{fatalError}</strong></p>
              <button className="link-btn" onClick={fetchData}>Try again</button>
            </div>
          ) : (
            <>
              <Card title="Agent Status" subtitle={loading ? "Loading…" : `${agents.length} agents`}>
                {agentsError && (
                  <div className="notice">
                    <div>
                      <strong>Couldn't load agent status</strong>
                      <p style={{ margin: "3px 0 0" }}>{agentsError}</p>
                    </div>
                  </div>
                )}
                <DataTable
                  emptyMessage={loading ? "Loading…" : "No agent data available"}
                  columns={[
                    { key: "name", label: "Agent", render: (a) => a.name || a.agentName || "—" },
                    { key: "team", label: "Team", render: (a) => a.team || a.tlName || "—" },
                    {
                      key: "status",
                      label: "Status",
                      render: (a) => (a.status ? <Badge kind={a.status === "online" || a.status === "active" ? "good" : "neutral"}>{a.status}</Badge> : "—"),
                    },
                    { key: "calls", label: "Calls", render: (a) => a.callsToday ?? a.calls ?? a.totalCalls ?? "—" },
                    { key: "connected", label: "Connected", render: (a) => a.connectedCallCount ?? a.connectedCalls ?? "—" },
                  ]}
                  rows={loading ? [] : agents.map((a, i) => ({ ...a, id: a.employeeId || a.id || i }))}
                />
              </Card>

              <Card title="Retry Queue" subtitle="Bucketed P0 (most urgent) through P4">
                {queueError && (
                  <div className="notice">
                    <div>
                      <strong>Couldn't load the retry queue</strong>
                      <p style={{ margin: "3px 0 0" }}>{queueError}</p>
                    </div>
                  </div>
                )}
                <div className="queue-lane">
                  {LANES.map((lane) => {
                    const items = queue[lane.key] || [];
                    return (
                      <div className="lane" key={lane.key}>
                        <div className="lane-head">
                          <strong>{lane.label}</strong>
                          <Badge kind="neutral">{items.length}</Badge>
                        </div>
                        {loading ? (
                          <p className="muted">Loading…</p>
                        ) : items.length === 0 ? (
                          <p className="muted">Empty</p>
                        ) : (
                          items.slice(0, 25).map((item, i) => (
                            <div className="queue-card" key={item.id || item._id || i}>
                              <strong>{item.name || "Unknown"}</strong>
                              <p>{item.phone || ""}</p>
                              <div className="row">
                                <Badge kind={STATUS_KIND[item.status] || "neutral"}>{item.status || "—"}</Badge>
                                <span>{item.agent?.name || item.agentName || ""}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
