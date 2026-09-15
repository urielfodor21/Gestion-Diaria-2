import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminClient, requireAdmin, nicknameToEmail } from './_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  try {
    await requireAdmin(req.headers.authorization);

    const { nickname, password, role, sedeIds } = req.body || {};
    if (!nickname || !password || !role) {
      res.status(400).json({ error: 'Faltan datos: nickname, password y role son obligatorios.' });
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
      res.status(400).json({ error: createErr?.message || 'No se pudo crear el usuario.' });
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
      res.status(400).json({ error: profileErr.message });
      return;
    }

    res.status(200).json({ ok: true, userId: created.user.id });
  } catch (err: any) {
    res.status(403).json({ error: err.message || 'Error inesperado.' });
  }
}
