# Known gaps — out of scope

Carried over verbatim from the accounting layer refactor spec. Flagged here, not built:

- Fixed assets and depreciation.
- Closing stock as an asset / COGS derivation.
- An Equity/Capital head — without one, the balance sheet cannot currently tally.
- Business borrowings as a liability head.
- GST input/output as real payables (currently display-only, by design).
- Prepaid expenses and vendor advances.
- Bank statement reconciliation.
- Money is stored as JS `Number` (float), which can drift at paise level across large
  transaction volumes.
