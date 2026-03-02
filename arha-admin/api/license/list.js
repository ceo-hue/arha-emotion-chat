/**
 * GET  /api/license/list         → 전체 라이선스 목록
 * DELETE /api/license/list?id=xx → 라이선스 비활성화
 * Authorization: Bearer <Firebase ID Token> 필요
 */

import { getAdminDb, verifyIdToken } from '../_firebaseAdmin.js';

export const config = { maxDuration: 15 };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function setCors(res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // 어드민 인증
  try {
    await verifyIdToken(req.headers['authorization']);
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized: ' + e.message });
  }

  const db = getAdminDb();

  // ── GET: 전체 목록 ─────────────────────────────────
  if (req.method === 'GET') {
    try {
      const snap = await db.collection('licenses')
        .orderBy('createdAt', 'desc')
        .get();

      const licenses = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          keyPreview: d.key.slice(0, 18) + '••••••••••••••••',
          name: d.name,
          email: d.email,
          tier: d.tier,
          isActive: d.isActive,
          callCount: d.callCount ?? 0,
          dailyLimit: d.dailyLimit ?? 1000,
          expiresAt: d.expiresAt?.toMillis?.() ?? null,
          createdAt: d.createdAt?.toMillis?.() ?? Date.now(),
          lastVerified: d.lastVerified?.toMillis?.() ?? null,
        };
      });

      return res.status(200).json({ licenses });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── DELETE: 비활성화 ──────────────────────────────
  if (req.method === 'DELETE') {
    try {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'Missing id param' });

      const docRef = db.collection('licenses').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ error: 'License not found' });

      await docRef.update({ isActive: false });
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
