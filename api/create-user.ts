import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminClient, requireAdmin, nicknameToEmail } from './_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  // 1) Verificar que quien llama es Administrador (errores acá son de permisos: 403)
  try {
    await requireAdmin(req.headers.authorization);
  } catch (err: any) {
    res.status(403).json({ error: err.message || 'No autorizado.' });
    return;
  }

  // 2) Crear el usuario (errores acá son del servidor o de datos: 400/500)
  try {
    const { nickname, password, role, sedeIds } = req.body || {};
    if (!nickname || !String(nickname).trim() || !password || !role) {
      res.status(400).json({ error: 'Faltan datos: usuario, clave y rol son obligatorios.' });
      return;
    }
    if (String(password).length < 6) {
      res.status(400).json({ error: 'La clave debe tener al menos 6 caracteres.' });
      return;
    }

    const admin = getAdminClient();
    const email = nicknameToEmail(nickname);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr || !created.user) {
      const msg = createErr?.message || '';
      const friendly = /already registered|already exists/i.test(msg)
        ? `Ya existe un usuario con el nombre "${nickname}". Elegí otro.`
        : msg || 'No se pudo crear el usuario.';
      res.status(400).json({ error: friendly });
      return;
    }

    const { error: profileErr } = await admin.from('profiles').insert({
      id: created.user.id,
      nickname: String(nickname).trim(),
      role,
      sede_ids: role === 'administrador' ? [] : sedeIds || [],
    });

    if (profileErr) {
      // Si falla la creación del perfil, deshacemos el usuario de Auth para no dejar huérfanos
      await admin.auth.admin.deleteUser(created.user.id);
      const friendly = /duplicate key|unique constraint/i.test(profileErr.message)
        ? `Ya existe un usuario con el nombre "${nickname}". Elegí otro.`
        : profileErr.message;
      res.status(400).json({ error: friendly });
      return;
    }

    res.status(200).json({ ok: true, userId: created.user.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error inesperado del servidor.' });
  }
}
