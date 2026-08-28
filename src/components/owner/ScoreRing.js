export default function ScoreRing({ value = 0, label, sublabel, size, color = "var(--green)" }) {
  const pct = Math.min(100, Math.max(0, value));
  const style = {
    background: `conic-gradient(${color} 0 ${pct}%, var(--line) ${pct}%)`,
  };
  if (size) {
    style.width = size;
    style.height = size;
  }

  return (
    <div className="score-ring" style={style}>
      <div>
        <strong>{label ?? Math.round(pct)}</strong>
        {sublabel && <span>{sublabel}</span>}
      </div>
    </div>
  );
}
