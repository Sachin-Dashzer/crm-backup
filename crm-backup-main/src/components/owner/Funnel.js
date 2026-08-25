// .funnel bars from [{ label, value, sub }]. Bar height is proportional to the largest
// value in the set (or `maxValue` if the caller wants a fixed scale across re-renders).
const FUNNEL_MAX_BAR_PX = 140;

export default function Funnel({ items = [], maxValue }) {
  const max = maxValue ?? Math.max(1, ...items.map((item) => item.value || 0));

  return (
    <div className="funnel">
      {items.map((item, i) => (
        <div className="funnel-item" key={item.label ?? i}>
          <div
            className="funnel-bar"
            style={{ height: `${Math.max(10, ((item.value || 0) / max) * FUNNEL_MAX_BAR_PX)}px` }}
          />
          <strong>{item.value}</strong>
          <small>{item.sub ? `${item.label} · ${item.sub}` : item.label}</small>
        </div>
      ))}
    </div>
  );
}
