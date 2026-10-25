import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // plan files (DWG, PDF, photos) are uploaded through server actions
  experimental: { serverActions: { bodySizeLimit: "50mb" } },
};

export default nextConfig;
