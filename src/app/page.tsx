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
  getMinOrd,
} from '@/lib/data';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Calendar,
  ChevronsUp,
  ChevronsDown,
  Save,
  X,
  Pencil,
  Download,
} from 'lucide-react';

/** Util: clases para badges de procedimiento */
function procColor(proc: ProcKey): string {
  const lower = proc.toLowerCase();
  // Verde: Coronaria, C.Derecho
  if (lower === 'coronaria' || lower === 'c.derecho') return 'bg-green-100 text-green-800 border-green-300';
  // Naranja: ICP
  if (lower === 'icp') return 'bg-orange-100 text-orange-800 border-orange-300';
  // Rojo: Oclusión crónica
  if (lower === 'oclusión crónica' || lower === 'oclusion crónica' || lower === 'oclusión cronica' || lower === 'oclusion cronica') {
    return 'bg-red-100 text-red-800 border-red-300';
  }
  // Morado: TAVI, Mitraclip, Triclip, Orejuela, FOP, CIA
  if (['tavi','mitraclip','triclip','orejuela','fop','cia'].includes(lower)) {
    return 'bg-purple-100 text-purple-800 border-purple-300';
  }
  // Negro (neutro oscuro): Otros (usamos gris oscuro para buena legibilidad)
  return 'bg-gray-200 text-gray-900 border-gray-300';
}

/** Errores legibles (sin 'any') */
function showErr(e: unknown) {
  try {
    const obj = e as Record<string, unknown>;
    const msg =
      (obj?.message as string) ||
      (obj?.['error'] as any)?.message ||
      (obj?.details as string) ||
      (obj?.hint as string) ||
      (obj?.code as string) ||
      JSON.stringify(obj, Object.getOwnPropertyNames(obj ?? {}) as any) ||
      String(e);
    // eslint-disable-next-line no-console
    console.error('ERROR:', e);
    alert(msg || 'Error desconocido');
  } catch {
    alert('Error (sin detalles). Revisa la consola.');
  }
}

