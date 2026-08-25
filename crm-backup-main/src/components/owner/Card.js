// .card + .card-title wrapper. `actions` renders on the right of the title row
// (typically a .link-btn button).
export default function Card({ title, subtitle, actions, className = "", children }) {
  return (
    <div className={`card${className ? ` ${className}` : ""}`}>
      {(title || subtitle || actions) && (
        <div className="card-title">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
