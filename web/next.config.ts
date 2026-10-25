import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // plan files (DWG, PDF, photos) are uploaded through server actions
  experimental: { serverActions: { bodySizeLimit: "50mb" } },
  // a shared link's token is its key: never pass it on to another site
  async headers() {
    return [{ source: "/s/:token", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex" }] }];
  },
};

export default nextConfig;
