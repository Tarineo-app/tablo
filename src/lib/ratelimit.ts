import "server-only";
import { headers } from "next/headers";

/**
 * Limite simple en mémoire : freine les essais répétés (mot de passe, spam de
 * réservations) sans base ni service externe.
 *
 * Limite connue : sur Vercel, chaque instance a son propre compteur, donc la
 * limite réelle est plus haute que la valeur demandée. C'est un garde-fou,
 * pas une protection contre une attaque distribuée. À remplacer par un
 * compteur partagé (Upstash, table Postgres) quand le trafic le justifiera.
 */
type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

function prune(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, h] of buckets) if (h.resetAt < now) buckets.delete(k);
}

/** Adresse de l'appelant, d'après les en-têtes du proxy. */
export async function callerIp() {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : h.get("x-real-ip") || "inconnu").trim().slice(0, 45);
}

/**
 * Renvoie `null` si l'action est autorisée, sinon un message à afficher.
 * @param scope nom de l'action (ex. "login")
 * @param id    clé supplémentaire (email, slug…) ; l'adresse IP est ajoutée d'office
 */
export async function rateLimit(scope: string, id: string, max: number, windowMs: number): Promise<string | null> {
  const now = Date.now();
  prune(now);
  const key = `${scope}:${await callerIp()}:${id}`;
  const hit = buckets.get(key);
  if (!hit || hit.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  hit.count += 1;
  if (hit.count <= max) return null;
  const minutes = Math.max(1, Math.ceil((hit.resetAt - now) / 60000));
  return `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.`;
}
