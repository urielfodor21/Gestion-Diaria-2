import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminClient, requireAdmin } from './_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  try {
    await requireAdmin(req.headers.authorization);

    const { userId, role, sedeIds, password } = req.body || {};
    if (!userId) {
      res.status(400).json({ error: 'Falta userId.' });
      return;
    }

    const admin = getAdminClient();

    if (password) {
      if (String(password).length < 6) {
        res.status(400).json({ error: 'La clave debe tener al menos 6 caracteres.' });
        return;
      }
      const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password });
      if (pwErr) {
        res.status(400).json({ error: pwErr.message });
        return;
      }
    }

    const updates: Record<string, unknown> = {};
    if (role !== undefined) updates.role = role;
    if (sedeIds !== undefined) updates.sede_ids = role === 'administrador' ? [] : sedeIds;

    if (Object.keys(updates).length > 0) {
      const { error: profileErr } = await admin.from('profiles').update(updates).eq('id', userId);
      if (profileErr) {
        res.status(400).json({ error: profileErr.message });
        return;
      }
    }

    res.status(200).json({ ok: true });
  } catch (err: any) {
    res.status(403).json({ error: err.message || 'Error inesperado.' });
  }
}
