import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Los pedidos adjuntan fotos/capturas de WhatsApp, que fácilmente superan
    // el límite por defecto de 1MB para Server Actions.
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
