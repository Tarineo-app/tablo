import { login } from "@/app/actions/auth";
import AuthForm from "../AuthForm";

export const metadata = { title: "Connexion · Tablo" };

const ERREURS: Record<string, string> = {
  google: "La connexion avec Google n'a pas abouti. Réessayez ou utilisez votre mot de passe.",
  "google-email": "Google n'a pas confirmé cette adresse email.",
  "google-invitation": "Cette invitation ne correspond pas au compte Google choisi.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  return <AuthForm mode="login" action={login} google={!!process.env.GOOGLE_CLIENT_ID} notice={erreur ? ERREURS[erreur] : undefined} />;
}
