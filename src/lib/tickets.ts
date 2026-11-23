/**
 * Billetterie : les tarifs dépendent de l'heure d'arrivée.
 * Une soirée est stockée à midi UTC le jour J. Une heure avant 12:00 (ex. "00:30")
 * tombe donc dans la nuit, le lendemain du jour J.
 */

/** Heure de Paris → instant UTC. */
function parisToUtc(ymd: string, hm: string) {
  const [y, mo, d] = ymd.split("-").map(Number);
  const [h, mi] = hm.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess));
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asParis = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
  return new Date(guess - (asParis - guess));
}

/** Instant limite d'arrivée d'un tarif (null = toute la nuit). */
export function tierDeadline(eventDate: Date, untilTime: string | null): Date | null {
  if (!untilTime || !/^\d{2}:\d{2}$/.test(untilTime)) return null;
  const day = new Date(eventDate);
  if (Number(untilTime.slice(0, 2)) < 12) day.setUTCDate(day.getUTCDate() + 1);
  return parisToUtc(day.toISOString().slice(0, 10), untilTime);
}

/** "00:30" → "0 h 30", "23:00" → "23 h". */
export const fmtTime = (t: string) => {
  const [h, m] = t.split(":");
  return `${Number(h)} h${m === "00" ? "" : ` ${m}`}`;
};

export function tierLabel(t: { untilTime: string | null; drinks: number }) {
  const when = t.untilTime ? `Arrivée avant ${fmtTime(t.untilTime)}` : "Toute la nuit";
  const conso = t.drinks === 0 ? "sans conso" : t.drinks === 1 ? "1 conso incluse" : `${t.drinks} consos incluses`;
  return `${when} · ${conso}`;
}

/** Statuts qui comptent dans les places vendues. */
export const SOLD = ["PENDING", "PAID", "CHECKED_IN"] as const;
