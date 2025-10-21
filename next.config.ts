// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // No bloquees el build por ESLint
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Opcional: si alguna vez te aparece un error de TypeScript en build
  // y quieres desplegar igualmente, déjalo activado. Si prefieres que TS falle el build, ponlo a false.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
