import type { Metadata } from "next";
import { FONTS_URL } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tablo — réservation de carrés VIP",
  description: "Le widget de réservation de carrés VIP pour clubs, beach clubs et soirées à thème.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://tablo-club.vercel.app"),
  openGraph: { siteName: "Tablo", locale: "fr_FR", type: "website", images: [{ url: "/og.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={FONTS_URL} />
      </head>
      <body>{children}</body>
    </html>
  );
}
