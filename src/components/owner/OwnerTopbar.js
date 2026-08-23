// .topbar — title/subtitle on the left, arbitrary controls (selects, search, buttons) on the
// right inside .top-actions.
export default function OwnerTopbar({ title, subtitle, controls }) {
  return (
    <div className="topbar">
      <div>
        {title && <h1>{title}</h1>}
        {subtitle && <p>{subtitle}</p>}
      </div>
      {controls && <div className="top-actions">{controls}</div>}
    </div>
  );
}
