import React, { useEffect, useState } from 'react';
import { Users, Plus, KeyRound, Trash2, X, Save } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { callAdminApi } from '../lib/auth';
import { SedeSummary, UserRole } from '../types';

interface UserRow {
  id: string;
  nickname: string;
  role: UserRole;
  sede_ids: string[];
}

const ROLE_LABELS: Record<UserRole, string> = {
  vendedor: 'Vendedor',
  coordinador: 'Coordinador',
  regional: 'Regional',
  administrador: 'Administrador',
};

interface UserManagementPanelProps {
  sedes: SedeSummary[];
  onClose: () => void;
}

export const UserManagementPanel: React.FC<UserManagementPanelProps> = ({ sedes, onClose }) => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadUsers = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('profiles')
      .select('id,nickname,role,sede_ids')
      .order('nickname', { ascending: true });
    if (err) setError(err.message);
    else setUsers((data as UserRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sedeName = (id: string) => sedes.find((s) => s.id === id)?.name || id;

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-yellow-400" />
            <h2 className="text-sm font-bold text-zinc-200">Usuarios</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800">
            <X className="h-4 w-4 text-zinc-400" />
          </button>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="mb-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-zinc-950 text-xs font-bold"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo usuario
        </button>

        {showCreate && (
          <CreateUserForm
            sedes={sedes}
            onCreated={() => {
              setShowCreate(false);
              loadUsers();
            }}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {loading ? (
          <p className="text-xs text-zinc-500">Cargando usuarios...</p>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="border border-zinc-800 rounded-xl p-3">
                {editingId === u.id ? (
                  <EditUserForm
                    user={u}
                    sedes={sedes}
                    onSaved={() => {
                      setEditingId(null);
                      loadUsers();
                    }}
                    onCancel={() => setEditingId(null)}
                    onDeleted={() => {
                      setEditingId(null);
                      loadUsers();
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">{u.nickname}</div>
                      <div className="text-xs text-zinc-500">
                        {ROLE_LABELS[u.role]}
                        {u.role !== 'administrador' && u.sede_ids.length > 0 && (
                          <> · {u.sede_ids.map(sedeName).join(', ')}</>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingId(u.id)}
                      className="text-xs font-semibold text-yellow-400 hover:underline"
                    >
                      Editar
                    </button>
                  </div>
                )}
              </div>
            ))}
            {users.length === 0 && <p className="text-xs text-zinc-500">No hay usuarios creados todavía.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------

const SedeCheckboxes: React.FC<{
  sedes: SedeSummary[];
  selected: string[];
  onChange: (ids: string[]) => void;
}> = ({ sedes, selected, onChange }) => (
  <div className="flex flex-wrap gap-1.5 mt-1">
    {sedes.map((s) => {
      const active = selected.includes(s.id);
      return (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(active ? selected.filter((id) => id !== s.id) : [...selected, s.id])}
          className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${
            active
              ? 'bg-yellow-400 text-zinc-950 border-yellow-400'
              : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:bg-zinc-800'
          }`}
        >
          {s.name}
        </button>
      );
    })}
  </div>
);

const CreateUserForm: React.FC<{
  sedes: SedeSummary[];
  onCreated: () => void;
  onCancel: () => void;
}> = ({ sedes, onCreated, onCancel }) => {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('vendedor');
  const [sedeIds, setSedeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!nickname.trim() || password.length < 6) {
      setError('Usuario requerido y clave de al menos 6 caracteres.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await callAdminApi('/api/create-user', { nickname: nickname.trim(), password, role, sedeIds });
      onCreated();
    } catch (err: any) {
      setError(err.message || 'No se pudo crear el usuario.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4 p-3.5 rounded-xl bg-zinc-900 border border-zinc-700/80 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-bold text-zinc-400 block mb-1">Usuario (nickname)</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-zinc-400 block mb-1">Clave inicial</label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-[11px] font-bold text-zinc-400 block mb-1">Rol</label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                role === r
                  ? 'bg-yellow-400 text-zinc-950 border-yellow-400'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-700 hover:bg-zinc-800'
              }`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {role !== 'administrador' && (
        <div>
          <label className="text-[11px] font-bold text-zinc-400 block mb-1">
            Sedes con acceso {role !== 'regional' ? '(normalmente una sola)' : ''}
          </label>
          <SedeCheckboxes sedes={sedes} selected={sedeIds} onChange={setSedeIds} />
        </div>
      )}

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 disabled:opacity-60 text-zinc-950 text-xs font-bold"
        >
          {saving ? 'Creando...' : 'Crear usuario'}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:bg-zinc-800">
          Cancelar
        </button>
      </div>
    </div>
  );
};

const EditUserForm: React.FC<{
  user: UserRow;
  sedes: SedeSummary[];
  onSaved: () => void;
  onCancel: () => void;
  onDeleted: () => void;
}> = ({ user, sedes, onSaved, onCancel, onDeleted }) => {
  const [role, setRole] = useState<UserRole>(user.role);
  const [sedeIds, setSedeIds] = useState<string[]>(user.sede_ids);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await callAdminApi('/api/update-user', {
        userId: user.id,
        role,
        sedeIds,
        password: newPassword || undefined,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar al usuario "${user.nickname}"? Esta acción no se puede deshacer.`)) return;
    setSaving(true);
    try {
      await callAdminApi('/api/delete-user', { userId: user.id });
      onDeleted();
    } catch (err: any) {
      setError(err.message || 'No se pudo eliminar.');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-zinc-100">{user.nickname}</div>

      <div>
        <label className="text-[11px] font-bold text-zinc-400 block mb-1">Rol</label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                role === r
                  ? 'bg-yellow-400 text-zinc-950 border-yellow-400'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-700 hover:bg-zinc-800'
              }`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {role !== 'administrador' && (
        <div>
          <label className="text-[11px] font-bold text-zinc-400 block mb-1">Sedes con acceso</label>
          <SedeCheckboxes sedes={sedes} selected={sedeIds} onChange={setSedeIds} />
        </div>
      )}

      <div>
        <label className="text-[11px] font-bold text-zinc-400 block mb-1 flex items-center gap-1">
          <KeyRound className="h-3 w-3" /> Nueva clave (opcional)
        </label>
        <input
          type="text"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Dejar vacío para no cambiarla"
          className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-sm"
        />
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={handleDelete}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:bg-zinc-800">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 disabled:opacity-60 text-zinc-950 text-xs font-bold"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
};
