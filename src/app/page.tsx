// src/app/page.tsx
// Server Component mínimo. Importa el componente cliente y fuerza modo dinámico.

import PageClient from './PageClient';

export const dynamic = 'force-dynamic'; // evita prerender/ISR
export const revalidate = 0;            // sin cacheo estático

export default function Page() {
  return <PageClient />;
}