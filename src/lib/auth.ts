import { supabase } from './supabaseClient';
import { UserProfile, UserRole } from '../types';

// Supabase Auth pide un email; como el sistema pedido usa "nickname y clave",
// convertimos el nickname a un email interno ficticio y lo ocultamos del usuario.
export const EMAIL_DOMAIN = 'gestiondiaria.local';

export const nicknameToEmail = (nickname: string): string =>
  `${nickname.trim().toLowerCase()}@${EMAIL_DOMAIN}`;

export async function signInWithNickname(nickname: string, password: string) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: nicknameToEmail(nickname),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function fetchOwnProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id,nickname,role,sede_ids')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, nickname: data.nickname, role: data.role as UserRole, sedeIds: data.sede_ids || [] };
}

// Cambiar la propia clave (cualquier usuario logueado puede hacerlo)
export async function updateOwnPassword(newPassword: string) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// Helper para llamar a las funciones serverless en /api con el token del usuario actual
export async function callAdminApi<T>(path: string, body: unknown): Promise<T> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('No hay sesión activa.');
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Error en el servidor.');
  return json as T;
}
