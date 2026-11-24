import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "./db";

/** Caractères sans ambiguïté : le code est lu au téléphone ou recopié à la main. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function offerCode(len = 7) {
  const b = randomBytes(len);
  return Array.from(b, (n) => ALPHABET[n % ALPHABET.length]).join("");
}

export type OfferLine = {
  bottleSizeId?: string | null;
  showId?: string | null;
  flavor?: string | null;
  quantity: number;
  unitCents: number;
  offered: boolean;
};

/**
 * Valeur au tarif public d'une offre. L'écart avec le prix du manager est
 * ce qu'il offre — c'est ce qu'on montre au client, et c'est son argument.
 */
export function listTotal(lines: OfferLine[]) {
  return lines.reduce((a, l) => a + l.unitCents * l.quantity, 0);
}

/** Ce que le manager offre réellement : les lignes marquées offertes, plus la remise. */
export function offeredTotal(lines: OfferLine[], priceCents: number) {
  const list = listTotal(lines);
  return Math.max(0, list - priceCents);
}

/** L'offre vue par le client, avec tout ce qu'il faut pour l'afficher. */
export async function loadOffer(code: string) {
  const offer = await db.offer.findUnique({
    where: { code },
    include: {
      venue: true,
      event: true,
      table: { include: { category: true } },
      manager: { include: { user: { select: { name: true, email: true } } } },
      items: {
        orderBy: { sortOrder: "asc" },
        include: { bottleSize: { include: { bottle: true } }, show: true },
      },
    },
  });
  if (!offer) return null;
  const expired = offer.expiresAt ? offer.expiresAt.getTime() < Date.now() : false;
  return { offer, expired };
}

/** Libellé d'une ligne d'offre, côté client comme côté manager. */
export function lineLabel(it: {
  flavor: string | null;
  bottleSize: { label: string; bottle: { name: string } } | null;
  show: { name: string } | null;
}) {
  if (it.bottleSize) return `${it.bottleSize.bottle.name} ${it.bottleSize.label}${it.flavor ? ` · ${it.flavor}` : ""}`;
  return it.show?.name ?? "Article";
}
