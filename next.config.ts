import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La landing page est un fichier HTML statique (public/landing.html), servie sur "/".
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/landing.html" }, { source: "/demo", destination: "/demo.html" }], afterFiles: [], fallback: [] };
  },
  // Le widget est affiché dans une iframe sur le site des clubs.
  async headers() {
    return [
      { source: "/w/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] },
      { source: "/embed.js", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] },
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
