// src/app/page.tsx  (⚠️ archivo de servidor)
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import PageClient from './PageClient';

export default function Page() {
  return <PageClient />;
}