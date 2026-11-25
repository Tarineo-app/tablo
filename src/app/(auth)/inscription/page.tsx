import { parseLook } from "@/lib/look";
import Onboarding from "./Onboarding";

export const metadata = { title: "Créer l'espace de votre club · Tablo" };

/** Accueil d'un club : questions d'abord, identifiants à la fin (voir Onboarding.tsx). */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Les réglages choisis sur la page d'accueil (nom, ambiance, couleur…) préremplissent les réponses.
  const look = parseLook(await searchParams);
  return <Onboarding look={look} google={!!process.env.GOOGLE_CLIENT_ID} />;
}
