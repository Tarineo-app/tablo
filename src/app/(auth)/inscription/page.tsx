import { signup } from "@/app/actions/auth";
import AuthForm from "../AuthForm";

export const metadata = { title: "Inscription · Tablo" };
export default function Page() {
  return <AuthForm mode="signup" action={signup} google={!!process.env.GOOGLE_CLIENT_ID} />;
}
