import React, { useState } from 'react';
import { Building2, ChevronDown, Plus, Check } from 'lucide-react';
import { SedeSummary } from '../types';

interface SedeSwitcherProps {
  sedes: SedeSummary[];
  currentSedeId: string | null;
  onSelectSede: (id: string) => void;
  canCreateSede: boolean;
  onCreateSede: (name: string) => Promise<void>;
}

export const SedeSwitcher: React.FC<SedeSwitcherProps> = ({
  sedes,
  currentSedeId,
  onSelectSede,
  canCreateSede,
  onCreateSede,
}) => {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const current = sedes.find((s) => s.id === currentSedeId);

  // Si el usuario solo tiene una sede y no puede crear más, no vale la pena mostrar el selector
  if (sedes.length <= 1 && !canCreateSede) {
    return null;
  }

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreateSede(newName.trim());
    setNewName('');
    setCreating(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
      >
        <Building2 className="h-3.5 w-3.5 text-yellow-400" />
        <span className="max-w-[140px] truncate">{current?.name || 'Elegir sede'}</span>
        <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 w-64 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden">
            <div className="max-h-64 overflow-y-auto py-1">
              {sedes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onSelectSede(s.id);
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-zinc-800"
                >
                  <span className="truncate">{s.name}</span>
                  {s.id === currentSedeId && <Check className="h-4 w-4 text-yellow-400 shrink-0" />}
                </button>
              ))}
              {sedes.length === 0 && (
                <p className="px-3 py-2 text-xs text-zinc-500">No tenés sedes asignadas todavía.</p>
              )}
            </div>

            {canCreateSede && (
              <div className="border-t border-zinc-800 p-2">
                {creating ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                      placeholder="Nombre de la sede"
                      className="flex-1 px-2 py-1.5 rounded-md bg-zinc-950 border border-zinc-700 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                    <button
                      type="button"
                      onClick={handleCreate}
                      className="px-2 py-1.5 rounded-md bg-yellow-400 text-zinc-950 text-xs font-bold"
                    >
                      Crear
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold text-yellow-400 hover:bg-zinc-800"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nueva sede
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
