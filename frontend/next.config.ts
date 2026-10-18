import type { NextConfig } from "next";

/** Backend origin for same-origin `/api` proxy (first-party cookies → works in Incognito). */
function backendOrigin(): string {
  const explicit = process.env.BACKEND_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const pub = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (pub) {
    try {
      const url = new URL(pub);
      const path = url.pathname.replace(/\/api\/?$/, "");
      return `${url.origin}${path}`.replace(/\/$/, "") || url.origin;
    } catch {
      // fall through
    }
  }

  return "http://localhost:3001";
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    const target = backendOrigin();
    return [
      {
        source: "/api/:path*",
        destination: `${target}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
