'use client';

import { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';

/** Errores legibles */
function showErr(e: any) {
  try {
    const msg =
      e?.message ||
      e?.error?.message ||
      e?.details ||
      e?.hint ||
      e?.code ||
      JSON.stringify(e, Object.getOwnPropertyNames(e) as any) ||
      JSON.stringify(e);
    console.error('ERROR:', e);
    alert(msg || 'Error desconocido');
  } catch {
    alert('Error (sin detalles). Revisa la consola.');
  }
}

/** Tarjeta inline para crear un paciente dentro de la celda */
function InlineEditorCard({
  defaultProc = 'Coronaria',
  onSave,
  onCancel,
}: {
  defaultProc?: ProcKey;
  onSave: (vals: { name: string; room: string; dx: string; proc: ProcKey }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [dx, setDx] = useState(''); // texto libre
  const [proc, setProc] = useState<ProcKey>(defaultProc as ProcKey);

  return (
    <div className="bg-white rounded-xl border p-3 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Nuevo paciente</div>
        <div className="flex items-center gap-1">
          <button
            className="p-1 rounded hover:bg-gray-100"
            title="Cancelar"
            onClick={onCancel}
          >
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
            placeholder="p. ej., SCA, CHD, etc."
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
    const { data: sub } = supabase.auth.onAuthStateChange(() =>
      setSessionReady(true)
    );
    return () => {
      sub.subscription.unsubscribe();
    };
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
  return (
    <div className="mb-4 flex justify-between items-center">
      <div className="text-xl font-semibold">
        Agenda Hemodinámica — Pizarra semanal
      </div>
      <div className="flex gap-2 items-center">
        <span className="text-sm px-2 py-1 border rounded-full bg-white">
          {role === 'editor'
            ? 'Editor'
            : role === 'viewer'
            ? 'Solo lectura'
            : 'No autenticado'}
        </span>
        <AuthButtons />
      </div>
    </div>
  );
}

function AuthButtons() {
  const [email, setEmail] = useState('');

  return (
    <div className="flex gap-2 items-center">
      {/* Login por email (enlace mágico) */}
      <input
        className="border rounded px-2 py-1 text-sm"
        placeholder="tu-email@hospital.es"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        className="px-3 py-1 rounded border bg-white text-sm"
        onClick={async () => {
          try {
            if (!email) {
              alert('Introduce un email');
              return;
            }
            const { error } = await supabase.auth.signInWithOtp({
              email,
              options: { emailRedirectTo: window.location.origin },
            });
            if (error) throw error;
            alert('Te hemos enviado un enlace de acceso. Revisa tu email.');
          } catch (e: any) {
            showErr(e);
          }
        }}
      >
        Entrar por email
      </button>

      {/* Botón SSO Microsoft (actívalo en Supabase → Auth → Providers → Azure) */}
      <button
        className="px-3 py-1 rounded border bg-white text-sm"
        onClick={async () => {
          try {
            await supabase.auth.signInWithOAuth({ provider: 'azure' });
          } catch (e: any) {
            showErr(e);
          }
        }}
      >
        Entrar con Microsoft
      </button>

      <button
        className="px-3 py-1 rounded border bg-white text-sm"
        onClick={async () => {
          try {
            await supabase.auth.signOut();
          } catch (e: any) {
            showErr(e);
          }
        }}
      >
        Salir
      </button>
    </div>
  );
}

function AuthBlock() {
  return (
    <div className="border rounded-lg bg-white p-6">
      <div className="mb-2 font-medium">Accede para ver la pizarra</div>
      <div className="text-sm text-gray-600">
        Usa “Entrar por email” o “Entrar con Microsoft”.
      </div>
    </div>
  );
}

function Board({ role }: { role: 'editor' | 'viewer' }) {
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeekMonday(new Date())
  );
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');

  // draft de alta inline: {day,row} de la celda que está editando
  const [draftCell, setDraftCell] = useState<{ day: string; row: RowKey } | null>(
    null
  );

  const days = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const dayKeys = useMemo(() => days.map(toISODate), [days]);

  const reload = async () => setItems(await listWeek(toISODate(weekStart)));
  useEffect(() => {
    reload();
  }, [weekStart]);

  useEffect(() => {
    const unsub = subscribeItems(reload);
    return () => unsub();
  }, [weekStart]);

  const canEdit = role === 'editor';

  // ancho fijo por día y primera columna:
  const DAY_COL_WIDTH = 320; // px
  const FIRST_COL_WIDTH = 160; // px
  const minWidth = FIRST_COL_WIDTH + 5 * DAY_COL_WIDTH; // 160 + 5*320 = 1760

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          className="px-2 py-1 border rounded bg-white"
          onClick={() => setWeekStart(addDays(weekStart, -7))}
        >
          <ArrowLeft className="inline w-4 h-4" /> Semana anterior
        </button>
        <button
          className="px-2 py-1 border rounded bg-white"
          onClick={() => setWeekStart(startOfWeekMonday(new Date()))}
        >
          <Calendar className="inline w-4 h-4" /> Esta semana
        </button>
        <button
          className="px-2 py-1 border rounded bg-white"
          onClick={() => setWeekStart(addDays(weekStart, 7))}
        >
          Siguiente semana <ArrowRight className="inline w-4 h-4" />
        </button>
        <input
          className="ml-auto border rounded px-2 py-1"
          placeholder="Buscar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Contenedor con scroll horizontal + scroll táctil suave */}
      <div className="border rounded-lg overflow-x-auto touch-pan-x">
        {/* Ancho mínimo para que quepa todo y se pueda hacer scroll */}
        <div className={`min-w-[${minWidth}px]`}>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `${FIRST_COL_WIDTH}px repeat(5, ${DAY_COL_WIDTH}px)`,
            }}
          >
            {/* Cabecera */}
            <div className="bg-gray-100 border-b px-3 py-2 font-medium sticky top-0 left-0 z-20">
              Sala/Turno
            </div>
            {days.map((d, i) => (
              <div
                key={i}
                className="bg-gray-100 border-b px-3 py-2 font-medium sticky top-0 z-10"
              >
                {d.toLocaleDateString('es-ES', {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                })}
              </div>
            ))}

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
                onAdd={async (day) => {
                  if (!canEdit) return;
                  setDraftCell({ day, row });
                }}
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
                    }); // ord = max+1 (sin triggers)
                    setDraftCell(null);
                  } catch (e: any) {
                    showErr(e);
                  }
                }}
                onCancelAdd={() => setDraftCell(null)}
                onMoveUp={async (it) => {
                  if (!canEdit) return;
                  try {
                    const min = await getMinOrd(it.day, it.row);
                    await updateItem(it.id, { ord: min - 1 }); // por delante
                  } catch (e: any) {
                    showErr(e);
                  }
                }}
                onMoveDown={async (it) => {
                  if (!canEdit) return;
                  try {
                    const max = await getMaxOrd(it.day, it.row);
                    await updateItem(it.id, { ord: max + 1 }); // al final
                  } catch (e: any) {
                    showErr(e);
                  }
                }}
                onMoveLeft={async (it) => {
                  if (!canEdit) return;
                  try {
                    const idx = dayKeys.indexOf(it.day);
                    const nx =
                      ((idx - 1) % dayKeys.length + dayKeys.length) %
                      dayKeys.length; // wrap
                    const max = await getMaxOrd(dayKeys[nx], it.row);
                    await updateItem(it.id, { day: dayKeys[nx], ord: max + 1 });
                  } catch (e: any) {
                    showErr(e);
                  }
                }}
                onMoveRight={async (it) => {
                  if (!canEdit) return;
                  try {
                    const idx = dayKeys.indexOf(it.day);
                    const nx = (idx + 1) % dayKeys.length; // wrap
                    const max = await getMaxOrd(dayKeys[nx], it.row);
                    await updateItem(it.id, { day: dayKeys[nx], ord: max + 1 });
                  } catch (e: any) {
                    showErr(e);
                  }
                }}
                onMoveRowUp={async (it) => {
                  if (!canEdit) return;
                  try {
                    const rIdx = ROWS.indexOf(it.row);
                    if (rIdx <= 0) return; // sin wrap entre salas
                    const destRow = ROWS[rIdx - 1] as RowKey;
                    const max = await getMaxOrd(it.day, destRow);
                    await updateItem(it.id, { row: destRow, ord: max + 1 });
                  } catch (e: any) {
                    showErr(e);
                  }
                }}
                onMoveRowDown={async (it) => {
                  if (!canEdit) return;
                  try {
                    const rIdx = ROWS.indexOf(it.row);
                    if (rIdx >= ROWS.length - 1) return; // sin wrap
                    const destRow = ROWS[rIdx + 1] as RowKey;
                    const max = await getMaxOrd(it.day, destRow);
                    await updateItem(it.id, { row: destRow, ord: max + 1 });
                  } catch (e: any) {
                    showErr(e);
                  }
                }}
                onDelete={async (it) => {
                  if (!canEdit) return;
                  try {
                    if (confirm('Eliminar paciente?')) await deleteItem(it.id);
                  } catch (e: any) {
                    showErr(e);
                  }
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RowBlock({
  row,
  dayKeys,
  items,
  canEdit,
  search,
  draftCell,
  setDraftCell,
  onAdd,
  onSubmitAdd,
  onCancelAdd,
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
  onAdd: (day: string) => void;
  onSubmitAdd: (day: string, vals: { name: string; room: string; dx: string; proc: ProcKey }) => void;
  onCancelAdd: () => void;
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
          <div
            key={dk + row}
            className="border-t border-r p-2 min-h-[140px] bg-white"
          >
            <div className="flex flex-col gap-2">
              {cell.map((it, idx) => (
                <CardItem
                  key={it.id}
                  it={it}
                  idx={idx}
                  canEdit={canEdit}
                  onMoveUp={() => onMoveUp(it)}
                  onMoveDown={() => onMoveDown(it)}
                  onMoveLeft={() => onMoveLeft(it)}
                  onMoveRight={() => onMoveRight(it)}
                  onMoveRowUp={() => onMoveRowUp(it)}
                  onMoveRowDown={() => onMoveRowDown(it)}
                  onDelete={() => onDelete(it)}
                />
              ))}

              {canEdit && isDraftHere && (
                <InlineEditorCard
                  onCancel={onCancelAdd}
                  onSave={(vals) => onSubmitAdd(dk, vals)}
                />
              )}

              {canEdit && !isDraftHere && (
                <button
                  className="px-2 py-1 border rounded text-sm bg-white w-fit"
                  onClick={() => onAdd(dk)}
                >
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
  onMoveUp: () => void; // subir orden en celda
  onMoveDown: () => void; // bajar orden en celda
  onMoveLeft: () => void; // cambiar día -
  onMoveRight: () => void; // cambiar día +
  onMoveRowUp: () => void; // pasar a sala anterior
  onMoveRowDown: () => void; // pasar a sala siguiente
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
            {/* Día anterior / siguiente (wrap) */}
            <button
              className="p-1 rounded hover:bg-gray-100"
              onClick={onMoveLeft}
              title="Día anterior (wrap)"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            {/* Orden dentro de la celda */}
            <button
              className="p-1 rounded hover:bg-gray-100"
              onClick={onMoveUp}
              title="Subir orden"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              className="p-1 rounded hover:bg-gray-100"
              onClick={onMoveDown}
              title="Bajar orden"
            >
              <ArrowDown className="w-4 h-4" />
            </button>

            {/* Pasar a otra sala (misma fecha) */}
            <button
              className="p-1 rounded hover:bg-gray-100"
              onClick={onMoveRowUp}
              title="Pasar a sala anterior"
            >
              <ChevronsUp className="w-4 h-4" />
            </button>
            <button
              className="p-1 rounded hover:bg-gray-100"
              onClick={onMoveRowDown}
              title="Pasar a sala siguiente"
            >
              <ChevronsDown className="w-4 h-4" />
            </button>

            <button
              className="p-1 rounded hover:bg-gray-100"
              onClick={onMoveRight}
              title="Día siguiente (wrap)"
            >
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              className="p-1 rounded hover:bg-gray-100"
              onClick={onDelete}
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-gray-600">
        {it.room && (
          <span className="px-2 py-0.5 rounded border bg-gray-50">
            Hab: {it.room}
          </span>
        )}
        {it.dx && (
          <span className="px-2 py-0.5 rounded border bg-gray-50">
            Dx: {it.dx}
          </span>
        )}
        <span className="px-2 py-0.5 rounded border bg-gray-50">{it.proc}</span>
      </div>
    </div>
  );
}
