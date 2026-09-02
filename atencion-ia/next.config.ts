import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Este proyecto vive en un subdirectorio de otro repo con su propio
  // package-lock.json (la app "qhatu" original) — sin esto, Turbopack
  // detecta ambos lockfiles y adivina mal la raíz del workspace.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
