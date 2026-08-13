// Alphabetical ordering for dropdown option lists.
//
// A bare .sort() compares UTF-16 code units, which puts every capital letter ahead of every
// lowercase one: ["Bob", "amit", "Amit"] sorts to ["Amit", "Bob", "amit"], so the two spellings
// of the same name land in different parts of the list and a user scanning for "amit" finds
// nothing where they expect it. Names in this database are user-entered and inconsistently
// capitalised, so this matters on every person list.
//
// sensitivity: "base" also folds accents, which is what you want for a name picker — "Renu"
// and "Renú" belong next to each other, not pages apart.
//
// Pure and side-effect free: safe to import from both route handlers and client components.
export const byName = (a, b) =>
  String(a ?? "").localeCompare(String(b ?? ""), "en", { sensitivity: "base" });

// Same ordering for lists of objects, keyed on whichever field carries the label.
export const byKey = (key) => (a, b) => byName(a?.[key], b?.[key]);

// The MongoDB equivalent, for lists sorted by the database rather than in JS. Mongo's default
// string sort is a binary comparison and has exactly the same capital-letters-first problem, so
// a .sort({ name: 1 }) that feeds a dropdown needs this alongside it:
//
//   Employee.find(q).sort({ name: 1 }).collation(NAME_COLLATION)
//
// strength 1 matches sensitivity "base" above, so server- and client-sorted lists agree.
export const NAME_COLLATION = { locale: "en", strength: 1 };

// NOTE: deliberately NOT applied to ACCOUNTS, EXPENSE_METHODS, REVENUE_METHODS or the ageing
// buckets. Those are ordered by meaning — alphabetising them would be a regression.
