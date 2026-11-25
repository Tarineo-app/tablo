import Link from "next/link";
import { EDITEUR, isTodo } from "@/lib/legal";

/** Pages légales : même DA que la landing, une colonne de lecture, les liens entre elles en bas. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const todo = Object.values(EDITEUR).some((v) => typeof v === "string" && isTodo(v));
  return (
    <div className="legal">
      <header className="legal-top">
        <Link href="/" className="logo"><i />tablo</Link>
        <Link href="/inscription" className="btn btn-main legal-cta">Mettre mes carrés en ligne</Link>
      </header>
      {todo && process.env.NODE_ENV !== "production" && <p className="legal-todo">Des informations de l&apos;éditeur restent à compléter dans src/lib/legal.ts.</p>}
      <main className="legal-body">{children}</main>
      <footer className="legal-foot">
        <nav aria-label="Informations légales">
          <Link href="/mentions-legales">Mentions légales</Link>
          <Link href="/cgv">CGV (clubs)</Link>
          <Link href="/cgu">Conditions d&apos;utilisation</Link>
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/cookies">Cookies</Link>
        </nav>
        <p>L&apos;abus d&apos;alcool est dangereux pour la santé, à consommer avec modération.</p>
      </footer>
    </div>
  );
}
