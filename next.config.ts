import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.1.*", "169.254.182.165", "localhost"],
  // sharp es un módulo nativo — si el bundler de Next lo empaqueta con esbuild
  // se rompe en serverless (Netlify Functions). Se deja como dependencia externa real.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
