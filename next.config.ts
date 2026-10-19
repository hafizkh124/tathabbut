import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the commit this build was made from, so the page can tell when a newer deployment is live (src/lib/updateWatch.ts)
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
};

export default nextConfig;
