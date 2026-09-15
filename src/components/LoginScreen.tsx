import React, { useState } from 'react';
import { LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export const LoginScreen: React.FC = () => {
  const { signIn } = useAuth();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!nickname.trim() || !password) {
      setError('Ingresá tu usuario y tu clave.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(nickname, password);
    } catch (err) {
      setError('Usuario o clave incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-yellow-400">
            <AlertCircle className="h-5 w-5" />
            <span className="font-bold">Falta configurar Supabase</span>
          </div>
          <p className="text-sm text-zinc-400">
            No están definidas las variables <code className="text-zinc-300">VITE_SUPABASE_URL</code> y{' '}
            <code className="text-zinc-300">VITE_SUPABASE_ANON_KEY</code>. Revisá el README para el paso a paso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400 text-zinc-950 font-black text-xl mb-3">
            GD
          </div>
          <h1 className="text-lg font-bold">Gestión Diaria</h1>
          <p className="text-sm text-zinc-500">Ingresá con tu usuario y clave</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <div>
            <label className="text-xs font-bold text-zinc-400 block mb-1">Usuario</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="tu.usuario"
              autoCapitalize="none"
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-400 block mb-1">Clave</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="••••••••"
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full px-4 py-2.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 disabled:opacity-60 text-zinc-950 text-sm font-bold flex items-center justify-center gap-2"
          >
            <LogIn className="h-4 w-4" />
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-4">
          ¿No tenés usuario? Pedile a un administrador que te cree uno.
        </p>
      </div>
    </div>
  );
};
