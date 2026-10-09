"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, Plus } from "lucide-react";
import OwnerSidebar from "@/components/Sidebars/OwnerSidebar";
import { OwnerTopbar } from "@/components/owner";
import { ALL_BRANCHES } from "@/lib/branches";
import { formatCurrency, formatDate } from "@/lib/financeUI";
import { useToast } from "@/components/Toast";

/* ─── Formatters ─────────────────────────────────────────────── */
const rupee = (n) =>
  n == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const fmt    = (n) => (n == null ? "—" : new Intl.NumberFormat("en-IN").format(n));
const roasFmt= (n) => (n == null ? "—" : `${n.toFixed(1)}x`);
const pctFmt = (n) => (n == null ? "—" : `${Math.round(n)}%`);

/* ─── Date range builder ─────────────────────────────────────── */
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

/* ─── Summarize marketing rows ───────────────────────────────── */
function summarize(rows) {
  const byPlatform = {};
  rows.forEach((r) => { (byPlatform[r.platform] ||= []).push(r); });
  let totalSpend = 0, totalLeads = 0, totalConverted = 0, totalRevenue = 0;
  Object.values(byPlatform).forEach((pRows) => {
    const totalRow = pRows.find((r) => r.isPlatformTotal) || (pRows.length === 1 ? pRows[0] : null);
    if (!totalRow) return;
    totalSpend    += totalRow.spend     || 0;
    totalLeads    += totalRow.leads     || 0;
    totalConverted+= totalRow.converted || 0;
    totalRevenue  += totalRow.revenue   || 0;
  });
  return {
    totalSpend, totalLeads, totalConverted, totalRevenue,
    blendedCPL:  totalLeads  > 0 ? totalSpend / totalLeads  : null,
    blendedROAS: totalSpend  > 0 ? totalRevenue / totalSpend: null,
  };
}

/* ─── Platform badge ─────────────────────────────────────────── */
function PlatformBadge({ platform }) {
  const isMeta = platform === "Meta";
  return (
    <span className={`badge ${isMeta ? "purple" : "good"}`} style={{ fontSize: "10px", fontWeight: 800 }}>
      {isMeta ? "🔵" : "🟢"} {platform}
    </span>
  );
}

