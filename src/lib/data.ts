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
  done: boolean;
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
    .select('id, name, room, dx, proc, day, row, ord, done')
    .gte('day', mondayISO)
    .lte('day', fridayISO)
    .order('day', { ascending: true })
    .order('row', { ascending: true })
    .order('ord', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Item[];
}

export async function addItem(input: {
  name?: string;
  room?: string;
  dx?: string;
  proc: ProcKey;
  day: string;
  row: RowKey;
  done?: boolean; // nuevo campo, por defecto false
}) {
  const max = await getMaxOrd(input.day, input.row);
  const { data, error } = await supabase
    .from('items')
    .insert([{
      name: input.name ?? '',
      room: input.room ?? '',
      dx: input.dx ?? '',
      proc: input.proc,
      day: input.day,
      row: input.row,
      ord: max + 10,          // ⬅️ inserta al final de la celda
      done: input.done ?? false,
    }])
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Item;
}

// src/lib/data.ts (solo la función updateItem)
export async function updateItem(id: string, patch: Partial<Pick<Item, 'name'|'room'|'dx'|'proc'|'day'|'row'|'ord'|'done'>>) {
  const { error } = await supabase.from('items').update(patch).eq('id', id);
  if (error) throw error;
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
  const { data: session } = await supabase.auth.getSession();
  const user = session?.session?.user;
  if (!user) return 'unknown';

  // Si tienes una tabla 'editors' o 'profiles' para marcar editores:
  const { data } = await supabase.from('editors').select('user_id').eq('user_id', user.id).maybeSingle();
  return data ? 'editor' : 'viewer';
}
