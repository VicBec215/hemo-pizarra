// src/app/page.tsx
// Server Component (sin estado). Monta el cliente sin SSR para evitar
// problemas de cookies/localStorage en Chrome/Safari.

import dynamic from 'next/dynamic';

export const revalidate = 0;              // no prerender, siempre dinámico
export const dynamic = 'force-dynamic';   // fuerza render 100% en cliente

const PageClient = dynamic(() => import('./PageClient'), { ssr: false });

export default function Page() {
  return <PageClient />;
}