1# Gestión Diaria — Multi-sede con usuarios y roles.

App de pizarra de ventas diarias en pesos argentinos ($ ARS), con múltiples
sedes sincronizadas en tiempo real vía Supabase y usuarios con 4 niveles de
permiso.

## Roles

| Rol            | Puede...                                                                 |
|----------------|---------------------------------------------------------------------------|
| Vendedor       | Ver y cargar ventas del día, solo en su sede asignada                    |
| Coordinador    | Además, modificar objetivos/configuración de su sede                     |
| Regional       | Lo mismo que Coordinador, en varias sedes asignadas                      |
| Administrador  | Acceso total: todas las sedes, crear sedes, crear/editar/borrar usuarios |

> **Nota de seguridad:** la distinción entre "solo cargar ventas" y "modificar
> objetivos" se aplica en la interfaz (se ocultan los controles según el rol).
> A nivel de base de datos, cualquier rol con acceso a una sede puede escribir
> esa fila completa (RLS controla *qué sede*, no qué campos dentro de ella).
> Para una separación estricta a nivel de datos haría falta normalizar la
> tabla en `config` y `ventas` por separado — es un cambio de arquitectura
> más grande que se puede encarar más adelante si hace falta.

---

## Paso a paso para poner todo en funcionamiento

### 1. Crear el proyecto en Supabase
1. Andá a https://supabase.com → **New project** (plan gratuito alcanza).
2. Guardá la contraseña de la base que te pida (no es la misma que las claves de usuarios de la app).

### 2. Correr el schema SQL
1. En el proyecto de Supabase, andá a **SQL Editor**.
2. Pegá **todo** el contenido de `supabase/schema.sql` (de este proyecto) y ejecutalo.
   Esto crea las tablas `sedes` y `profiles`, las políticas de seguridad por rol, y activa Realtime.

### 3. Obtener las claves de API
En Supabase → **Project Settings → API** vas a encontrar:
- **Project URL**
- **anon public key**
- **service_role key** (⚠️ es secreta — nunca la pongas en variables `VITE_*` ni la subas a git)

### 4. Crear la primera sede y el primer usuario Administrador
Como todavía no existe ningún Administrador, el primer usuario hay que crearlo a mano desde Supabase:

1. Supabase → **Authentication → Users → Add user**. Como email poné
   `admin@gestiondiaria.local` (o el nickname que quieras + `@gestiondiaria.local`),
   con una contraseña, y marcá **Auto Confirm User**.
2. Copiá el **UUID** del usuario recién creado.
3. Supabase → **SQL Editor**, corré (reemplazando el UUID):
   ```sql
   insert into public.profiles (id, nickname, role, sede_ids)
   values ('PEGÁ-ACÁ-EL-UUID', 'admin', 'administrador', '{}');
   ```
4. (Opcional) Creá la primera sede desde SQL también, o hacelo luego desde la app con el botón "Nueva sede" del selector de sedes, una vez logueado como administrador:
   ```sql
   insert into public.sedes (name, config, sellers)
   values ('Mi Primera Sede', '{"branchName":"Mi Primera Sede","periodName":"Enero 2026","globalTarget":15000000,"autoSumGlobalTarget":true,"totalWorkingDays":26,"currentWorkingDay":1}'::jsonb, '[]'::jsonb);
   ```

A partir de acá, entrás a la app con usuario `admin` / la clave que pusiste, y desde el botón **Usuarios** (arriba a la derecha) creás el resto de los usuarios de forma normal, sin tocar SQL nunca más.

### 5. Variables de entorno en Vercel
En tu proyecto de Vercel → **Settings → Environment Variables**, creá:

| Nombre                        | Valor                          | Dónde se usa |
|--------------------------------|---------------------------------|--------------|
| `VITE_SUPABASE_URL`            | Project URL                    | Navegador    |
| `VITE_SUPABASE_ANON_KEY`       | anon public key                | Navegador    |
| `SUPABASE_URL`                 | Project URL (sin prefijo VITE_)| Servidor (`/api`) |
| `SUPABASE_SERVICE_ROLE_KEY`    | service_role key               | Servidor (`/api`) — nunca se expone al navegador |

Volvé a **Deployments** y hacé **Redeploy**.

### 6. Probar en local (opcional)
```bash
cp .env.example .env
# completá los 4 valores en .env
npm install
npm run dev
```
Las funciones de `/api` (crear/editar/borrar usuarios) necesitan `vercel dev`
en vez de `npm run dev` para funcionar en local (Vite solo no las ejecuta):
```bash
npm i -g vercel
vercel dev
```

---

## Estructura del proyecto

```
src/
  components/     UI (Pizarra, Vendedores, Admin, Login, Usuarios, etc.)
  contexts/       AuthContext (sesión y perfil del usuario logueado)
  lib/            Clientes de Supabase, helpers de auth y de datos de sede
  utils/          Cálculos de negocio, calendario, formatters
  data/           Datos iniciales de demo (para sedes nuevas)
api/              Funciones serverless de Vercel (usan la Service Role Key)
supabase/         schema.sql — pegar en el SQL Editor de Supabase
```

## Sincronización entre dispositivos
Cada sede es una fila en la tabla `sedes`. Al cargar una venta o cambiar un
objetivo, el cambio se guarda en Supabase y se propaga a todos los
dispositivos que tengan esa misma sede abierta vía Supabase Realtime — no
hace falta recargar la página.
