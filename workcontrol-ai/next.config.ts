import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone-сборка нужна только для Docker (NEXT_STANDALONE=1)
  output: process.env.NEXT_STANDALONE ? "standalone" : undefined,
  serverExternalPackages: ["better-sqlite3", "mailparser", "exceljs", "unpdf", "jszip"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
