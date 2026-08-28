
const INDIAN_CURRENCY_FORMAT = "#,##,##0.00";

function applyCurrencyFormat(ws, rows, currencyCols) {
  if (!currencyCols?.length || !rows.length) return;
  const headers = Object.keys(rows[0]);
  currencyCols.forEach((col) => {
    const colIdx = headers.indexOf(col);
    if (colIdx === -1) return;
    for (let r = 0; r < rows.length; r++) {
      const cellRef = `${String.fromCharCode(65 + colIdx)}${r + 2}`;
      if (ws[cellRef]) ws[cellRef].z = INDIAN_CURRENCY_FORMAT;
    }
  });
}

export async function fetchAllPages(buildUrl, rowsKey, { limit = 200, maxPages = 50 } = {}) {
  const rows = [];
  let page = 1;
  let total = Infinity;

  while (page <= maxPages && rows.length < total) {
    const json = await fetch(buildUrl(page, limit)).then((r) => r.json());
    const batch = json?.[rowsKey] || [];
    total = Number.isFinite(json?.total) ? json.total : rows.length + batch.length;
    rows.push(...batch);
    if (batch.length < limit) break;
    page++;
  }

  return { rows, truncated: rows.length < total };
}

export async function exportWorkbook({ filename, sheets }) {
  const { utils, writeFile } = await import("xlsx");
  const wb = utils.book_new();
  for (const { name, rows, colWidths, currencyCols } of sheets) {
    const ws = utils.json_to_sheet(rows, { cellDates: true });
    applyCurrencyFormat(ws, rows, currencyCols);
    if (colWidths) ws["!cols"] = colWidths.map((w) => ({ wch: w }));
    utils.book_append_sheet(wb, ws, String(name).slice(0, 31).replace(/[[\]:*?/\\]/g, " "));
  }
  writeFile(wb, filename);
}

export function filterProvenanceRows({ branch, dateFrom, dateTo }) {
  return [
    { Field: "Branch", Value: branch || "All" },
    { Field: "From", Value: dateFrom || "All time" },
    { Field: "To", Value: dateTo || "Today" },
    { Field: "Exported At", Value: new Date().toLocaleString("en-IN") },
  ];
}
