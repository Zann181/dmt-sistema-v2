import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.1.*", "169.254.182.165", "localhost"],
  // sharp es un módulo nativo — si el bundler de Next lo empaqueta con esbuild
  // se rompe en serverless (Netlify Functions). Se deja como dependencia externa real
  // y se fuerza a incluir su binario nativo en el tracing de salida.
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    // El binario nativo real vive en node_modules/@img/sharp-* (paquete
    // separado por plataforma), no dentro de node_modules/sharp.
    "/api/**/*": ["./node_modules/sharp/**/*", "./node_modules/@img/**/*"],
  },
};

export default nextConfig;
