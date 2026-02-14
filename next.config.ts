import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "i.discogs.com" },
      { hostname: "img.discogs.com" },
      { hostname: "i.scdn.co" },
      { hostname: "coverartarchive.org" },
    ],
  },
};

export default nextConfig;
