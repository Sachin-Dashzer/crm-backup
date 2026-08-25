"use client";

import { useEffect, useState, useCallback } from "react";
import OwnerSidebar from "@/components/Sidebars/OwnerSidebar";
import { OwnerTopbar, Card, DataTable } from "@/components/owner";
import { ALL_BRANCHES } from "@/lib/branches";
import { formatCurrency, formatDate } from "@/lib/financeUI";
import { useToast } from "@/components/Toast";

const PLATFORMS = ["Meta", "Google"];
const BRANCH_OPTIONS = ["All", ...ALL_BRANCHES];

const EMPTY_FORM = { date: "", branch: "", platform: "", campaignName: "", amount: "" };

function toDateInputValue(iso) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

export default function AdSpendPage() {
  const toast = useToast();

  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);

  const [filters, setFilters] = useState({ branch: "All", platform: "All", from: "", to: "" });

  const [form, setForm]           = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.branch !== "All") params.set("branch", filters.branch);
      if (filters.platform !== "All") params.set("platform", filters.platform);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);

      const res = await fetch(`/api/owner/ad-spend?${params.toString()}`);
      const json = await res.json();
      if (json.success) setEntries(json.entries || []);
      else toast.error(json.message || "Failed to load ad spend entries");
    } catch {
      toast.error("Network error while loading ad spend entries");
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError("");
  };

  const handleEdit = (entry) => {
    setEditingId(entry._id);
    setForm({
      date: toDateInputValue(entry.date),
      branch: entry.branch,
      platform: entry.platform,
      campaignName: entry.campaignName || "",
      amount: String(entry.amount),
    });
    setFormError("");
  };

  const handleDelete = async (entry) => {
    if (!window.confirm(`Delete this ${entry.platform} entry (${formatCurrency(entry.amount)})?`)) return;
    try {
      const res = await fetch(`/api/owner/ad-spend?id=${entry._id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast.success("Entry deleted");
        if (editingId === entry._id) resetForm();
        fetchEntries();
      } else {
        toast.error(json.message || "Failed to delete entry");
      }
    } catch {
      toast.error("Network error while deleting entry");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!form.date || !form.branch || !form.platform || form.amount === "") {
      setFormError("Date, branch, platform, and amount are required.");
      return;
    }
    if (Number(form.amount) < 0 || isNaN(Number(form.amount))) {
      setFormError("Amount must be a non-negative number.");
      return;
    }

    setSubmitting(true);
    try {
      const url = editingId ? `/api/owner/ad-spend?id=${editingId}` : "/api/owner/ad-spend";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          branch: form.branch,
          platform: form.platform,
          campaignName: form.campaignName,
          amount: Number(form.amount),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editingId ? "Entry updated" : "Entry added");
        resetForm();
        fetchEntries();
      } else {
        setFormError(json.message || "Failed to save entry");
      }
    } catch {
      setFormError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  const totalSpend = entries.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="app">
      <OwnerSidebar />

      <div className="main">
        <OwnerTopbar
          title="Manual Ad Spend"
          subtitle="Meta & Google campaign spend — entered manually, no linked source"
          controls={
            <button className="icon-btn" onClick={fetchEntries} disabled={loading} title="Refresh">
              {loading ? "…" : "⟳"}
            </button>
          }
        />

        <div className="content">
          <div className="grid cols-2">
            <Card
              title={editingId ? "Edit Entry" : "Add Entry"}
              subtitle={editingId ? "Update this ad spend record" : "Log a new Meta or Google spend entry"}
            >
              <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
                <input
                  type="date"
                  className="control"
                  style={{ width: "100%" }}
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                  required
                />
                <select
                  className="control"
                  style={{ width: "100%" }}
                  value={form.branch}
                  onChange={(e) => setForm((p) => ({ ...p, branch: e.target.value }))}
                  required
                >
                  <option value="" disabled>Select branch</option>
                  {ALL_BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <select
                  className="control"
                  style={{ width: "100%" }}
                  value={form.platform}
                  onChange={(e) => setForm((p) => ({ ...p, platform: e.target.value }))}
                  required
                >
                  <option value="" disabled>Select platform</option>
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <input
                  type="text"
                  className="control"
                  style={{ width: "100%" }}
                  placeholder="Campaign name (optional)"
                  value={form.campaignName}
                  onChange={(e) => setForm((p) => ({ ...p, campaignName: e.target.value }))}
                />
                <input
                  type="number"
                  className="control"
                  style={{ width: "100%" }}
                  placeholder="Amount"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  required
                />

                {formError && <p style={{ color: "var(--red)", fontSize: 11 }}>{formError}</p>}

                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" className="primary" disabled={submitting}>
                    {submitting ? "Saving…" : editingId ? "Save Changes" : "Add Entry"}
                  </button>
                  {editingId && (
                    <button type="button" className="link-btn" onClick={resetForm}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </Card>

            <Card title="Filters" subtitle="Narrow down the entries list below">
              <div style={{ display: "grid", gap: 10 }}>
                <select
                  className="control"
                  style={{ width: "100%" }}
                  value={filters.branch}
                  onChange={(e) => setFilters((p) => ({ ...p, branch: e.target.value }))}
                >
                  {BRANCH_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <select
                  className="control"
                  style={{ width: "100%" }}
                  value={filters.platform}
                  onChange={(e) => setFilters((p) => ({ ...p, platform: e.target.value }))}
                >
                  <option value="All">All Platforms</option>
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="date"
                    className="control"
                    style={{ flex: 1 }}
                    value={filters.from}
                    onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
                  />
                  <input
                    type="date"
                    className="control"
                    style={{ flex: 1 }}
                    value={filters.to}
                    onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
                  />
                </div>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setFilters({ branch: "All", platform: "All", from: "", to: "" })}
                >
                  Clear filters
                </button>
              </div>
            </Card>
          </div>

          <Card
            title="Recent Entries"
            subtitle={loading ? "Loading…" : `${entries.length} entries · ${formatCurrency(totalSpend)} total`}
          >
            <DataTable
              tall
              emptyMessage={loading ? "Loading…" : "No ad spend entries for this filter"}
              columns={[
                { key: "date", label: "Date", render: (row) => formatDate(row.date) },
                { key: "branch", label: "Branch" },
                { key: "platform", label: "Platform" },
                { key: "campaignName", label: "Campaign", render: (row) => row.campaignName || "—" },
                { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
                { key: "enteredBy", label: "Entered By", render: (row) => row.enteredBy?.name || "—" },
                {
                  key: "actions",
                  label: "Actions",
                  render: (row) => (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" className="ok-btn" onClick={() => handleEdit(row)}>
                        Edit
                      </button>
                      <button type="button" className="danger-btn" onClick={() => handleDelete(row)}>
                        Delete
                      </button>
                    </div>
                  ),
                },
              ]}
              rows={loading ? [] : entries.map((e) => ({ ...e, id: e._id }))}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
