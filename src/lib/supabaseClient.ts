import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

// Si faltan las variables de entorno, dejamos `supabase` en null y el resto
// de la app puede mostrar un aviso claro en vez de romperse silenciosamente.
export const supabase = isSupabaseConfigured ? createClient(url as string, anonKey as string) : null;
