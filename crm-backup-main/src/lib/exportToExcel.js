// Shared Excel-export helper (Task B, Round 2) — generalises the `writeSheet` pattern already
// duplicated in admin/close-book/page.jsx and admin/reports/page.js so a third and fourth copy
// (Assets/Liabilities) don't repeat it a third and fourth time.
//
// Numbers export as NUMBERS with an Indian-format cell style, not pre-formatted "₹1,23,456"
// strings — a spreadsheet a user pivots or sums needs real numbers. Dates export as real Date
// objects (via json_to_sheet's cellDates option) for the same reason.

const INDIAN_CURRENCY_FORMAT = "#,##,##0.00";

// Applies the Indian currency number format to specific columns of a worksheet, by column key.
function applyCurrencyFormat(ws, rows, currencyCols) {
  if (!currencyCols?.length || !rows.length) return;
  const headers = Object.keys(rows[0]);
  currencyCols.forEach((col) => {
    const colIdx = headers.indexOf(col);
    if (colIdx === -1) return;
    for (let r = 0; r < rows.length; r++) {
      const cellRef = `${String.fromCharCode(65 + colIdx)}${r + 2}`; // row 1 is the header
      if (ws[cellRef]) ws[cellRef].z = INDIAN_CURRENCY_FORMAT;
    }
  });
}

/**
 * Fetch every page of a paginated list endpoint.
 *
 * WHY THIS EXISTS: the Assets and Liabilities exports used to request `?limit=10000`, but
 * /api/receivables/list, /api/payables/list and /api/suspense all clamp limit to 200
 * (see e.g. src/app/api/receivables/list/route.js:28). The excess was silently ignored, so any
 * export covering more than 200 documents quietly produced a truncated spreadsheet with nothing
 * to indicate rows were missing. Raising the server cap would just restore an unbounded endpoint;
 * paging through it keeps the endpoint bounded AND the export complete.
 *
 * @param {(page: number, limit: number) => string} buildUrl
 * @param {string} rowsKey  the array property on the response ("receivables", "payables", …)
 * @param {{limit?: number, maxPages?: number}} [opts]
 * @returns {Promise<{rows: any[], truncated: boolean}>} `truncated` is true only if maxPages was
 *          hit, so callers can warn rather than silently under-report.
 */
export async function fetchAllPages(buildUrl, rowsKey, { limit = 200, maxPages = 50 } = {}) {
  const rows = [];
  let page = 1;
  let total = Infinity;

  while (page <= maxPages && rows.length < total) {
    const json = await fetch(buildUrl(page, limit)).then((r) => r.json());
    const batch = json?.[rowsKey] || [];
    // Trust the server's own total when it reports one; otherwise stop on a short page.
    total = Number.isFinite(json?.total) ? json.total : rows.length + batch.length;
    rows.push(...batch);
    if (batch.length < limit) break;
    page++;
  }

  return { rows, truncated: rows.length < total };
}

/**
 * sheets: [{ name, rows, colWidths?: number[], currencyCols?: string[] }]
 * `rows` should already hold real Date objects for any date field (json_to_sheet's cellDates
 * writes them out as spreadsheet dates automatically) and real numbers for any amount field.
 */
export async function exportWorkbook({ filename, sheets }) {
  const { utils, writeFile } = await import("xlsx");
  const wb = utils.book_new();
  for (const { name, rows, colWidths, currencyCols } of sheets) {
    const ws = utils.json_to_sheet(rows, { cellDates: true });
    applyCurrencyFormat(ws, rows, currencyCols);
    if (colWidths) ws["!cols"] = colWidths.map((w) => ({ wch: w }));
    // Sheet names are capped at 31 chars and can't contain []:*?/\ — every caller in this
    // codebase already uses short plain names, but guard against a future one that doesn't.
    utils.book_append_sheet(wb, ws, String(name).slice(0, 31).replace(/[[\]:*?/\\]/g, " "));
  }
  writeFile(wb, filename);
}

// A Summary sheet's row 1 records the filters used and the export timestamp — an exported file
// with no filter provenance is a support ticket waiting to happen. Every export in this codebase
// should build its Summary sheet's first rows with this, then append its own figures below.
export function filterProvenanceRows({ branch, dateFrom, dateTo }) {
  return [
    { Field: "Branch", Value: branch || "All" },
    { Field: "From", Value: dateFrom || "All time" },
    { Field: "To", Value: dateTo || "Today" },
    { Field: "Exported At", Value: new Date().toLocaleString("en-IN") },
  ];
}
