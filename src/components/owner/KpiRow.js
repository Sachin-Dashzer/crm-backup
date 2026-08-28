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
