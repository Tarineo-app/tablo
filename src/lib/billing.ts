import "server-only";
import { db } from "./db";
import { now } from "./dates";

/**
 * Essai par soirée : le club construit tout gratuitement, choisit UNE soirée
 * offerte, et ne paie qu'ensuite — le lendemain d'une vraie nuit, chiffres en main.
 *
 *   SETUP  → il prépare. Les réservations ne sont pas ouvertes au public.
 *   TRIAL  → sa soirée d'essai est choisie : tout fonctionne.
 *   LOCKED → la soirée d'essai est passée. Il faut s'abonner pour rouvrir.
 *   ACTIVE → abonné, tout est ouvert.
 */
export type Gate = {
  open: boolean; // le widget accepte-t-il des réservations ?
  state: "SETUP" | "TRIAL" | "ACTIVE" | "LOCKED";
  trialEventId: string | null;
  message: string | null; // ce que voit le client quand c'est fermé
};

type VenueGate = {
  billing: "SETUP" | "TRIAL" | "ACTIVE" | "LOCKED";
  trialEventId: string | null;
};

/** Ce que le public peut faire, pour une soirée donnée. */
export function gateFor(venue: VenueGate, eventId?: string | null): Gate {
  const base = { state: venue.billing, trialEventId: venue.trialEventId };
  if (venue.billing === "ACTIVE") return { ...base, open: true, message: null };
  if (venue.billing === "TRIAL") {
    const ok = !eventId || eventId === venue.trialEventId;
    return { ...base, open: ok, message: ok ? null : "Les réservations de cette soirée ne sont pas encore ouvertes." };
  }
  if (venue.billing === "SETUP") return { ...base, open: false, message: "Les réservations ouvrent très bientôt." };
  return { ...base, open: false, message: "Les réservations de cette soirée ne sont pas encore ouvertes." };
}

/**
 * Passe le club en LOCKED une fois sa soirée d'essai terminée, et note la date
 * pour lui montrer son bilan. Appelé à l'ouverture de l'espace club.
 */
export async function closeTrialIfOver(venueId: string) {
  const v = await db.venue.findUnique({ where: { id: venueId }, select: { billing: true, trialEventId: true, trialClosedAt: true } });
  if (!v || v.billing !== "TRIAL" || !v.trialEventId) return;
  const ev = await db.event.findUnique({ where: { id: v.trialEventId }, select: { date: true } });
  if (!ev) return;
  // la nuit est finie le lendemain à 8 h
  const over = new Date(ev.date);
  over.setDate(over.getDate() + 1);
  over.setHours(8, 0, 0, 0);
  if (+now() < +over) return;
  await db.venue.update({ where: { id: venueId }, data: { billing: "LOCKED", trialClosedAt: v.trialClosedAt ?? new Date() } });
}

/** Le bilan de la soirée d'essai : ce qu'on lui montre au moment de payer. */
export async function trialReport(venueId: string, eventId: string) {
  const [res, tickets] = await Promise.all([
    db.reservation.findMany({ where: { eventId, venueId, status: { not: "CANCELLED" } }, select: { totalCents: true, guests: true } }),
    db.ticket.findMany({ where: { eventId, venueId, status: { in: ["PAID", "CHECKED_IN"] } }, select: { quantity: true, totalCents: true } }),
  ]);
  return {
    tables: res.length,
    guests: res.reduce((a, r) => a + r.guests, 0),
    engagedCents: res.reduce((a, r) => a + r.totalCents, 0),
    entries: tickets.reduce((a, t) => a + t.quantity, 0),
    entriesCents: tickets.reduce((a, t) => a + t.totalCents, 0),
  };
}
