// Row of .kpi cards, e.g.:
//   <KpiRow items={[{ label: "Revenue", value: "₹12.4L", sub: "+8% vs last period", kind: "good" }]} />
// kind controls the .sub modifier class: "good" (default, no class needed), "warn", "bad", "info".
export default function KpiRow({ items = [] }) {
  return (
    <div className="grid kpi-grid">
      {items.map((item, i) => (
        <div className="kpi" key={item.label ?? i}>
          <div className="label">{item.label}</div>
          <div className="value">{item.value}</div>
          {item.sub != null && (
            <div className={`sub${item.kind && item.kind !== "good" ? ` ${item.kind}` : ""}`}>
              {item.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