/** Tarjeta inline para crear/editar un paciente */
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
  // Importante: inicializamos una sola vez; NO sincronizamos con useEffect
  const [name, setName] = useState(initial.name);
  const [room, setRoom] = useState(initial.room);
  const [dx, setDx] = useState(initial.dx); // texto libre
  const [proc, setProc] = useState<ProcKey>(initial.proc);

  return (
    <div className="bg-white rounded-xl border p-3 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <div className="flex items-center gap-1">
          <button className="p-1 rounded hover:bg-gray-100" title="Cancelar" onClick={onCancel}>
            <X className="w-4 h-4" />
          </button>
          <button
            className="p-1 rounded hover:bg-gray-100"
            title="Guardar"
            onClick={() => onSave({ name, room, dx, proc })}
          >
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <label className="text-xs">
          Nombre/ID (evitar nombre completo)
          <input
            className="mt-1 w-full border rounded px-2 py-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Iniciales o ID"
          />
        </label>
        <label className="text-xs">
          Habitación
          <input
            className="mt-1 w-full border rounded px-2 py-1"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="312B"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <label className="text-xs">
          Diagnóstico (texto libre)
          <input
            className="mt-1 w-full border rounded px-2 py-1"
            value={dx}
            onChange={(e) => setDx(e.target.value)}
            placeholder="p. ej., SCA, CHD..."
          />
        </label>

        <label className="text-xs">
          Procedimiento
          <select
            className="mt-1 w-full border rounded px-2 py-1 bg-white"
            value={proc}
            onChange={(e) => setProc(e.target.value as ProcKey)}
          >
            {PROCS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

export default function Page() {
  const [sessionReady, setSessionReady] = useState(false);
  const [role, setRole] = useState<'editor' | 'viewer' | 'unknown'>('unknown');

  useEffect(() => {
    supabase.auth.getSession().then(() => setSessionReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange(() => setSessionReady(true));
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    (async () => setRole(await getMyRole()))();
  }, [sessionReady]);

  return (
    <div className="p-4 max-w-[1200px] mx-auto">
      <Header role={role} />
      {role === 'unknown' ? <AuthBlock /> : <Board role={role} />}
    </div>
  );
}

function Header({ role }: { role: 'editor' | 'viewer' | 'unknown' }) {
  const [showChange, setShowChange] = useState(false);

  return (
    <div className="mb-4 flex justify-between items-center">
      <div className="text-xl font-semibold">Agenda Hemodinámica — Pizarra semanal</div>
      <div className="flex gap-2 items-center">
        <span className="text-sm px-2 py-1 border rounded-full bg-white">
          {role === 'editor' ? 'Editor' : role === 'viewer' ? 'Solo lectura' : 'No autenticado'}
        </span>

        {/* Botón visible si está autenticado */}
        {role !== 'unknown' && (
          <button
            className="px-3 py-1 rounded border bg-white text-sm"
            onClick={() => setShowChange(true)}
            title="Cambiar contraseña"
          >
            Cambiar contraseña
          </button>
        )}

        <AuthButtons />
      </div>

      {showChange && <ChangePasswordDialog onClose={() => setShowChange(false)} />}
    </div>
  );
}


function AuthButtons() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const doLoginPassword = async () => {
  try {
    if (!email || !password) { alert('Introduce email y contraseña'); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // ✅ fuerza re-render completo (evita estados “atascados”)
    window.location.replace('/'); // o window.location.reload();
  } catch (e) {
    showErr(e);
  } finally {
    setBusy(false);
  }
};

  const sendReset = async () => {
    try {
      if (!email) { alert('Introduce tu email'); return; }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      alert('Te hemos enviado un correo para restablecer tu contraseña.');
    } catch (e: any) {
      alert(e?.message || 'No se pudo enviar el correo');
    }
  };

  const doLogout = async () => {
    try {
      setBusy(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.replace('/');
    } catch (e) {
      showErr(e);
    } finally {
      setBusy(false);
    }
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
      <button
        className="px-3 py-1 rounded border bg-white text-sm disabled:opacity-60"
        onClick={doLoginPassword}
        disabled={busy}
        title="Entrar con email y contraseña"
      >
        Entrar
      </button>

      {/* ⬇️ AQUÍ SÍ: el botón de reset DENTRO del return */}
      <button
        className="px-3 py-1 rounded border bg-white text-sm"
        onClick={sendReset}
        title="Enviar correo para restablecer contraseña"
      >
        ¿Olvidaste la contraseña?
      </button>

      <button
        className="px-3 py-1 rounded border bg-white text-sm disabled:opacity-60"
        onClick={doLogout}
        disabled={busy}
        title="Cerrar sesión"
      >
        Salir
      </button>
    </div>
  );
}


function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState<string>('');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const e = data.user?.email ?? '';
      setEmail(e);
    });
  }, []);

  const onSave = async () => {
    try {
      if (!email) { alert('No se pudo leer tu email de sesión. Vuelve a iniciar sesión.'); return; }
      if (!currentPwd || !newPwd) { alert('Completa las contraseñas.'); return; }
      if (newPwd.length < 8) { alert('La nueva contraseña debe tener al menos 8 caracteres.'); return; }
      if (newPwd !== confirmPwd) { alert('La confirmación no coincide.'); return; }

      setBusy(true);

      const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password: currentPwd });
      if (loginErr) throw loginErr;

      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;

      alert('Contraseña cambiada correctamente. Vuelve a entrar con la nueva.');
      await supabase.auth.signOut();
      onClose();
    } catch (e) {
      showErr(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl border shadow-lg w-full max-w-md p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Cambiar contraseña</div>
          <button className="p-1 rounded hover:bg-gray-100" onClick={onClose} title="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-xs">
            Email
            <input
              className="mt-1 w-full border rounded px-2 py-1 bg-gray-50"
              value={email}
              disabled
            />
          </label>

          <label className="block text-xs">
            Contraseña actual
            <input
              type="password"
              className="mt-1 w-full border rounded px-2 py-1"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          <label className="block text-xs">
            Nueva contraseña
            <input
              type="password"
              className="mt-1 w-full border rounded px-2 py-1"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              autoComplete="new-password"
            />
          </label>

          <label className="block text-xs">
            Confirmar nueva contraseña
            <input
              type="password"
              className="mt-1 w-full border rounded px-2 py-1"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              autoComplete="new-password"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="px-3 py-1 rounded border bg-white text-sm" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            className="px-3 py-1 rounded border bg-white text-sm disabled:opacity-60"
            onClick={onSave}
            disabled={busy}
          >
            Guardar
          </button>
        </div>
      </div>
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




function Board({ role }: { role: 'editor' | 'viewer' }) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');

  // alta inline: {day,row} de la celda que está editando (nuevo)
  const [draftCell, setDraftCell] = useState<{ day: string; row: RowKey } | null>(null);
  // edición inline de un item existente
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

  // ancho fijo por día y primera columna:
  const DAY_COL_WIDTH = 320; // px
  const FIRST_COL_WIDTH = 160; // px
  const minWidth = FIRST_COL_WIDTH + 5 * DAY_COL_WIDTH; // 160 + 5*320 = 1760

  /** Exportar CSV de la semana visible */
  function exportCSV() {
    // Cabecera
    const rows: string[] = [];
    const header = ['Día', 'Sala/Turno', 'Orden', 'Nombre/ID', 'Habitación', 'Diagnóstico', 'Procedimiento'];
    rows.push(header.map(escapeCSV).join(','));

    // Por cada día/sala, en orden
    for (const day of dayKeys) {
      for (const row of ROWS) {
        const cell = items
          .filter((i) => i.day === day && i.row === row)
          .sort((a, b) => a.ord - b.ord);
        cell.forEach((it, idx) => {
          const line = [
            day,
            row,
            String(idx + 1),
            it.name ?? '',
            it.room ?? '',
            it.dx ?? '',
            it.proc ?? '',
          ];
          rows.push(line.map(escapeCSV).join(','));
        });
      }
    }

    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pizarra_${dayKeys[0]}_a_${dayKeys[4]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** Mover una posición hacia arriba dentro de la misma celda (swap con anterior) */
    /** Mover una posición hacia arriba (swap con anterior) */
  /** Mover una posición hacia arriba (swap con anterior) usando parking INTEGER */
const moveOneUp = async (it: Item) => {
  const cell = items
    .filter(i => i.day === it.day && i.row === it.row)
    .sort((a, b) => a.ord - b.ord);

  const idx = cell.findIndex(i => i.id === it.id);
  if (idx <= 0) return; // ya es el primero

  const prev = cell[idx - 1];
  const oldItOrd = it.ord;
  const oldPrevOrd = prev.ord;

  // valor de parking: más pequeño que cualquiera en la celda
  const minOrd = cell[0]?.ord ?? 0;
  const PARK = minOrd - 100000; // entero

  try {
    // 1) aparco 'it' fuera del rango para no colisionar
    await updateItem(it.id, { ord: PARK });
    // 2) muevo 'prev' al ord original de 'it'
    await updateItem(prev.id, { ord: oldItOrd });
    // 3) coloco 'it' en el ord original de 'prev'
    await updateItem(it.id, { ord: oldPrevOrd });
  } catch (e) {
    showErr(e);
  }
};

/** Mover una posición hacia abajo (swap con siguiente) usando parking INTEGER */
const moveOneDown = async (it: Item) => {
  const cell = items
    .filter(i => i.day === it.day && i.row === it.row)
    .sort((a, b) => a.ord - b.ord);

  const idx = cell.findIndex(i => i.id === it.id);
  if (idx === -1 || idx >= cell.length - 1) return; // ya es el último

  const next = cell[idx + 1];
  const oldItOrd = it.ord;
  const oldNextOrd = next.ord;

  // parking: más grande que cualquiera en la celda
  const maxOrd = cell[cell.length - 1]?.ord ?? 0;
  const PARK = maxOrd + 100000; // entero

  try {
    // 1) aparco 'it'
    await updateItem(it.id, { ord: PARK });
    // 2) muevo 'next' al ord original de 'it'
    await updateItem(next.id, { ord: oldItOrd });
    // 3) coloco 'it' en el ord original de 'next'
    await updateItem(it.id, { ord: oldNextOrd });
  } catch (e) {
    showErr(e);
  }
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

        <input className="ml-auto border rounded px-2 py-1" placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />

        <button className="px-2 py-1 border rounded bg-white flex items-center gap-1" onClick={exportCSV} title="Exportar semana en CSV">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* Contenedor con scroll horizontal + scroll táctil */}
      <div className="border rounded-lg overflow-x-auto touch-pan-x">
        {/* Ancho mínimo para que quepa todo y se pueda hacer scroll */}
        <div className={`min-w-[${minWidth}px]`}>
          <div className="grid"
               style={{ gridTemplateColumns: `${FIRST_COL_WIDTH}px repeat(5, ${DAY_COL_WIDTH}px)` }}>
            {/* Cabecera */}
            <div className="bg-gray-100 border-b px-3 py-2 font-medium sticky top-0 left-0 z-20">
              Sala/Turno
            </div>
            {days.map((d, i) => {
              const isToday = toISODate(d) === todayISO;
              return (
                <div key={i}
                     className={`border-b px-3 py-2 font-medium sticky top-0 z-10 ${isToday ? 'bg-red-50 text-red-700' : 'bg-gray-100'}`}>
                  {d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                </div>
              );
            })}

            {/* Filas */}
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
                      name: values.name,
                      room: values.room,
                      dx: values.dx,
                      proc: values.proc,
                    });
                    setEditId(null);
                  } catch (e) { showErr(e); }
                }}
                onMoveUp={async (it) => {
                    if (!canEdit) return;
                    await moveOneUp(it);
                }}
                onMoveDown={async (it) => {
                    if (!canEdit) return;
                    await moveOneDown(it);
                }}

                onMoveLeft={async (it) => {
                  if (!canEdit) return;
                  try {
                    const idx = dayKeys.indexOf(it.day);
                    const nx = ((idx - 1) % dayKeys.length + dayKeys.length) % dayKeys.length; // wrap
                    const max = await getMaxOrd(dayKeys[nx], it.row);
                    await updateItem(it.id, { day: dayKeys[nx], ord: max + 1 });
                  } catch (e) { showErr(e); }
                }}
                onMoveRight={async (it) => {
                  if (!canEdit) return;
                  try {
                    const idx = dayKeys.indexOf(it.day);
                    const nx = (idx + 1) % dayKeys.length; // wrap
                    const max = await getMaxOrd(dayKeys[nx], it.row);
                    await updateItem(it.id, { day: dayKeys[nx], ord: max + 1 });
                  } catch (e) { showErr(e); }
                }}
                onMoveRowUp={async (it) => {
                  if (!canEdit) return;
                  try {
                    const rIdx = ROWS.indexOf(it.row);
                    if (rIdx <= 0) return;
                    const destRow = ROWS[rIdx - 1] as RowKey;
                    const max = await getMaxOrd(it.day, destRow);
                    await updateItem(it.id, { row: destRow, ord: max + 1 });
                  } catch (e) { showErr(e); }
                }}
                onMoveRowDown={async (it) => {
                  if (!canEdit) return;
                  try {
                    const rIdx = ROWS.indexOf(it.row);
                    if (rIdx >= ROWS.length - 1) return;
                    const destRow = ROWS[rIdx + 1] as RowKey;
                    const max = await getMaxOrd(it.day, destRow);
                    await updateItem(it.id, { row: destRow, ord: max + 1 });
                  } catch (e) { showErr(e); }
                }}
                onDelete={async (it) => {
                  if (!canEdit) return;
                  try { if (confirm('Eliminar paciente?')) await deleteItem(it.id); }
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

/** CSV helper */
function escapeCSV(s: string): string {
  const needs = /[",\n]/.test(s);
  const t = s.replace(/"/g, '""');
  return needs ? `"${t}"` : t;
}

function RowBlock({
  row,
  dayKeys,
  items,
  canEdit,
  search,
  draftCell,
  setDraftCell,
  editId,
  setEditId,
  todayISO,
  onAdd,
  onSubmitAdd,
  onCancelAdd,
  onSaveEdit,
  onMoveUp,
  onMoveDown,
  onMoveLeft,
  onMoveRight,
  onMoveRowUp,
  onMoveRowDown,
  onDelete,
}: {
  row: RowKey;
  dayKeys: string[];
  items: Item[];
  canEdit: boolean;
  search: string;
  draftCell: { day: string; row: RowKey } | null;
  setDraftCell: (v: { day: string; row: RowKey } | null) => void;
  editId: string | null;
  setEditId: (id: string | null) => void;
  todayISO: string;
  onAdd: (day: string) => void;
  onSubmitAdd: (day: string, vals: { name: string; room: string; dx: string; proc: ProcKey }) => void;
  onCancelAdd: () => void;
  onSaveEdit: (it: Item, vals: { name: string; room: string; dx: string; proc: ProcKey }) => void;
  onMoveUp: (it: Item) => void;
  onMoveDown: (it: Item) => void;
  onMoveLeft: (it: Item) => void;
  onMoveRight: (it: Item) => void;
  onMoveRowUp: (it: Item) => void;
  onMoveRowDown: (it: Item) => void;
  onDelete: (it: Item) => void;
}) {
  return (
    <>
      {/* Primera columna pegajosa (etiqueta de fila) */}
      <div className="bg-gray-100 border-r px-3 py-3 font-semibold sticky left-0 z-10">
        {row}
      </div>
      {dayKeys.map((dk) => {
        const isToday = dk === todayISO;
        const cell = items
          .filter((i) => i.day === dk && i.row === row)
          .sort((a, b) => a.ord - b.ord)
          .filter((i) =>
            !search
              ? true
              : [i.name, i.room, i.dx, i.proc].some((f) =>
                  String(f).toLowerCase().includes(search.toLowerCase())
                )
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
                    initial={{ name: it.name, room: it.room, dx: it.dx, proc: it.proc }}
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
                  />
                )
              )}

              {canEdit && isDraftHere && (
                <InlineEditorCard
                  title="Nuevo paciente"
                  onCancel={onCancelAdd}
                  onSave={(vals) => onSubmitAdd(dk, vals)}
                />
              )}

              {canEdit && !isDraftHere && (
                <button className="px-2 py-1 border rounded text-sm bg-white w-fit"
                        onClick={() => onAdd(dk)}>
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
  it,
  idx,
  canEdit,
  onEdit,
  onMoveUp,
  onMoveDown,
  onMoveLeft,
  onMoveRight,
  onMoveRowUp,
  onMoveRowDown,
  onDelete,
}: {
  it: Item;
  idx: number;
  canEdit: boolean;
  onEdit: () => void;               // NUEVO botón editar
  onMoveUp: () => void;             // subir orden en celda
  onMoveDown: () => void;           // bajar orden en celda
  onMoveLeft: () => void;           // cambiar día -
  onMoveRight: () => void;          // cambiar día +
  onMoveRowUp: () => void;          // pasar a sala anterior
  onMoveRowDown: () => void;        // pasar a sala siguiente
  onDelete: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border p-3 flex flex-col gap-2 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-medium">
            {idx + 1}
          </div>
          <div className="text-sm font-semibold truncate" title={it.name}>
            {it.name || '(sin nombre)'}
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            {/* Editar */}
            <button className="p-1 rounded hover:bg-gray-100" onClick={onEdit} title="Editar">
              <Pencil className="w-4 h-4" />
            </button>

            {/* Día anterior / siguiente (wrap) */}
            <button className="p-1 rounded hover:bg-gray-100" onClick={onMoveLeft} title="Día anterior (wrap)">
              <ArrowLeft className="w-4 h-4" />
            </button>

            {/* Orden dentro de la celda */}
            <button className="p-1 rounded hover:bg-gray-100" onClick={onMoveUp} title="Subir orden">
              <ArrowUp className="w-4 h-4" />
            </button>
            <button className="p-1 rounded hover:bg-gray-100" onClick={onMoveDown} title="Bajar orden">
              <ArrowDown className="w-4 h-4" />
            </button>

            {/* Pasar a otra sala (misma fecha) */}
            <button className="p-1 rounded hover:bg-gray-100" onClick={onMoveRowUp} title="Pasar a sala anterior">
              <ChevronsUp className="w-4 h-4" />
            </button>
            <button className="p-1 rounded hover:bg-gray-100" onClick={onMoveRowDown} title="Pasar a sala siguiente">
              <ChevronsDown className="w-4 h-4" />
            </button>

            <button className="p-1 rounded hover:bg-gray-100" onClick={onMoveRight} title="Día siguiente (wrap)">
              <ArrowRight className="w-4 h-4" />
            </button>

            <button className="p-1 rounded hover:bg-gray-100" onClick={onDelete} title="Eliminar">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-gray-600">
        {it.room && <span className="px-2 py-0.5 rounded border bg-gray-50">Hab: {it.room}</span>}
        {it.dx &&   <span className="px-2 py-0.5 rounded border bg-gray-50">Dx: {it.dx}</span>}
        <span className={`px-2 py-0.5 rounded border ${procColor(it.proc)}`}>{it.proc}</span>
      </div>
    </div>
  );
}
