export default function DataTable({
  columns = [],
  rows = [],
  onRowClick,
  tall = false,
  emptyMessage = "No data",
  sortKey,
  sortDir,
  onSort,
}) {
  return (
    <div className={`table-wrap${tall ? " tall" : ""}`}>
      <table>
        <thead>
          <tr>
            {columns.map((col) =>
              col.sortable ? (
                <th key={col.key}>
                  <button
                    type="button"
                    onClick={() => onSort?.(col.key)}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {col.label}
                    {sortKey === col.key && <span>{sortDir === "asc" ? "▲" : "▼"}</span>}
                  </button>
                </th>
              ) : (
                <th key={col.key}>{col.label}</th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="empty" colSpan={columns.length || 1}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={row.id ?? row._id ?? i}
                className={onRowClick ? "clickable" : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
