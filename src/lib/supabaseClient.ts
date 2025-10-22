// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,        // ⬅️ importante para Chrome
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'hemo-pizarra.auth', // clave propia para evitar interferencias
    },
  }
);
