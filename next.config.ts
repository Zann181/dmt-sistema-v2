import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.1.*", "169.254.182.165", "localhost"],
};

export default nextConfig;
