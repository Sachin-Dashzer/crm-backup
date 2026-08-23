// .badge.good/warn/bad/info/purple/neutral, optionally with a leading .dot.
const DOT_COLOR = {
  good: "green",
  warn: "orange",
  bad: "red",
  info: "blue",
  purple: "purple",
  neutral: "gray",
};

export default function Badge({ kind = "neutral", dot = false, children }) {
  return (
    <span className={`badge ${kind}`}>
      {dot && <span className={`dot ${DOT_COLOR[kind] || "gray"}`} />}
      {children}
    </span>
  );
}
