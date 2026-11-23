import "server-only";
import { randomInt } from "node:crypto";

/** Code donné au client pour revenir chercher sa bouteille. Sans 0/O ni 1/I. */
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const newGarageCode = () => "G" + Array.from({ length: 5 }, () => ALPHA[randomInt(ALPHA.length)]).join("");

export const garageExpiry = (days: number) => new Date(Date.now() + Math.max(1, days) * 864e5);

export const GARAGE_STATUS: Record<string, string> = {
  STORED: "Au garage",
  RETRIEVED: "Reprise",
  EXPIRED: "Périmée",
};
