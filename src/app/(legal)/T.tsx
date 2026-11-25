import { isTodo } from "@/lib/legal";

/** Affiche une valeur de l'éditeur ; surlignée tant qu'elle n'est pas renseignée. */
export default function T({ v }: { v: string }) {
  return isTodo(v) ? <mark className="legal-mark">{v}</mark> : <>{v}</>;
}
