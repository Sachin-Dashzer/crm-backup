export const byName = (a, b) =>
  String(a ?? "").localeCompare(String(b ?? ""), "en", { sensitivity: "base" });

export const byKey = (key) => (a, b) => byName(a?.[key], b?.[key]);

export const NAME_COLLATION = { locale: "en", strength: 1 };

