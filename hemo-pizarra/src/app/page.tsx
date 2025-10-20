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
} from '@/lib/data';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Calendar,
} from 'lucide-react';

export default function Page() {
  const [sessionReady, setSessionReady] = useState(false);
  const [role, setRole] = useState<'editor' | 'viewer' | 'unknown'>('unknown');

  // Comprueba/escucha sesión
  useEffect(() => {
    supabase.auth.getSession().then(() => setSessionReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange(() =>
      setSessionReady(true)
    );
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // Carga el rol (editor/viewer) cuando hay sesión
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
            console.error(e);
            alert(e?.message ?? JSON.stringify(e));
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
            console.error(e);
            alert(e?.message ?? JSON.stringify(e));
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
            console.error(e);
            alert(e?.message ?? JSON.stringify(e));
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

      <div className="border rounded-lg overflow-hidden">
        <div className="grid" style={{ gridTemplateColumns: '160px repeat(5, 1fr)' }}>
          {/* Cabecera */}
          <div className="bg-gray-100 border-b px-3 py-2 font-medium">Epígrafes</div>
          {days.map((d, i) => (
            <div key={i} className="bg-gray-100 border-b px-3 py-2 font-medium">
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
              onAdd={async (day) => {
                if (!canEdit) return;
                try {
                  const name = prompt('Nombre/ID (evitar nombre completo)') ?? '';
                  const room = prompt('Habitación') ?? '';
                  const dx = prompt('Diagnóstico') ?? '';
                  const raw =
                    (prompt(
                      `Procedimiento (elige exactamente): ${PROCS.join(', ')}`
                    ) ?? 'Coronaria').trim();

                  // Validación: si el valor no está en la lista exacta, usamos 'Coronaria'
                  const allowed = new Set(PROCS as readonly string[]);
                  const proc = (allowed.has(raw as any) ? raw : 'Coronaria') as ProcKey;

                  await addItem({ name, room, dx, proc, day, row });
                } catch (e: any) {
                  console.error(e);
                  alert(e?.message ?? JSON.stringify(e));
                }
              }}
              onMoveUp={async (it) => {
                if (!canEdit) return;
                try {
                  await updateItem(it.id, { ord: Math.max(1, it.ord - 1) });
                } catch (e: any) {
                  console.error(e);
                  alert(e?.message ?? JSON.stringify(e));
                }
              }}
              onMoveDown={async (it) => {
                if (!canEdit) return;
                try {
                  await updateItem(it.id, { ord: it.ord + 1 });
                } catch (e: any) {
                  console.error(e);
                  alert(e?.message ?? JSON.stringify(e));
                }
              }}
              onMoveLeft={async (it) => {
                if (!canEdit) return;
                try {
                  const idx = dayKeys.indexOf(it.day);
                  const nx =
                    ((idx - 1) % dayKeys.length + dayKeys.length) % dayKeys.length; // wrap
                  await updateItem(it.id, { day: dayKeys[nx], ord: 9999 });
                } catch (e: any) {
                  console.error(e);
                  alert(e?.message ?? JSON.stringify(e));
                }
              }}
              onMoveRight={async (it) => {
                if (!canEdit) return;
                try {
                  const idx = dayKeys.indexOf(it.day);
                  const nx = (idx + 1) % dayKeys.length; // wrap
                  await updateItem(it.id, { day: dayKeys[nx], ord: 9999 });
                } catch (e: any) {
                  console.error(e);
                  alert(e?.message ?? JSON.stringify(e));
                }
              }}
              onDelete={async (it) => {
                if (!canEdit) return;
                try {
                  if (confirm('Eliminar paciente?')) await deleteItem(it.id);
                } catch (e: any) {
                  console.error(e);
                  alert(e?.message ?? JSON.stringify(e));
                }
              }}
            />
          ))}
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
  onAdd,
  onMoveUp,
  onMoveDown,
  onMoveLeft,
  onMoveRight,
  onDelete,
}: {
  row: RowKey;
  dayKeys: string[];
  items: Item[];
  canEdit: boolean;
  search: string;
  onAdd: (day: string) => void;
  onMoveUp: (it: Item) => void;
  onMoveDown: (it: Item) => void;
  onMoveLeft: (it: Item) => void;
  onMoveRight: (it: Item) => void;
  onDelete: (it: Item) => void;
}) {
  return (
    <>
      <div className="bg-gray-100 border-r px-3 py-3 font-semibold">{row}</div>
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
        return (
          <div
            key={dk + row}
            className="border-t border-r p-2 min-h-[120px] bg-white"
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
                  onDelete={() => onDelete(it)}
                />
              ))}
              {canEdit && (
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
  onDelete,
}: {
  it: Item;
  idx: number;
  canEdit: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
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
            <button
              className="p-1 rounded hover:bg-gray-100"
              onClick={onMoveLeft}
              title="Día anterior (wrap)"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
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
