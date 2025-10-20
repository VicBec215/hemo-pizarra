// src/lib/data.ts
import { supabase } from './supabaseClient';
import { RowKey, ProcKey } from './date';

export type Item = {
  id: string;
  name: string;
  room: string;
  dx: string;
  proc: ProcKey;
  day: string;   // 'YYYY-MM-DD'
  row: RowKey;   // 'Sala 1' | 'Sala 2' | 'Sala 3' | 'Tarde'
  ord: number;   // orden libre (puede tener huecos)
  created_at: string;
  created_by: string | null;
};

/** ord máximo en (day,row) ; 0 si no hay filas */
export async function getMaxOrd(day: string, row: RowKey): Promise<number> {
  const { data, error } = await supabase
    .from('items')
    .select('ord')
    .eq('day', day)
    .eq('row', row)
    .order('ord', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.ord ?? 0;
}

/** ord mínimo en (day,row) ; 1 si no hay filas (para que min-1 = 0 funcione) */
export async function getMinOrd(day: string, row: RowKey): Promise<number> {
  const { data, error } = await supabase
    .from('items')
    .select('ord')
    .eq('day', day)
    .eq('row', row)
    .order('ord', { ascending: true })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.ord ?? 1;
}

export async function listWeek(mondayISO: string) {
  const monday = new Date(mondayISO);
  const friday = new Date(monday); friday.setDate(friday.getDate() + 4);
  const fridayISO = friday.toISOString().slice(0,10);

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .gte('day', mondayISO)
    .lte('day', fridayISO)
    .order('day', { ascending: true })
    .order('row', { ascending: true })
    .order('ord', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Item[];
}

/** Inserta al final de la celda (day,row) usando ord = max + 1 */
export async function addItem(partial: Omit<Item,'id'|'created_at'|'created_by'|'ord'>) {
  const max = await getMaxOrd(partial.day, partial.row);
  const { data, error } = await supabase
    .from('items')
    .insert([{ ...partial, ord: max + 1 }])
    .select('*')
    .single();
  if (error) throw error;
  return data as Item;
}

export async function updateItem(id: string, patch: Partial<Item>) {
  const { data, error } = await supabase
    .from('items')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Item;
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) throw error;
}

export function subscribeItems(onChange: () => void) {
  const channel = supabase
    .channel('items-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function getMyRole(): Promise<'editor'|'viewer'|'unknown'> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'unknown';
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return (data?.role ?? 'viewer') as any;
}
