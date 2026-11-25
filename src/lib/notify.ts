import "server-only";
import { GARANTIE_JOURS } from "@/lib/legal";
import { db } from "./db";
import { eur } from "./money";
import { appUrl } from "./stripe";
import { layout, sendEmail } from "./email";

const ALCOHOL = "L'abus d'alcool est dangereux pour la santé, à consommer avec modération.";

/** Confirmation au client, une fois le paiement reçu : son lien contient le QR code d'entrée. */
export async function sendReservationConfirmed(reservationId: string) {
  const r = await db.reservation.findUnique({
    where: { id: reservationId },
    include: { venue: true, event: true, table: { include: { category: true } } },
  });
  if (!r || !r.organizerEmail) return false;
  const date = r.event.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
  const rest = Math.max(0, r.totalCents - r.paidCents);
  const { html, text } = layout({
    venue: r.venue.name,
    title: `Votre carré est confirmé, ${r.organizerName.split(" ")[0]} !`,
    intro: `Rendez-vous ${date}${r.event.name ? ` pour ${r.event.name}` : ""}. Présentez votre QR code à l'entrée, il est sur votre page de réservation.`,
    lines: [
      ["Carré", `${r.table.name} · ${r.table.category.name}`],
      ["Personnes", String(r.guests)],
      ["Total", eur(r.totalCents)],
      ["Déjà payé", eur(r.paidCents)],
      ...(rest > 0 ? ([["Reste à régler au club", eur(rest)]] as [string, string][]) : []),
    ],
    button: { label: "Voir mon QR code", url: `${appUrl()}/w/${r.venue.slug}/r/${r.qrToken}` },
    foot: [r.venue.cancelPolicy, ALCOHOL].filter(Boolean).join(" "),
  });
  return sendEmail({ to: r.organizerEmail, subject: `${r.venue.name} · votre carré ${r.table.name} est confirmé`, html, text, idempotencyKey: `resa-ok-${r.id}` });
}

/** Le paiement est arrivé alors que le carré venait d'être pris : on rembourse et on prévient. */
export async function sendReservationRefunded(reservationId: string) {
  const r = await db.reservation.findUnique({ where: { id: reservationId }, include: { venue: true, table: true } });
  if (!r || !r.organizerEmail) return false;
  const { html, text } = layout({
    venue: r.venue.name,
    title: "Ce carré a été pris pendant votre paiement",
    intro: `Désolé : le carré ${r.table.name} a été réservé par quelqu'un d'autre au même moment. Votre paiement vous est intégralement remboursé (comptez quelques jours selon votre banque). Vous pouvez choisir un autre carré.`,
    button: { label: "Choisir un autre carré", url: `${appUrl()}/w/${r.venue.slug}` },
  });
  return sendEmail({ to: r.organizerEmail, subject: `${r.venue.name} · votre paiement est remboursé`, html, text, idempotencyKey: `resa-refund-${r.id}` });
}

/** Un client demande une offre : on prévient son manager, ou à défaut la direction du club. */
export async function sendOfferRequested(offerId: string) {
  const o = await db.offer.findUnique({
    where: { id: offerId },
    include: { venue: true, event: true, manager: { include: { user: true } } },
  });
  if (!o) return false;
  const to = o.manager
    ? [o.manager.user.email]
    : (await db.membership.findMany({ where: { venueId: o.venueId, role: { in: ["OWNER", "DIRECTOR"] } }, include: { user: true } })).map((m) => m.user.email);
  const date = o.event.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
  const { html, text } = layout({
    venue: o.venue.name,
    title: `${o.clientName ?? "Un client"} vous demande une offre`,
    intro: `Pour ${date}, ${o.guests} personnes.${o.askNote ? ` Son message : « ${o.askNote} »` : ""} Composez-lui sa soirée et envoyez-la : il l'accepte en un clic.`,
    lines: [["Téléphone", o.clientPhone ?? "—"], ["Email", o.clientEmail ?? "—"]],
    button: { label: "Préparer son offre", url: `${appUrl()}/app/offres` },
  });
  const sent = await Promise.all([...new Set(to)].map((t) => sendEmail({ to: t, subject: `Demande d'offre · ${o.clientName ?? "client"} · ${date}`, html, text, idempotencyKey: `offer-ask-${o.id}-${t}` })));
  return sent.some(Boolean);
}

/** Le manager envoie son offre par email (en plus du lien WhatsApp). */
export async function sendOfferToClient(offerId: string) {
  const o = await db.offer.findUnique({ where: { id: offerId }, include: { venue: true, event: true, manager: { include: { user: true } } } });
  if (!o || !o.clientEmail || o.status !== "SENT") return false;
  const date = o.event.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
  const gift = Math.max(0, o.listCents - o.priceCents);
  const who = o.manager?.user.name?.split(" ")[0] ?? o.venue.name;
  const { html, text } = layout({
    venue: o.venue.name,
    title: `${who} vous a préparé votre soirée`,
    intro: `${o.message ? `${o.message} ` : ""}Pour ${date}, ${o.guests} personnes. Tout est prêt : il ne reste qu'à accepter.`,
    lines: [
      ...(gift > 0 ? ([["Valeur à la carte", eur(o.listCents)], [`${who} vous offre`, eur(gift)]] as [string, string][]) : []),
      ["Votre prix", eur(o.priceCents)],
    ],
    button: { label: "Voir et accepter l'offre", url: `${appUrl()}/o/${o.code}` },
    foot: ALCOHOL,
  });
  return sendEmail({ to: o.clientEmail, subject: `${o.venue.name} · votre soirée du ${date}`, html, text, replyTo: o.manager?.user.email });
}

