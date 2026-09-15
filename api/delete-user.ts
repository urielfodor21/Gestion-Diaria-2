import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminClient, requireAdmin } from './_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  let callerId: string;
  try {
    callerId = await requireAdmin(req.headers.authorization);
  } catch (err: any) {
    res.status(403).json({ error: err.message || 'No autorizado.' });
    return;
  }

  try {
    const { userId } = req.body || {};
    if (!userId) {
      res.status(400).json({ error: 'Falta el usuario a eliminar.' });
      return;
    }
    if (userId === callerId) {
      res.status(400).json({ error: 'No podés eliminar tu propio usuario.' });
      return;
    }

    const admin = getAdminClient();
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      res.status(400).json({ error: error.message || 'No se pudo eliminar el usuario.' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error inesperado del servidor.' });
  }
}
