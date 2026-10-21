import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fonts + seed data are read from disk at runtime by the image routes / file store.
  outputFileTracingIncludes: {
    "/l/**": ["./assets/fonts/**", "./data/**"],
    "/api/**": ["./data/**"],
    "/admin/**": ["./data/**"],
    "/": ["./data/**"],
  },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};

export default nextConfig;
