export const eur = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 ? 2 : 0 });

export const toCents = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

export const depositOf = (totalCents: number, pct: number) => Math.ceil((totalCents * pct) / 100);
