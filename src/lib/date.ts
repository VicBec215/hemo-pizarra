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
export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export const ROWS = ['Sala 1','Sala 2','Sala 3','Tarde'] as const;
export type RowKey = typeof ROWS[number];

/** Procedimientos (lista cerrada) */
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
