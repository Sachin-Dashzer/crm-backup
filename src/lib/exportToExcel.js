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