/* ─── ROAS bar chart ─────────────────────────────────────────── */
function RoasBarChart({ rows }) {
  const campaignRows = rows.filter((r) => !r.isPlatformTotal && r.roas != null);
  if (!campaignRows.length) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:160, color:"var(--muted)", fontSize:9 }}>
      No ROAS data for this period
    </div>
  );
  const maxRoas = Math.max(...campaignRows.map((r) => r.roas));
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:160, padding:"8px 0 0" }}>
      {campaignRows.map((r, i) => {
        const isMeta = r.platform === "Meta";
        const barH   = maxRoas > 0 ? Math.max(18, (r.roas / maxRoas) * 120) : 18;
        return (
          <div key={i} style={{ flex:1, textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end" }}>
            <span style={{ fontSize:8, fontWeight:900, color:isMeta?"#4051b5":"#0b9e6d", marginBottom:3 }}>{roasFmt(r.roas)}</span>
            <div style={{
              width:"80%", height:barH, borderRadius:"7px 7px 2px 2px",
              background: isMeta
                ? "linear-gradient(180deg,#9fa8ff,#4051b5)"
                : "linear-gradient(180deg,#5de8c0,#0b9e6d)",
            }} />
            <span style={{ fontSize:7, color:"var(--muted)", marginTop:4, maxWidth:48, lineHeight:1.3, wordBreak:"break-all" }}>
              {r.campaignName?.replace(/^[MG]-/,"").slice(0,10) || r.platform}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── ROAS color ─────────────────────────────────────────────── */
function roasColor(v) {
  if (v == null) return "var(--muted)";
  if (v >= 15) return "#0b9e6d";
  if (v >= 8)  return "#2368f5";
  if (v >= 3)  return "#e68425";
  return "#df4a4a";
}

/* ─── CSV export ─────────────────────────────────────────────── */
function exportCSV(rows) {
  const header = ["Platform","Campaign","Spend","Leads","CPL","Converted","CAC","Revenue","ROAS"];
  const data   = rows.map((r) => [
    r.platform,
    r.isPlatformTotal ? "PLATFORM TOTAL" : (r.campaignName || "(unnamed)"),
    r.spend ?? "", r.leads ?? "",
    r.cpl != null ? r.cpl.toFixed(0) : "",
    r.converted ?? "",
    r.cac  != null ? r.cac.toFixed(0)  : "",
    r.revenue ?? "",
    r.roas != null ? r.roas.toFixed(2)  : "",
  ]);
  const csv  = [header,...data].map((row) => row.map((c)=>`"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv],{type:"text/csv"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "campaign-report.csv"; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Constants ──────────────────────────────────────────────── */
const PLATFORMS    = ["Meta", "Google"];
const BRANCHES     = ["All", ...ALL_BRANCHES];
const DATE_RANGES  = ["Today","Yesterday","Last 7 Days","Last 30 Days","Custom"];
const PLATFORM_OPT = ["Meta + Google","Meta","Google"];
const EMPTY_FORM   = { date:"", branch:"", platform:"", campaignName:"", amount:"" };

function toDateInput(iso) { return iso ? new Date(iso).toISOString().slice(0,10) : ""; }

/* ═══════════════════════════════════════════════════════════════
   Page
═══════════════════════════════════════════════════════════════ */
export default function AdSpendPage() {
  const toast = useToast();

  /* ── Analytics state ── */
  const [platformFilter, setPlatformFilter] = useState("Meta + Google");
  const [branch,  setBranch]   = useState("All");
  const [dateRange, setDateRange] = useState("Last 30 Days");
  const [custom,  setCustom]   = useState({ from:"", to:"" });
  const [mktRows, setMktRows]  = useState([]);
  const [mktNote, setMktNote]  = useState(null);
  const [mktLoading, setMktLoading] = useState(true);
  const [mktError,   setMktError]   = useState(null);

  /* ── Add-entry modal state ── */
  const [showModal, setShowModal] = useState(false);
  const [entries,   setEntries]   = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");
  const [submitting,setSubmitting]= useState(false);

  /* ── Fetch marketing analytics ── */
  const fetchAnalytics = useCallback(async () => {
    if (dateRange === "Custom" && !custom.from) return;
    setMktLoading(true); setMktError(null);
    try {
      const { from, to } = buildDateRange(dateRange, custom);
      const res  = await fetch("/api/owner/marketing-summary", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ branch: branch === "All" ? "All" : branch, from, to }),
      });
      const json = await res.json();
      if (json.success) { setMktRows(json.rows || []); setMktNote(json.note); }
      else setMktError(json.message || "Failed to load analytics");
    } catch { setMktError("Network error"); }
    finally { setMktLoading(false); }
  }, [branch, dateRange, custom]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  /* ── Fetch raw entries (for modal table) ── */
  const fetchEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const res  = await fetch("/api/owner/ad-spend");
      const json = await res.json();
      if (json.success) setEntries(json.entries || []);
    } catch { /* silent */ }
    finally { setEntriesLoading(false); }
  }, []);

  useEffect(() => { if (showModal) fetchEntries(); }, [showModal, fetchEntries]);

  /* ── Form helpers ── */
  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setFormError(""); };
  const handleEdit = (e) => { setEditingId(e._id); setForm({ date:toDateInput(e.date), branch:e.branch, platform:e.platform, campaignName:e.campaignName||"", amount:String(e.amount) }); setFormError(""); };

  const handleDelete = async (e) => {
    if (!window.confirm(`Delete this ${e.platform} entry?`)) return;
    try {
      const res  = await fetch(`/api/owner/ad-spend?id=${e._id}`,{method:"DELETE"});
      const json = await res.json();
      if (json.success) { toast.success("Entry deleted"); if (editingId===e._id) resetForm(); fetchEntries(); fetchAnalytics(); }
      else toast.error(json.message||"Failed to delete");
    } catch { toast.error("Network error"); }
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault(); setFormError("");
    if (!form.date||!form.branch||!form.platform||form.amount==="") { setFormError("Date, branch, platform and amount are required."); return; }
    if (isNaN(Number(form.amount))||Number(form.amount)<0) { setFormError("Amount must be a non-negative number."); return; }
    setSubmitting(true);
    try {
      const url    = editingId ? `/api/owner/ad-spend?id=${editingId}` : "/api/owner/ad-spend";
      const method = editingId ? "PUT" : "POST";
      const res    = await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({date:form.date,branch:form.branch,platform:form.platform,campaignName:form.campaignName,amount:Number(form.amount)})});
      const json   = await res.json();
      if (json.success) { toast.success(editingId?"Entry updated":"Entry added"); resetForm(); fetchEntries(); fetchAnalytics(); }
      else setFormError(json.message||"Failed to save");
    } catch { setFormError("Network error — please try again"); }
    finally { setSubmitting(false); }
  };

  /* ── Derived ── */
  const filteredRows = mktRows.filter((r) => {
    if (platformFilter === "Meta + Google") return true;
    return r.platform === platformFilter;
  });
  const summary     = summarize(filteredRows);
  const campaignRows= filteredRows.filter((r) => !r.isPlatformTotal);

  const metaSummary   = (() => { const r = mktRows.filter((r)=>r.platform==="Meta");   return r.find((x)=>x.isPlatformTotal)||(r.length===1?r[0]:null); })();
  const googleSummary = (() => { const r = mktRows.filter((r)=>r.platform==="Google"); return r.find((x)=>x.isPlatformTotal)||(r.length===1?r[0]:null); })();

  const kpis = [
    { label:"Ad Spend",       value: rupee(summary.totalSpend),     sub:"Meta + Google",           subColor:"#2368f5" },
    { label:"Leads",          value: fmt(summary.totalLeads),        sub: summary.blendedCPL ? `Blended CPL ${rupee(summary.blendedCPL)}` : "No data", subColor:"#2368f5" },
    { label:"Qualified Leads",value: fmt(summary.totalConverted),    sub:"Downstream quality",      subColor:"#0b9e6d" },
    { label:"Surgeries",      value: fmt(summary.totalConverted),    sub:"Attributed completed",    subColor:"#2368f5" },
    { label:"Revenue",        value: rupee(summary.totalRevenue),    sub:"Campaign attributed",     subColor:"#2368f5" },
    { label:"Blended ROAS",   value: roasFmt(summary.blendedROAS),   sub:"Revenue / spend",         subColor: summary.blendedROAS != null && summary.blendedROAS >= 5 ? "#0b9e6d" : "#df4a4a" },
  ];

  return (
    <div className="app">
      <OwnerSidebar />

      <div className="main" style={{ minWidth:0 }}>
        <OwnerTopbar
          title="Meta & Google"
          subtitle="Campaign profitability and patient quality"
          controls={
            <>
              <select className="control" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                {DATE_RANGES.map((r) => <option key={r}>{r}</option>)}
              </select>
              <select className="control" value={branch} onChange={(e) => setBranch(e.target.value)}>
                {BRANCHES.map((b) => <option key={b}>{b}</option>)}
              </select>
              {dateRange === "Custom" && (
                <>
                  <input type="date" className="control" value={custom.from} onChange={(e) => setCustom((p) => ({ ...p, from: e.target.value }))} />
                  <input type="date" className="control" value={custom.to}   onChange={(e) => setCustom((p) => ({ ...p, to: e.target.value }))} />
                </>
              )}
              <button
                onClick={() => setShowModal(true)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 11, border: 0, background: "linear-gradient(135deg,#2368f5,#184dca)", color: "#fff", fontSize: 10, fontWeight: 850, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 6px 16px rgba(35,104,245,.25)" }}
              >
                <Plus className="w-3.5 h-3.5" />
                Manage Entries
              </button>
            </>
          }
        />

        <div className="content" style={{ padding:"18px 20px 34px" }}>
          {/* ── Error ── */}
          {mktError && (
            <div style={{ background:"#fff0f0", border:"1px solid #f5c5c5", borderRadius:13, padding:"10px 14px", marginBottom:14, fontSize:9, color:"#b72727", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span>{mktError}</span>
              <button className="link-btn" onClick={fetchAnalytics}>Retry</button>
            </div>
          )}

          {/* ── Note ── */}
          {mktNote && (
            <div className="notice" style={{ marginBottom:14 }}>
              <div><strong>Branch scope note</strong><p style={{ margin:"3px 0 0" }}>{mktNote}</p></div>
            </div>
          )}

          {/* ── Page heading + Export ── */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
            <div>
              <h2 style={{ fontSize:22, fontWeight:900, margin:0 }}>Meta &amp; Google Profitability</h2>
              <p style={{ fontSize:9, color:"var(--muted)", margin:"4px 0 0" }}>Compare real patient quality, surgeries and revenue—not only CPL</p>
            </div>
            <button
              onClick={()=>exportCSV(filteredRows)}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 16px", borderRadius:11, border:0, background:"linear-gradient(135deg,#2368f5,#184dca)", color:"#fff", fontSize:10, fontWeight:850, cursor:"pointer", boxShadow:"0 8px 20px rgba(35,104,245,.23)", whiteSpace:"nowrap" }}
            >
              <Download className="w-3.5 h-3.5" />
              Export Campaign CSV
            </button>
          </div>

          {/* ── 6 KPI cards ── */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(6,minmax(0,1fr))", gap:10, marginBottom:16 }}>
            {kpis.map((k,i)=>(
              <div key={i} style={{ background:"var(--card)", border:"1px solid var(--line)", borderRadius:16, padding:"13px 14px", boxShadow:"0 5px 18px rgba(15,34,70,.05)" }}>
                <div style={{ fontSize:8, color:"var(--muted)", fontWeight:800, textTransform:"uppercase", letterSpacing:.4 }}>{k.label}</div>
                <div style={{ fontSize:mktLoading?14:18, fontWeight:950, marginTop:5, letterSpacing:"-.3px" }}>
                  {mktLoading ? "…" : k.value}
                </div>
                <div style={{ fontSize:8, fontWeight:800, marginTop:4, color:k.subColor }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Middle: Meta vs Google table + ROAS chart ── */}
          <div style={{ display:"grid", gridTemplateColumns:"1.1fr 1fr", gap:12, marginBottom:16 }}>
            {/* Meta vs Google */}
            <div style={{ background:"var(--card)", border:"1px solid var(--line)", borderRadius:18, padding:16, boxShadow:"0 5px 18px rgba(15,34,70,.05)" }}>
              <div style={{ marginBottom:12 }}>
                <h3 style={{ fontSize:13, fontWeight:900, margin:0 }}>Meta vs Google</h3>
                <p style={{ fontSize:8, color:"#2368f5", margin:"3px 0 0", fontWeight:750 }}>Full-funnel business outcomes</p>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ borderCollapse:"collapse", width:"100%", minWidth:400 }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid var(--line)" }}>
                      {["Platform","Spend","Leads","CPL","Valid","Connect"].map((h)=>(
                        <th key={h} style={{ padding:"8px 10px", fontSize:8, color:"var(--muted)", fontWeight:800, textAlign:"left", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mktLoading ? (
                      <tr><td colSpan={6} style={{ padding:24, textAlign:"center", fontSize:9, color:"var(--muted)" }}>Loading…</td></tr>
                    ) : [{ label:"Meta", s:metaSummary },{ label:"Google", s:googleSummary }].map(({ label, s })=>(
                      s ? (
                        <tr key={label} style={{ borderBottom:"1px solid var(--line)" }}>
                          <td style={{ padding:"10px 10px" }}><PlatformBadge platform={label} /></td>
                          <td style={{ padding:"10px 10px", fontSize:9, fontWeight:750 }}>{rupee(s.spend)}</td>
                          <td style={{ padding:"10px 10px", fontSize:9 }}>{fmt(s.leads)}</td>
                          <td style={{ padding:"10px 10px", fontSize:9 }}>{rupee(s.cpl)}</td>
                          <td style={{ padding:"10px 10px", fontSize:9 }}>{s.leads && s.converted ? pctFmt((s.converted/s.leads)*100) : "—"}</td>
                          <td style={{ padding:"10px 10px", fontSize:9 }}>{s.leads && s.converted ? pctFmt((s.converted/s.leads)*100) : "—"}</td>
                        </tr>
                      ) : (
                        <tr key={label} style={{ borderBottom:"1px solid var(--line)" }}>
                          <td style={{ padding:"10px 10px" }}><PlatformBadge platform={label} /></td>
                          <td colSpan={5} style={{ padding:"10px 10px", fontSize:8, color:"var(--muted)" }}>No spend data for this period</td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ROAS bar chart */}
            <div style={{ background:"var(--card)", border:"1px solid var(--line)", borderRadius:18, padding:16, boxShadow:"0 5px 18px rgba(15,34,70,.05)" }}>
              <div style={{ marginBottom:8 }}>
                <h3 style={{ fontSize:13, fontWeight:900, margin:0 }}>Campaign ROAS</h3>
                <p style={{ fontSize:8, color:"var(--muted)", margin:"3px 0 0" }}>Revenue return per campaign</p>
              </div>
              {mktLoading
                ? <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:160, fontSize:9, color:"var(--muted)" }}>Loading…</div>
                : <RoasBarChart rows={filteredRows} />
              }
            </div>
          </div>

          {/* ── Full campaign breakdown table ── */}
          <div style={{ background:"var(--card)", border:"1px solid var(--line)", borderRadius:18, boxShadow:"0 5px 18px rgba(15,34,70,.05)", overflow:"hidden" }}>
            {/* Sub-header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid var(--line)", flexWrap:"wrap", gap:8 }}>
              <div style={{ display:"flex", gap:7, alignItems:"center" }}>
                <select className="control" value={platformFilter} onChange={(e)=>setPlatformFilter(e.target.value)} style={{ fontSize:10, fontWeight:750 }}>
                  {PLATFORM_OPT.map((p)=><option key={p}>{p}</option>)}
                </select>
                <select className="control" value={branch} onChange={(e)=>setBranch(e.target.value)} style={{ fontSize:10 }}>
                  {BRANCHES.map((b)=><option key={b}>{b==="All"?"All Branches":b}</option>)}
                </select>
              </div>
              <p style={{ fontSize:9, color:"var(--muted)", fontWeight:750, margin:0 }}>
                Downstream events: qualified → consultation → token → surgery → revenue
              </p>
            </div>

            {/* Table */}
            <div style={{ overflowX:"auto", maxHeight:460 }}>
              <table style={{ borderCollapse:"collapse", width:"100%", minWidth:1100, background:"var(--card)" }}>
                <thead>
                  <tr>
                    {["Platform","Campaign","Branch","Spend","Leads","CPL","Qualified CPL","Connect","Consults","Tokens","Surgeries","CAC","Revenue","ROAS","AI Action"].map((h)=>(
                      <th key={h} style={{ position:"sticky", top:0, background:"var(--soft)", padding:"9px 10px", fontSize:8, color:"var(--muted)", fontWeight:800, textAlign:"left", whiteSpace:"nowrap", borderBottom:"1px solid var(--line)", zIndex:2 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mktLoading ? (
                    <tr><td colSpan={15} style={{ padding:32, textAlign:"center", fontSize:9, color:"var(--muted)" }}>Loading campaign data…</td></tr>
                  ) : campaignRows.length === 0 ? (
                    <tr><td colSpan={15} style={{ padding:32, textAlign:"center", fontSize:9, color:"var(--muted)" }}>No campaign data — add spend entries to get started</td></tr>
                  ) : campaignRows.map((r, i) => {
                    const qualCPL      = r.spend && r.converted ? r.spend/r.converted : null;
                    const connectRate  = r.leads && r.converted ? (r.converted/r.leads)*100 : null;
                    const roasVal      = r.roas;
                    let aiAction = "—";
                    if (roasVal != null) {
                      if (roasVal >= 15) aiAction = "Scale";
                      else if (roasVal >= 8)  aiAction = "Increase";
                      else if (roasVal >= 3)  aiAction = "Maintain";
                      else aiAction = "Review";
                    }
                    return (
                      <tr key={i} style={{ borderBottom:"1px solid var(--line)" }}
                        onMouseEnter={(e)=>{ e.currentTarget.style.background="color-mix(in srgb,var(--blue) 4%,var(--card))"; }}
                        onMouseLeave={(e)=>{ e.currentTarget.style.background=""; }}>
                        <td style={{ padding:"9px 10px" }}><PlatformBadge platform={r.platform} /></td>
                        <td style={{ padding:"9px 10px", fontSize:9, fontWeight:750, maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {r.campaignName || <span style={{ color:"var(--muted)" }}>(unnamed)</span>}
                        </td>
                        <td style={{ padding:"9px 10px", fontSize:9 }}>{branch==="All"?"All":branch}</td>
                        <td style={{ padding:"9px 10px", fontSize:9, fontWeight:750 }}>{rupee(r.spend)}</td>
                        <td style={{ padding:"9px 10px", fontSize:9 }}>{fmt(r.leads)}</td>
                        <td style={{ padding:"9px 10px", fontSize:9 }}>{rupee(r.cpl)}</td>
                        <td style={{ padding:"9px 10px", fontSize:9 }}>{rupee(qualCPL)}</td>
                        <td style={{ padding:"9px 10px", fontSize:9 }}>{pctFmt(connectRate)}</td>
                        <td style={{ padding:"9px 10px", fontSize:9 }}>{fmt(r.converted)}</td>
                        <td style={{ padding:"9px 10px", fontSize:9 }}>—</td>
                        <td style={{ padding:"9px 10px", fontSize:9 }}>{fmt(r.converted)}</td>
                        <td style={{ padding:"9px 10px", fontSize:9 }}>{rupee(r.cac)}</td>
                        <td style={{ padding:"9px 10px", fontSize:9, fontWeight:750, color:"var(--green)" }}>{rupee(r.revenue)}</td>
                        <td style={{ padding:"9px 10px" }}>
                          <span style={{ fontWeight:900, fontSize:9, color:roasColor(roasVal) }}>{roasFmt(roasVal)}</span>
                        </td>
                        <td style={{ padding:"9px 10px" }}>
                          <span style={{
                            fontSize:8, fontWeight:850, padding:"3px 7px", borderRadius:999,
                            background: aiAction==="Scale"?"#e6f9f1":aiAction==="Increase"?"#eaf0ff":aiAction==="Maintain"?"#fff7e3":"#fff0f0",
                            color:      aiAction==="Scale"?"#0b7a51":aiAction==="Increase"?"#2368f5":aiAction==="Maintain"?"#9d5609":"#b72727",
                          }}>{aiAction}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!mktLoading && campaignRows.length > 0 && (
              <div style={{ padding:"10px 16px", borderTop:"1px solid var(--line)", fontSize:8, color:"var(--muted)" }}>
                {campaignRows.length} campaign{campaignRows.length!==1?"s":""} · {dateRange}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          Manage Entries Modal
      ══════════════════════════════════════════════════════════ */}
      {showModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(4,10,24,.65)", display:"flex", alignItems:"center", justifyContent:"center", padding:18, zIndex:80 }}>
          <div style={{ width:"min(900px,97vw)", maxHeight:"90vh", overflow:"auto", background:"var(--card)", borderRadius:22, boxShadow:"0 30px 90px rgba(0,0,0,.3)" }}>
            {/* Modal header */}
            <div style={{ position:"sticky", top:0, zIndex:3, background:"var(--card)", borderBottom:"1px solid var(--line)", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px" }}>
              <div>
                <h2 style={{ fontSize:15, margin:0 }}>Manage Ad Spend Entries</h2>
                <p style={{ fontSize:8, color:"var(--muted)", margin:"3px 0 0" }}>Add, edit or delete Meta &amp; Google spend records</p>
              </div>
              <button onClick={()=>{ setShowModal(false); resetForm(); }} style={{ border:0, background:"var(--soft)", color:"var(--text)", width:34, height:34, borderRadius:10, fontSize:16, cursor:"pointer" }}>×</button>
            </div>

            <div style={{ padding:18 }}>
              {/* Entry form */}
              <div style={{ background:"var(--soft)", border:"1px solid var(--line)", borderRadius:14, padding:16, marginBottom:16 }}>
                <h3 style={{ fontSize:12, margin:"0 0 12px", fontWeight:800 }}>{editingId?"Edit Entry":"Add New Entry"}</h3>
                <form onSubmit={handleSubmit}>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:10 }}>
                    <input type="date" className="control" style={{ width:"100%" }} value={form.date} onChange={(e)=>setForm((p)=>({...p,date:e.target.value}))} required />
                    <select className="control" style={{ width:"100%" }} value={form.branch} onChange={(e)=>setForm((p)=>({...p,branch:e.target.value}))} required>
                      <option value="" disabled>Select branch</option>
                      {ALL_BRANCHES.map((b)=><option key={b}>{b}</option>)}
                    </select>
                    <select className="control" style={{ width:"100%" }} value={form.platform} onChange={(e)=>setForm((p)=>({...p,platform:e.target.value}))} required>
                      <option value="" disabled>Platform</option>
                      {PLATFORMS.map((p)=><option key={p}>{p}</option>)}
                    </select>
                    <input type="text" className="control" style={{ width:"100%" }} placeholder="Campaign name (optional)" value={form.campaignName} onChange={(e)=>setForm((p)=>({...p,campaignName:e.target.value}))} />
                    <input type="number" className="control" style={{ width:"100%" }} placeholder="Amount (₹)" min="0" step="0.01" value={form.amount} onChange={(e)=>setForm((p)=>({...p,amount:e.target.value}))} required />
                  </div>
                  {formError && <p style={{ color:"var(--red)", fontSize:9, margin:"0 0 8px" }}>{formError}</p>}
                  <div style={{ display:"flex", gap:8 }}>
                    <button type="submit" className="primary" disabled={submitting}>{submitting?"Saving…":editingId?"Save Changes":"Add Entry"}</button>
                    {editingId && <button type="button" className="link-btn" onClick={resetForm}>Cancel</button>}
                  </div>
                </form>
              </div>

              {/* Entries table */}
              <div style={{ overflowX:"auto", border:"1px solid var(--line)", borderRadius:13 }}>
                <table style={{ borderCollapse:"collapse", width:"100%", background:"var(--card)" }}>
                  <thead>
                    <tr>
                      {["Date","Branch","Platform","Campaign","Amount","By","Actions"].map((h)=>(
                        <th key={h} style={{ background:"var(--soft)", padding:"9px 10px", fontSize:8, color:"var(--muted)", fontWeight:800, textAlign:"left", whiteSpace:"nowrap", borderBottom:"1px solid var(--line)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entriesLoading ? (
                      <tr><td colSpan={7} style={{ padding:24, textAlign:"center", fontSize:9, color:"var(--muted)" }}>Loading…</td></tr>
                    ) : entries.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding:24, textAlign:"center", fontSize:9, color:"var(--muted)" }}>No entries yet</td></tr>
                    ) : entries.map((e)=>(
                      <tr key={e._id} style={{ borderBottom:"1px solid var(--line)" }}>
                        <td style={{ padding:"8px 10px", fontSize:9 }}>{formatDate(e.date)}</td>
                        <td style={{ padding:"8px 10px", fontSize:9 }}>{e.branch}</td>
                        <td style={{ padding:"8px 10px" }}><PlatformBadge platform={e.platform} /></td>
                        <td style={{ padding:"8px 10px", fontSize:9 }}>{e.campaignName||<span style={{ color:"var(--muted)" }}>—</span>}</td>
                        <td style={{ padding:"8px 10px", fontSize:9, fontWeight:750 }}>{formatCurrency(e.amount)}</td>
                        <td style={{ padding:"8px 10px", fontSize:9, color:"var(--muted)" }}>{e.enteredBy?.name||"—"}</td>
                        <td style={{ padding:"8px 10px" }}>
                          <div style={{ display:"flex", gap:5 }}>
                            <button className="ok-btn"     onClick={()=>handleEdit(e)}>Edit</button>
                            <button className="danger-btn" onClick={()=>handleDelete(e)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
