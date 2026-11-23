import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { tonight } from "@/lib/dates";
import Door from "./Door";

export const metadata = { title: "Contrôle entrée · Tablo" };

export default async function Page() {
  const { venue } = await requireMembership();
  const event = await db.event.findFirst({ where: { venueId: venue.id, date: tonight() }, orderBy: { date: "asc" } });
  const stats = event
    ? await db.ticket.aggregate({ where: { eventId: event.id, status: { not: "CANCELLED" } }, _sum: { quantity: true, checkedIn: true } })
    : null;
  return (
    <>
      <header>
        <h1>Contrôle entrée</h1>
        <p>Scannez le QR code du client ou tapez son code. Ça marche pour les billets d&apos;entrée et pour les carrés.</p>
      </header>
      {event && stats && (
        <p className="mute" style={{ marginTop: -6 }}>
          {event.name || "Soirée de ce soir"} : <b style={{ color: "var(--text)" }}>{stats._sum.checkedIn ?? 0}</b> entrés sur {stats._sum.quantity ?? 0} billets vendus.
        </p>
      )}
      <Door />
    </>
  );
}
