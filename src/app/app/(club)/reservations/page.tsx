import { redirect } from "next/navigation";

/** Ancienne adresse : les réservations ont rejoint la page Ventes. */
export default function Page() {
  redirect("/app/ventes");
}
