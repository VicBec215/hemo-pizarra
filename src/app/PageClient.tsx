'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  startOfWeekMonday,
  addDays,
  toISODate,
  ROWS,
  RowKey,
  PROCS,
  ProcKey,
} from '@/lib/date';
import {
  listWeek,
  addItem,
  updateItem,
  deleteItem,
  subscribeItems,
  getMyRole,
  Item,
  getMaxOrd,
} from '@/lib/data';

import {
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown,
  Plus, Trash2, Calendar, ChevronsUp, ChevronsDown,
  Save, X, Pencil, Download, CheckCircle2, Circle,
} from 'lucide-react';

/* ===== helpers ===== */

function procColor(proc: ProcKey): string {
  const p = proc.toLowerCase();
  if (p === 'coronaria' || p === 'c.derecho') return 'bg-green-100 text-green-800 border-green-300';
  if (p === 'icp') return 'bg-orange-100 text-orange-800 border-orange-300';
  if (p === 'oclusión crónica' || p === 'oclusion crónica' || p === 'oclusión cronica' || p === 'oclusion cronica')
    return 'bg-red-100 text-red-800 border-red-300';
  if (['tavi','mitraclip','triclip','orejuela','fop','cia'].includes(p))
    return 'bg-purple-100 text-purple-800 border-purple-300';
  return 'bg-gray-200 text-gray-900 border-gray-300';
}

function showErr(e: unknown) {
  try {
    const o = e as Record<string, unknown>;
    const msg =
      (o?.message as string) ||
      (o?.['error'] as any)?.message ||
      (o?.details as string) ||
      (o?.hint as string) ||
      (o?.code as string) ||
      JSON.stringify(o, Object.getOwnPropertyNames(o ?? {}) as any) ||
      String(e);
    // eslint-disable-next-line no-console
    console.error('ERROR:', e);
    alert(msg || 'Error desconocido');
  } catch {
    alert('Error (sin detalles). Revisa la consola.');
  }
}

/* ===== UI: editor inline ===== */

