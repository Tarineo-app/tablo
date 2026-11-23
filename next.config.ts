import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La landing page est un fichier HTML statique (public/landing.html), servie sur "/".
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/landing.html" }, { source: "/demo", destination: "/demo.html" }], afterFiles: [], fallback: [] };
  },
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "geolocation=(), microphone=(), interest-cohort=()" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ];
    return [
      // Partout : en-têtes de base, et interdiction d'être mis dans une iframe.
      { source: "/:path*", headers: [...base, { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }] },
      // Sauf le widget et la démo, qui sont faits pour vivre dans le site des clubs.
      // La caméra sert au contrôle à l'entrée (/app/entree).
      { source: "/w/:path*", headers: [...base, { key: "Content-Security-Policy", value: "frame-ancestors *" }] },
      { source: "/demo", headers: [...base, { key: "Content-Security-Policy", value: "frame-ancestors 'self'" }] },
      { source: "/demo.html", headers: [...base, { key: "Content-Security-Policy", value: "frame-ancestors 'self'" }] },
      { source: "/app/:path*", headers: [...base, { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }, { key: "Permissions-Policy", value: "camera=(self), geolocation=(), microphone=()" }] },
      { source: "/embed.js", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }, { key: "X-Content-Type-Options", value: "nosniff" }] },
    ];
  },
  serverExternalPackages: ["pg"],
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
