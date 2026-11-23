import { signup } from "@/app/actions/auth";
import { parseLook } from "@/lib/look";
import AuthForm from "../AuthForm";

export const metadata = { title: "Inscription · Tablo" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Les réglages choisis sur la page d'accueil voyagent dans le formulaire, puis dans un cookie.
  const look = parseLook(await searchParams);
  return (
    <AuthForm
      mode="signup"
      action={signup}
      google={!!process.env.GOOGLE_CLIENT_ID}
      look={look}
      notice={look.club ? `Vos réglages pour ${look.club} sont gardés : vous les retrouverez à l'étape suivante.` : undefined}
      noticeKind="info"
    />
  );
}
