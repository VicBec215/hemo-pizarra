// src/lib/date.ts

export function startOfWeekMonday(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0=Mon..6=Sun
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// ⬇️ NUEVO: ISO local (no UTC)
export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const ROWS = ['Sala 1','Sala 2','Sala 3','Tarde'] as const;
export type RowKey = typeof ROWS[number];

// Tu PROCS igual que los dejaste
export const PROCS = [
  'Coronaria',
  'C.Derecho',
  'ICP',
  'Oclusión crónica',
  'TAVI',
  'Mitraclip',
  'Triclip',
  'Orejuela',
  'FOP',
  'CIA',
  'Otros',
] as const;
export type ProcKey = typeof PROCS[number];

