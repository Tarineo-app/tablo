import { parseLook } from "@/lib/look";
import Onboarding from "./Onboarding";

export const metadata = { title: "Créer l'espace de votre club · Tablo", description: "5 questions sur votre club, puis votre plan de réservation de carrés VIP. Configuration gratuite, 200 € par mois à la mise en ligne, satisfait ou remboursé 30 jours." };

/** Accueil d'un club : questions d'abord, identifiants à la fin (voir Onboarding.tsx). */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Les réglages choisis sur la page d'accueil (nom, ambiance, couleur…) préremplissent les réponses.
  const look = parseLook(await searchParams);
  return <Onboarding look={look} google={!!process.env.GOOGLE_CLIENT_ID} />;
}
