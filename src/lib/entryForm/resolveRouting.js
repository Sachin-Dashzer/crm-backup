// §2.2 Phase 1 — "resolveRouting()" in the spec's src/lib/entryForm/ namespace.
//
// This piece already existed as a pure, exported, unit-testable function — src/constants/
// bankRouting.js's getBankRoutingDefaults (branch/category/method -> { receiptMode, furtherMode }
// pre-fill) and getExpenseFurtherModeDefault (method -> account, for the expense side, which has
// no branch/category split). Nothing to extract there; this module just re-exposes both under the
// name UnifiedEntryForm and the rest of src/lib/entryForm/ will look for, so every future entry-
// form piece lives under one namespace without duplicating the lookup tables themselves.
//
// Do not reimplement the routing tables here — @/constants/bankRouting.js (BANK_ROUTING_MAP,
// EXPENSE_METHOD_ACCOUNT_MAP) stays the single source of truth; this file only re-exports.
export { getBankRoutingDefaults as resolveRouting, getExpenseFurtherModeDefault } from "@/constants/bankRouting";
