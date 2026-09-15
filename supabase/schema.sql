-- ============================================================================
-- Gestión Diaria — Schema de Supabase (multi-sede + usuarios con roles)
-- Pegar TODO este archivo en Supabase → SQL Editor → Run
-- ============================================================================

-- 1) Tabla de SEDES (cada fila es una "pizarra" completa: config + vendedores)
create table if not exists public.sedes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  config jsonb not null,
  sellers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Tabla de PERFILES (uno por usuario de auth.users, con nickname + rol + sedes asignadas)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique,
  role text not null check (role in ('vendedor','coordinador','regional','administrador')),
  sede_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

-- 3) Funciones auxiliares (SECURITY DEFINER) para usar en las políticas de RLS
--    sin caer en recursión al consultar la propia tabla profiles.
create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_sede_ids()
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select sede_ids from public.profiles where id = auth.uid();
$$;

-- 4) Trigger para mantener "updated_at" al día en sedes
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sedes_set_updated_at on public.sedes;
create trigger sedes_set_updated_at
  before update on public.sedes
  for each row execute function public.set_updated_at();

-- 5) Row Level Security
alter table public.sedes enable row level security;
alter table public.profiles enable row level security;

-- --- Políticas de "profiles" ---
drop policy if exists "profiles: self select" on public.profiles;
create policy "profiles: self select" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles: admin select all" on public.profiles;
create policy "profiles: admin select all" on public.profiles
  for select using (public.current_user_role() = 'administrador');

drop policy if exists "profiles: admin update all" on public.profiles;
create policy "profiles: admin update all" on public.profiles
  for update using (public.current_user_role() = 'administrador')
  with check (public.current_user_role() = 'administrador');

drop policy if exists "profiles: admin delete" on public.profiles;
create policy "profiles: admin delete" on public.profiles
  for delete using (public.current_user_role() = 'administrador');

-- Nota: la CREACIÓN de usuarios (auth.users + profiles) se hace desde las
-- funciones serverless en /api (con la Service Role Key), que se saltan RLS
-- a propósito porque crear un usuario de Auth no se puede hacer con la
-- clave anónima desde el navegador.

-- --- Políticas de "sedes" ---
drop policy if exists "sedes: admin all" on public.sedes;
create policy "sedes: admin all" on public.sedes
  for all using (public.current_user_role() = 'administrador')
  with check (public.current_user_role() = 'administrador');

drop policy if exists "sedes: asignadas select" on public.sedes;
create policy "sedes: asignadas select" on public.sedes
  for select using (
    public.current_user_role() in ('vendedor','coordinador','regional')
    and id = any(public.current_user_sede_ids())
  );

drop policy if exists "sedes: asignadas update" on public.sedes;
create policy "sedes: asignadas update" on public.sedes
  for update using (
    public.current_user_role() in ('vendedor','coordinador','regional')
    and id = any(public.current_user_sede_ids())
  )
  with check (
    public.current_user_role() in ('vendedor','coordinador','regional')
    and id = any(public.current_user_sede_ids())
  );

-- 6) Habilitar Realtime (sincronización instantánea entre dispositivos)
alter publication supabase_realtime add table public.sedes;

-- ============================================================================
-- IMPORTANTE — Aclaración de seguridad:
-- La distinción entre "Vendedor" (solo carga ventas) y "Coordinador/Regional"
-- (puede modificar objetivos) se aplica en la interfaz de la aplicación, no
-- a nivel de fila de la base de datos: toda la pizarra de una sede (objetivos
-- Y ventas) vive en una sola columna jsonb, así que cualquier rol con acceso
-- de escritura a esa sede puede técnicamente escribir toda la fila. Para una
-- separación "a prueba de balas" haría falta normalizar la tabla en filas
-- separadas de config/ventas, que es un cambio de arquitectura más grande.
-- Para el uso normal de la app (dentro de la interfaz), la restricción por
-- rol funciona correctamente.
-- ============================================================================
