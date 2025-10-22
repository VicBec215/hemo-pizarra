// ❌ NO pongas "use client" aquí: este archivo debe ser de servidor

// Forzamos que esta ruta NO se prerrenderice ni se cachee
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import PageClient from './PageClient';

export default function Page() {
  return <PageClient />;
}