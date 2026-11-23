import { requireMembership } from "@/lib/auth";
import { readTheme } from "@/lib/theme";
import ThemeEditor from "./ThemeEditor";

export const metadata = { title: "Ambiance · Tablo" };

export default async function Page() {
  const { venue } = await requireMembership();
  return (
    <>
      <header>
        <h1>Ambiance et marque</h1>
        <p>Choisissez une ambiance de départ, puis ajustez chaque détail. L&apos;aperçu montre votre widget en direct.</p>
      </header>
      <ThemeEditor initial={readTheme(venue.theme, venue.kind)} venueName={venue.name} />
    </>
  );
}
