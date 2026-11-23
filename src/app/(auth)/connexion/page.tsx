import { login } from "@/app/actions/auth";
import AuthForm from "../AuthForm";

export const metadata = { title: "Connexion · Tablo" };
export default function Page() {
  return <AuthForm mode="login" action={login} />;
}
