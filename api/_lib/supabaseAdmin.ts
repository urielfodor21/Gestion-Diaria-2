import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cliente con la Service Role Key: SOLO se usa en el servidor (funciones /api).
// Nunca debe importarse desde código de src/ (el bundle del navegador).
export function getAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor.');
  }
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Verifica el token Bearer del usuario que llama y confirma que es Administrador.
// Devuelve el userId del llamador si es válido, o lanza un error.
export async function requireAdmin(authHeader: string | undefined): Promise<string> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('No autenticado.');
  }
  const token = authHeader.slice('Bearer '.length);
  const admin = getAdminClient();

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) {
    throw new Error('Sesión inválida.');
  }

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileErr || !profile || profile.role !== 'administrador') {
    throw new Error('No tenés permisos de Administrador para esta acción.');
  }

  return userData.user.id;
}

export const EMAIL_DOMAIN = 'gestiondiaria.local';
export const nicknameToEmail = (nickname: string): string => `${nickname.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
