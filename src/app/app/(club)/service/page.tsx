import { requireMembership } from "@/lib/auth";
import { tonight } from "@/lib/dates";
import { db } from "@/lib/db";
import Board, { type Envoi } from "./Board";

export const metadata = { title: "Service du soir · Tablo" };

export default async function Page() {
  const { venue, membership } = await requireMembership();
  const event = await db.event.findFirst({ where: { venueId: venue.id, date: tonight() }, orderBy: { date: "asc" } });

  const orders = event
    ? await db.order.findMany({
        where: { venueId: venue.id, reservation: { eventId: event.id, status: { notIn: ["CANCELLED"] } } },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        include: {
          reservation: { include: { table: { include: { category: true } } } },
          takenBy: { include: { user: true } },
          items: { include: { bottleSize: { include: { bottle: true } } } },
        },
      })
    : [];

  // Le reste à encaisser vaut pour tout le carré : on ne l'affiche que sur le premier envoi.
  const firstOrderOf = new Map<string, string>();
  for (const o of [...orders].sort((a, b) => a.number - b.number)) if (!firstOrderOf.has(o.reservationId)) firstOrderOf.set(o.reservationId, o.id);

  const envois: Envoi[] = orders.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    table: o.reservation.table.name,
    category: o.reservation.table.category.name,
    organizer: o.reservation.organizerName,
    guests: o.reservation.guests,
    cashDueCents: firstOrderOf.get(o.reservationId) === o.id && o.reservation.payMode === "CASH"
      ? Math.max(0, o.reservation.totalCents - o.reservation.paidCents)
      : o.cashDueCents,
    takenBy: o.takenBy?.user.name ?? null,
    mine: o.takenById === membership.id,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((it) => ({
      id: it.id,
      quantity: it.quantity,
      label: `${it.bottleSize.bottle.name} ${it.bottleSize.label}${it.flavor ? ` · ${it.flavor}` : ""}`,
    })),
  }));

  return (
    <>
      <header>
        <h1>Service du soir</h1>
        <p>Les bouteilles à apporter aux carrés, dans l&apos;ordre d&apos;arrivée. Prenez un envoi pour que les autres sachent qu&apos;il est pour vous.</p>
      </header>
      <Board envois={envois} eventName={event?.name ?? null} />
    </>
  );
}
