"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import OwnerSidebar from "@/components/Sidebars/OwnerSidebar";
import { OwnerTopbar, Card, DataTable, Badge, Modal } from "@/components/owner";

// Field names are best-guess (see src/app/api/owner/live-workforce/route.js's note — the
// callby service token is currently expired so the real workforce-summary payload shape
// couldn't be verified). Every accessor below falls back gracefully rather than crashing.
function numField(row, ...keys) {
  for (const k of keys) if (row[k] != null) return Number(row[k]);
  return null;
}

export default function Agent360Page() {
  const [agents, setAgents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const [selected, setSelected]   = useState(null);
  const [detail, setDetail]       = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError]     = useState(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/workforce-summary");
      const json = await res.json();
      if (json.success) {
        const list = Array.isArray(json.agents) ? json.agents : Array.isArray(json.data) ? json.data : [];
        setAgents(list);
      } else {
        setError(json.message || "Failed to load");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedRows = useMemo(() => {
    const withId = agents.map((a, i) => ({ ...a, id: a.employeeId || a.id || i }));
    const dir = sortDir === "asc" ? 1 : -1;
    return [...withId].sort((a, b) => {
      if (sortKey === "name") {
        return dir * String(a.name || a.agentName || "").localeCompare(String(b.name || b.agentName || ""));
      }
      const av = numField(a, sortKey) ?? -Infinity;
      const bv = numField(b, sortKey) ?? -Infinity;
      return dir * (av - bv);
    });
  }, [agents, sortKey, sortDir]);

  const openAgent = async (row) => {
    setSelected(row);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/owner/agent-detail/${row.employeeId || row.id}`);
      const json = await res.json();
      if (json.success) setDetail(json);
      else setDetailError(json.message || "Failed to load agent detail");
    } catch {
      setDetailError("Network error — please try again");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="app">
      <OwnerSidebar />

      <div className="main">
        <OwnerTopbar
          title="Agent 360°"
          subtitle="Sortable performance table — click a row for full detail"
          controls={
            <button className="icon-btn" onClick={fetchAgents} disabled={loading} title="Refresh">
              {loading ? "…" : "⟳"}
            </button>
          }
        />

        <div className="content">
          {error ? (
            <div className="card">
              <p><strong>{error}</strong></p>
              <button className="link-btn" onClick={fetchAgents}>Try again</button>
            </div>
          ) : (
            <Card title="Agents" subtitle={loading ? "Loading…" : `${agents.length} agents`}>
              <DataTable
                emptyMessage={loading ? "Loading…" : "No agent data available"}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                onRowClick={openAgent}
                columns={[
                  { key: "name", label: "Agent", sortable: true, render: (a) => a.name || a.agentName || "—" },
                  { key: "team", label: "Team", render: (a) => a.team || a.tlName || "—" },
                  {
                    key: "status",
                    label: "Status",
                    render: (a) => (a.status ? <Badge kind={a.status === "online" || a.status === "active" ? "good" : "neutral"}>{a.status}</Badge> : "—"),
                  },
                  { key: "calls", label: "Calls", sortable: true, render: (a) => a.callsToday ?? a.calls ?? a.totalCalls ?? "—" },
                  { key: "connectedCallCount", label: "Connected", sortable: true, render: (a) => a.connectedCallCount ?? a.connectedCalls ?? "—" },
                  { key: "conversionRate", label: "Conv. Rate", sortable: true, render: (a) => a.conversionRate != null ? `${a.conversionRate}%` : "—" },
                ]}
                rows={loading ? [] : sortedRows}
              />
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name || selected?.agentName || "Agent Detail"}
        subtitle={selected?.team || selected?.tlName}
      >
        {detailLoading ? (
          <p className="muted">Loading…</p>
        ) : detailError ? (
          <div className="notice">
            <div>
              <strong>Couldn't load this agent's detail</strong>
              <p style={{ margin: "3px 0 0" }}>{detailError}</p>
            </div>
          </div>
        ) : detail ? (
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, background: "var(--soft)", padding: 12, borderRadius: 12 }}>
            {JSON.stringify(detail, null, 2)}
          </pre>
        ) : null}
      </Modal>
    </div>
  );
}