const ownersOf = async (venueId: string) =>
  (await db.membership.findMany({ where: { venueId, role: { in: ["OWNER", "DIRECTOR"] } }, include: { user: true } })).map((m) => m.user.email);

/** J+1 : le club s'est inscrit mais n'a pas encore posé ses carrés. */
export async function sendNudgeTables(venueId: string) {
  const v = await db.venue.findUnique({ where: { id: venueId } });
  if (!v) return false;
  const { html, text } = layout({
    venue: v.name,
    title: "Il vous reste vos carrés à placer",
    intro: "La configuration guidée vous attend là où vous l'avez laissée : vos carrés et leurs prix, vos bouteilles, vos shows, votre première soirée. Comptez une vingtaine de minutes, puis vous mettez en ligne.",
    button: { label: "Reprendre la configuration", url: `${appUrl()}/app/configuration` },
  });
  const r = await Promise.all((await ownersOf(v.id)).map((to) => sendEmail({ to, subject: `${v.name} · plus que vos carrés à placer`, html, text, idempotencyKey: `nudge-tables-${v.id}-${to}` })));
  return r.some(Boolean);
}

/** Club configuré (carrés posés) mais pas encore en ligne, 3 jours après l'inscription : une seule relance. */
export async function sendReadyToLaunch(venueId: string) {
  const v = await db.venue.findUnique({ where: { id: venueId } });
  if (!v || v.billing !== "SETUP") return false;
  const { html, text } = layout({
    venue: v.name,
    title: "Votre plan est prêt. Il ne manque que la mise en ligne.",
    intro: `Vos carrés sont posés. Dès que vous mettez en ligne, vos clients peuvent réserver leur carré, leurs bouteilles et leurs shows, avec l'acompte encaissé sur votre compte. ${GARANTIE_JOURS} jours satisfait ou remboursé : si ça ne vous convient pas, on vous rembourse le premier mois, sans question.`,
    button: { label: "Mettre mes carrés en ligne", url: `${appUrl()}/app/configuration` },
  });
  const r = await Promise.all((await ownersOf(v.id)).map((to) => sendEmail({ to, subject: `${v.name} · prêt à ouvrir vos réservations`, html, text, idempotencyKey: `ready-launch-${v.id}-${to}` })));
  return r.some(Boolean);
}

/** J-2 avant la soirée test : on rappelle ce qui fait vendre. */
export async function sendTrialSoon(venueId: string) {
  const v = await db.venue.findUnique({ where: { id: venueId } });
  if (!v?.trialEventId) return false;
  const ev = await db.event.findUnique({ where: { id: v.trialEventId } });
  if (!ev) return false;
  const date = ev.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
  const { html, text } = layout({
    venue: v.name,
    title: `Votre soirée test, c'est ${date}`,
    intro: "Ajoutez vos shows et vos pancartes : c'est ce que vos clients découvrent en réservant. Puis mettez le lien de réservation dans votre bio Instagram et envoyez-le à vos managers.",
    lines: [["Votre lien de réservation", `${appUrl()}/w/${v.slug}`]],
    button: { label: "Vérifier mes shows", url: `${appUrl()}/app/shows` },
  });
  const r = await Promise.all((await ownersOf(v.id)).map((to) => sendEmail({ to, subject: `${v.name} · votre soirée test approche`, html, text, idempotencyKey: `trial-soon-${v.id}-${ev.id}-${to}` })));
  return r.some(Boolean);
}

/** Le lendemain matin de la soirée test : le bilan, puis l'abonnement. */
export async function sendTrialReport(venueId: string, report: { tables: number; guests: number; engagedCents: number }) {
  const v = await db.venue.findUnique({ where: { id: venueId } });
  if (!v) return false;
  const { html, text } = layout({
    venue: v.name,
    title: "Le bilan de votre soirée test",
    intro: report.tables > 0
      ? "Voici ce que Tablo a vendu pour vous cette nuit, sans commission. Pour garder vos prochaines soirées ouvertes, il suffit de vous abonner."
      : "Votre soirée test est passée. Pour rouvrir les réservations de vos prochaines soirées, il suffit de vous abonner.",
    lines: [["Carrés réservés", String(report.tables)], ["Personnes attendues", String(report.guests)], ["Engagé sur les carrés", eur(report.engagedCents)]],
    button: { label: "Garder mes soirées ouvertes", url: `${appUrl()}/app/abonnement` },
    foot: "200 € par mois, sans engagement, zéro commission sur vos réservations.",
  });
  const r = await Promise.all((await ownersOf(v.id)).map((to) => sendEmail({ to, subject: `${v.name} · le bilan de votre soirée test`, html, text, idempotencyKey: `trial-report-${v.id}-${to}` })));
  return r.some(Boolean);
}