function InlineEditorCard({
  title = 'Nuevo paciente',
  initial = { name: '', room: '', dx: '', proc: 'Coronaria' as ProcKey },
  onSave,
  onCancel,
}: {
  title?: string;
  initial?: { name: string; room: string; dx: string; proc: ProcKey };
  onSave: (vals: { name: string; room: string; dx: string; proc: ProcKey }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [room, setRoom] = useState(initial.room);
  const [dx, setDx] = useState(initial.dx);
  const [proc, setProc] = useState<ProcKey>(initial.proc);

  return (
    <div className="bg-white rounded-xl border p-3 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <div className="flex items-center gap-1">
          <button className="p-1 rounded hover:bg-gray-100" title="Cancelar" onClick={onCancel}>
            <X className="w-4 h-4" />
          </button>
          <button className="p-1 rounded hover:bg-gray-100" title="Guardar" onClick={() => onSave({ name, room, dx, proc })}>
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Nombre grande a doble columna */}
        <label className="text-xs md:col-span-2">
          Nombre/ID (evitar nombre completo)
          <input
            className="mt-1 w-full border rounded px-3 h-11 text-base md:text-lg"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Iniciales o ID"
          />
        </label>

        <label className="text-xs">
          Habitación
          <input
            className="mt-1 w-full border rounded px-2 h-10"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="312B"
          />
        </label>

        <label className="text-xs">
          Diagnóstico (texto libre)
          <input
            className="mt-1 w-full border rounded px-2 h-10"
            value={dx}
            onChange={(e) => setDx(e.target.value)}
            placeholder="p. ej., SCA…"
          />
        </label>

        <label className="text-xs">
          Procedimiento
          <select
            className="mt-1 w-full border rounded px-2 h-10 bg-white"
            value={proc}
            onChange={(e) => setProc(e.target.value as ProcKey)}
          >
            {PROCS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

/* ===== raíz cliente ===== */

export default function PageClient() {
  const [authReady, setAuthReady] = useState(false);
  const [role, setRole] = useState<'editor' | 'viewer' | 'unknown'>('unknown');

  useEffect(() => {
    let unsub: { subscription: { unsubscribe: () => void } } | null = null;

    const boot = async () => {
      const { data } = await supabase.auth.getUser();
      // eslint-disable-next-line no-console
      console.log('[AUTH] mount user =', !!data.user);
      setAuthReady(true);
      setRole(data.user ? await getMyRole() : 'unknown');

      unsub = supabase.auth.onAuthStateChange(async (_ev, sess) => {
        // eslint-disable-next-line no-console
        console.log('[AUTH] onAuthStateChange user =', !!sess?.user);
        setAuthReady(true);
        setRole(sess?.user ? await getMyRole() : 'unknown');
      });
    };

    boot();
    return () => { unsub?.subscription.unsubscribe(); };
  }, []);

  return (
    <div className="p-4 max-w-[1200px] mx-auto">
      <Header role={role} />
      {!authReady ? (
        <div className="mt-4 text-sm text-gray-600">Cargando sesión…</div>
      ) : role === 'unknown' ? (
        <AuthBlock />
      ) : (
        <Board role={role} />
      )}
    </div>
  );
}

/* ===== cabecera / auth ===== */

function Header({ role }: { role: 'editor' | 'viewer' | 'unknown' }) {
  return (
    <div className="mb-4 flex justify-between items-center">
      <div className="text-xl font-semibold">Agenda Hemodinámica — Pizarra semanal</div>
      <div className="flex gap-2 items-center">
        <span className="text-sm px-2 py-1 border rounded-full bg-white">
          {role === 'editor' ? 'Editor' : role === 'viewer' ? 'Solo lectura' : 'No autenticado'}
        </span>
        <AuthButtons />
      </div>
    </div>
  );
}

function AuthButtons() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const login = async () => {
    try {
      if (!email || !password) { alert('Introduce email y contraseña'); return; }
      setBusy(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.replace('/');
    } catch (e) { showErr(e); } finally { setBusy(false); }
  };

  const sendReset = async () => {
    try {
      if (!email) { alert('Introduce tu email'); return; }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      alert('Te hemos enviado un correo para restablecer tu contraseña.');
    } catch (e) { showErr(e); }
  };

  const logout = async () => {
    try {
      setBusy(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      localStorage.removeItem('supabase.auth.token');
      window.location.replace('/');
    } catch (e) { showErr(e); } finally { setBusy(false); }
  };

  return (
    <div className="flex gap-2 items-center">
      <input
        className="border rounded px-2 py-1 text-sm"
        placeholder="tu-email@hospital.es"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="username"
      />
      <input
        className="border rounded px-2 py-1 text-sm"
        placeholder="Contraseña"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
      />
      <button className="px-3 py-1 rounded border bg-white text-sm disabled:opacity-60"
              onClick={login} disabled={busy}>Entrar</button>
      <button className="px-3 py-1 rounded border bg-white text-sm"
              onClick={sendReset}>¿Olvidaste la contraseña?</button>
      <button className="px-3 py-1 rounded border bg-white text-sm disabled:opacity-60"
              onClick={logout} disabled={busy}>Salir</button>
    </div>
  );
}

function AuthBlock() {
  return (
    <div className="border rounded-lg bg-white p-6">
      <div className="mb-2 font-medium">Accede para ver la pizarra</div>
      <div className="text-sm text-gray-600">
        Introduce tu email y contraseña en la parte superior. Si no recuerdas la contraseña, usa “¿Olvidaste la contraseña?”.
      </div>
    </div>
  );
}

/* ===== tablero ===== */

function Board({ role }: { role: 'editor' | 'viewer' }) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');

  const [draftCell, setDraftCell] = useState<{ day: string; row: RowKey } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const dayKeys = useMemo(() => days.map(toISODate), [days]);
  const todayISO = toISODate(new Date());

  const reload = useCallback(async () => {
    setItems(await listWeek(toISODate(weekStart)));
  }, [weekStart]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { const unsub = subscribeItems(reload); return () => unsub(); }, [reload]);

  const canEdit = role === 'editor';

  const DAY_COL_WIDTH = 360;
  const FIRST_COL_WIDTH = 160;
  const minWidth = FIRST_COL_WIDTH + 5 * DAY_COL_WIDTH;

  function exportCSV() {
    const rows: string[] = [];
    rows.push(['Día','Sala/Turno','Orden','Nombre/ID','Habitación','Diagnóstico','Procedimiento','Finalizado']
      .map(escapeCSV).join(','));

    for (const day of dayKeys) {
      for (const row of ROWS) {
        const cell = items.filter(i => i.day === day && i.row === row).sort((a,b)=>a.ord-b.ord);
        cell.forEach((it, idx) => {
          rows.push([
            day, row, String(idx+1),
            it.name ?? '', it.room ?? '', it.dx ?? '', it.proc ?? '',
            it.done ? 'Sí' : 'No',
          ].map(escapeCSV).join(','));
        });
      }
    }
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `pizarra_${dayKeys[0]}_a_${dayKeys[4]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  /* ---- movimiento robusto ↑ / ↓ con PARK entero ---- */
  const moveOneUp = async (it: Item) => {
    const cell = items.filter(i => i.day === it.day && i.row === it.row).sort((a,b)=>a.ord-b.ord);
    const idx = cell.findIndex(i => i.id === it.id); if (idx <= 0) return;
    const prev = cell[idx - 1];
    // valores ENTEROS para evitar errores de tipo integer
    const itOrd   = Number(it.ord);
    const prevOrd = Number(prev.ord);
    const minOrd  = Number(cell[0]?.ord ?? 0);
    const PARK    = Math.floor(minOrd) - 100000;

    try {
      await updateItem(it.id,   { ord: PARK });
      await updateItem(prev.id, { ord: itOrd });
      await updateItem(it.id,   { ord: prevOrd });
    } catch (e) { showErr(e); }
  };

  const moveOneDown = async (it: Item) => {
    const cell = items.filter(i => i.day === it.day && i.row === it.row).sort((a,b)=>a.ord-b.ord);
    const idx = cell.findIndex(i => i.id === it.id); if (idx === -1 || idx >= cell.length - 1) return;
    const next = cell[idx + 1];
    const itOrd  = Number(it.ord);
    const nxtOrd = Number(next.ord);
    const maxOrd = Number(cell[cell.length-1]?.ord ?? 0);
    const PARK   = Math.ceil(maxOrd) + 100000;

    try {
      await updateItem(it.id,   { ord: PARK });
      await updateItem(next.id, { ord: itOrd });
      await updateItem(it.id,   { ord: nxtOrd });
    } catch (e) { showErr(e); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className="px-2 py-1 border rounded bg-white" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <ArrowLeft className="inline w-4 h-4" /> Semana anterior
        </button>
        <button className="px-2 py-1 border rounded bg-white" onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>
          <Calendar className="inline w-4 h-4" /> Esta semana
        </button>
        <button className="px-2 py-1 border rounded bg-white" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          Siguiente semana <ArrowRight className="inline w-4 h-4" />
        </button>

        <input className="ml-auto border rounded px-2 py-1" placeholder="Buscar…"
               value={search} onChange={(e) => setSearch(e.target.value)} />

        <button className="px-2 py-1 border rounded bg-white flex items-center gap-1" onClick={exportCSV} title="Exportar semana en CSV">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      <div className="border rounded-lg overflow-x-auto touch-pan-x">
        <div style={{ minWidth }}>
          <div className="grid" style={{ gridTemplateColumns: `${FIRST_COL_WIDTH}px repeat(5, ${DAY_COL_WIDTH}px)` }}>
            <div className="bg-gray-100 border-b px-3 py-2 font-medium sticky top-0 left-0 z-20">Sala/Turno</div>
            {days.map((d, i) => {
              const isToday = toISODate(d) === todayISO;
              return (
                <div key={i}
                     className={`border-b px-3 py-2 font-medium sticky top-0 z-10 ${isToday ? 'bg-red-50 text-red-700' : 'bg-gray-100'}`}>
                  {d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                </div>
              );
            })}

            {ROWS.map((row) => (
              <RowBlock
                key={row}
                row={row}
                dayKeys={dayKeys}
                items={items}
                canEdit={canEdit}
                search={search}
                draftCell={draftCell}
                setDraftCell={setDraftCell}
                editId={editId}
                setEditId={setEditId}
                todayISO={todayISO}
                onAdd={(day) => { if (!canEdit) return; setDraftCell({ day, row }); }}
                onSubmitAdd={async (day, values) => {
                  if (!canEdit) return;
                  try {
                    await addItem({
                      name: values.name ?? '',
                      room: values.room ?? '',
                      dx: values.dx ?? '',
                      proc: values.proc as ProcKey,
                      day,
                      row,
                    });
                    setDraftCell(null);
                  } catch (e) { showErr(e); }
                }}
                onCancelAdd={() => setDraftCell(null)}
                onSaveEdit={async (it, values) => {
                  try {
                    await updateItem(it.id, {
                      name: values.name, room: values.room, dx: values.dx, proc: values.proc,
                    });
                    setEditId(null);
                  } catch (e) { showErr(e); }
                }}
                onMoveUp={(it) => { if (!canEdit) return; void moveOneUp(it); }}
                onMoveDown={(it) => { if (!canEdit) return; void moveOneDown(it); }}
                onMoveLeft={async (it) => {
                  if (!canEdit) return;
                  try {
                    const idx = dayKeys.indexOf(it.day);
                    const nx = ((idx - 1) % dayKeys.length + dayKeys.length) % dayKeys.length;
                    const max = await getMaxOrd(dayKeys[nx], it.row);
                    await updateItem(it.id, { day: dayKeys[nx], ord: Math.floor(max) + 10 });
                  } catch (e) { showErr(e); }
                }}
                onMoveRight={async (it) => {
                  if (!canEdit) return;
                  try {
                    const idx = dayKeys.indexOf(it.day);
                    const nx = (idx + 1) % dayKeys.length;
                    const max = await getMaxOrd(dayKeys[nx], it.row);
                    await updateItem(it.id, { day: dayKeys[nx], ord: Math.floor(max) + 10 });
                  } catch (e) { showErr(e); }
                }}
                onMoveRowUp={async (it) => {
                  if (!canEdit) return;
                  try {
                    const rIdx = ROWS.indexOf(it.row);
                    if (rIdx <= 0) return;
                    const destRow = ROWS[rIdx - 1] as RowKey;
                    const max = await getMaxOrd(it.day, destRow);
                    await updateItem(it.id, { row: destRow, ord: Math.floor(max) + 10 });
                  } catch (e) { showErr(e); }
                }}
                onMoveRowDown={async (it) => {
                  if (!canEdit) return;
                  try {
                    const rIdx = ROWS.indexOf(it.row);
                    if (rIdx >= ROWS.length - 1) return;
                    const destRow = ROWS[rIdx + 1] as RowKey;
                    const max = await getMaxOrd(it.day, destRow);
                    await updateItem(it.id, { row: destRow, ord: Math.floor(max) + 10 });
                  } catch (e) { showErr(e); }
                }}
                onDelete={async (it) => {
                  if (!canEdit) return;
                  try { if (confirm('Eliminar paciente?')) await deleteItem(it.id); }
                  catch (e) { showErr(e); }
                }}
                onToggleDone={async (it) => {
                  if (!canEdit) return;
                  try { await updateItem(it.id, { done: !it.done }); }
                  catch (e) { showErr(e); }
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Row / Card ===== */

function escapeCSV(s: string): string {
  const needs = /[",\n]/.test(s);
  const t = s.replace(/"/g, '""');
  return needs ? `"${t}"` : t;
}

function RowBlock({
  row, dayKeys, items, canEdit, search, draftCell, setDraftCell,
  editId, setEditId, todayISO,
  onAdd, onSubmitAdd, onCancelAdd, onSaveEdit,
  onMoveUp, onMoveDown, onMoveLeft, onMoveRight, onMoveRowUp, onMoveRowDown,
  onDelete, onToggleDone,
}: {
  row: RowKey; dayKeys: string[]; items: Item[]; canEdit: boolean; search: string;
  draftCell: { day: string; row: RowKey } | null; setDraftCell: (v: { day: string; row: RowKey } | null) => void;
  editId: string | null; setEditId: (id: string | null) => void; todayISO: string;
  onAdd: (day: string) => void;
  onSubmitAdd: (day: string, vals: { name: string; room: string; dx: string; proc: ProcKey }) => void;
  onCancelAdd: () => void;
  onSaveEdit: (it: Item, vals: { name: string; room: string; dx: string; proc: ProcKey }) => void;
  onMoveUp: (it: Item) => void; onMoveDown: (it: Item) => void;
  onMoveLeft: (it: Item) => void; onMoveRight: (it: Item) => void;
  onMoveRowUp: (it: Item) => void; onMoveRowDown: (it: Item) => void;
  onDelete: (it: Item) => void; onToggleDone: (it: Item) => void;
}) {
  return (
    <>
      <div className="bg-gray-100 border-r px-3 py-3 font-semibold sticky left-0 z-10">{row}</div>
      {dayKeys.map((dk) => {
        const isToday = dk === todayISO;
        const cell = items
          .filter((i) => i.day === dk && i.row === row)
          .sort((a, b) => a.ord - b.ord)
          .filter((i) =>
            !search
              ? true
              : [i.name, i.room, i.dx, i.proc].some((f) => String(f).toLowerCase().includes(search.toLowerCase()))
          );

        const isDraftHere = draftCell?.day === dk && draftCell?.row === row;

        return (
          <div key={dk + row}
               className={`border-t border-r p-2 min-h-[140px] ${isToday ? 'bg-red-50/40' : 'bg-white'}`}>
            <div className="flex flex-col gap-2">
              {cell.map((it, idx) =>
                editId === it.id ? (
                  <InlineEditorCard
                    key={it.id}
                    title="Editar paciente"
                    initial={{ name: it.name || '', room: it.room || '', dx: it.dx || '', proc: it.proc as ProcKey }}
                    onCancel={() => setEditId(null)}
                    onSave={(vals) => onSaveEdit(it, vals)}
                  />
                ) : (
                  <CardItem
                    key={it.id}
                    it={it}
                    idx={idx}
                    canEdit={canEdit}
                    onEdit={() => setEditId(it.id)}
                    onMoveUp={() => onMoveUp(it)}
                    onMoveDown={() => onMoveDown(it)}
                    onMoveLeft={() => onMoveLeft(it)}
                    onMoveRight={() => onMoveRight(it)}
                    onMoveRowUp={() => onMoveRowUp(it)}
                    onMoveRowDown={() => onMoveRowDown(it)}
                    onDelete={() => onDelete(it)}
                    onToggleDone={() => onToggleDone(it)}
                  />
                )
              )}

              {canEdit && isDraftHere && (
                <InlineEditorCard title="Nuevo paciente" onCancel={onCancelAdd} onSave={(vals) => onSubmitAdd(dk, vals)} />
              )}

              {canEdit && !isDraftHere && (
                <button className="px-2 py-1 border rounded text-sm bg-white w-fit" onClick={() => onAdd(dk)}>
                  <Plus className="inline w-4 h-4 mr-1" /> Añadir paciente
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

function CardItem({
  it, idx, canEdit, onEdit,
  onMoveUp, onMoveDown, onMoveLeft, onMoveRight, onMoveRowUp, onMoveRowDown,
  onToggleDone, onDelete,
}: {
  it: Item; idx: number; canEdit: boolean; onEdit: () => void;
  onMoveUp: () => void; onMoveDown: () => void; onMoveLeft: () => void; onMoveRight: () => void;
  onMoveRowUp: () => void; onMoveRowDown: () => void; onToggleDone: () => void; onDelete: () => void;
}) {
  const containerCls =
    `rounded-xl border p-3 flex flex-col gap-2 shadow-sm ${it.done ? 'bg-gray-100 border-gray-300 text-gray-600' : 'bg-white'}`;

  return (
    <div className={containerCls}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-medium">{idx + 1}</div>
          <div className="text-sm font-semibold truncate" title={it.name ?? ''}>{it.name || '(sin nombre)'}</div>
          {it.done && <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] border bg-gray-200">Finalizado</span>}
        </div>

        {canEdit && (
          <div className="flex items-center gap-1">
            <button className="p-1 rounded hover:bg-gray-100" onClick={onToggleDone}
                    title={it.done ? 'Marcar como pendiente' : 'Marcar como finalizado'}>
              {it.done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
            </button>

            <button className="p-1 rounded hover:bg-gray-100" onClick={onMoveLeft} title="Día anterior (wrap)">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button className="p-1 rounded hover:bg-gray-100" onClick={onMoveUp} title="Subir orden (una posición)">
              <ArrowUp className="w-4 h-4" />
            </button>
            <button className="p-1 rounded hover:bg-gray-100" onClick={onMoveDown} title="Bajar orden (una posición)">
              <ArrowDown className="w-4 h-4" />
            </button>
            <button className="p-1 rounded hover:bg-gray-100" onClick={onMoveRowUp} title="Pasar a sala anterior">
              <ChevronsUp className="w-4 h-4" />
            </button>
            <button className="p-1 rounded hover:bg-gray-100" onClick={onMoveRowDown} title="Pasar a sala siguiente">
              <ChevronsDown className="w-4 h-4" />
            </button>
            <button className="p-1 rounded hover:bg-gray-100" onClick={onMoveRight} title="Día siguiente (wrap)">
              <ArrowRight className="w-4 h-4" />
            </button>

            <button className="p-1 rounded hover:bg-gray-100" onClick={onEdit} title="Editar">
              <Pencil className="w-4 h-4" />
            </button>
            <button className="p-1 rounded hover:bg-gray-100" onClick={onDelete} title="Eliminar">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className={`flex flex-wrap gap-2 text-xs ${it.done ? 'text-gray-500' : 'text-gray-600'}`}>
        {it.room && <span className="px-2 py-0.5 rounded border bg-gray-50">Hab: {it.room}</span>}
        {it.dx && <span className="px-2 py-0.5 rounded border bg-gray-50">Dx: {it.dx}</span>}
        <span className={`px-2 py-0.5 rounded border ${procColor(it.proc as ProcKey)}`}>{it.proc}</span>
      </div>
    </div>
  );
}