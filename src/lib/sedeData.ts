import { supabase } from './supabaseClient';
import { BranchConfig, Seller, SedeSummary, UserProfile } from '../types';
import { INITIAL_BRANCH_CONFIG, INITIAL_SELLERS } from '../data/initialData';

export interface SedeState {
  id: string;
  name: string;
  config: BranchConfig;
  sellers: Seller[];
}

export async function fetchAccessibleSedes(profile: UserProfile): Promise<SedeSummary[]> {
  if (!supabase) return [];
  let query = supabase.from('sedes').select('id,name,updated_at').order('name', { ascending: true });
  if (profile.role !== 'administrador') {
    query = query.in('id', profile.sedeIds.length > 0 ? profile.sedeIds : ['00000000-0000-0000-0000-000000000000']);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((r) => ({ id: r.id, name: r.name, updatedAt: r.updated_at }));
}

export async function fetchSede(sedeId: string): Promise<SedeState | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('sedes')
    .select('id,name,config,sellers')
    .eq('id', sedeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, name: data.name, config: data.config as BranchConfig, sellers: data.sellers as Seller[] };
}

export async function saveSede(sedeId: string, config: BranchConfig, sellers: Seller[]) {
  if (!supabase) return;
  const { error } = await supabase.from('sedes').update({ config, sellers }).eq('id', sedeId);
  if (error) throw error;
}

export function subscribeToSede(sedeId: string, onChange: (state: { config: BranchConfig; sellers: Seller[] }) => void) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`sede-${sedeId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sedes', filter: `id=eq.${sedeId}` },
      (payload) => {
        const row = payload.new as { config?: BranchConfig; sellers?: Seller[] };
        if (row.config && row.sellers) onChange({ config: row.config, sellers: row.sellers });
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// Crear una sede nueva (solo Administrador, según las políticas de RLS)
export async function createSede(name: string): Promise<SedeSummary> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase
    .from('sedes')
    .insert({
      name,
      config: { ...INITIAL_BRANCH_CONFIG, branchName: name },
      sellers: INITIAL_SELLERS,
    })
    .select('id,name,updated_at')
    .single();
  if (error) throw error;
  return { id: data.id, name: data.name, updatedAt: data.updated_at };
}
