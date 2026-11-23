import type { Metadata } from "next";
import { FONTS_URL } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tablo — réservation de carrés VIP",
  description: "Le widget de réservation de carrés VIP pour clubs, beach clubs et soirées à thème.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={FONTS_URL} />
      </head>
      <body>{children}</body>
    </html>
  );
}
