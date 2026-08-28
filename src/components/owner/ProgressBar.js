export default function ProgressBar({ value = 0, kind }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={`progress${kind ? ` ${kind}` : ""}`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
