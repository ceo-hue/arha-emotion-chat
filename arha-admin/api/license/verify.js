/**
 * POST /api/license/verify
 * npm 패키지(arha-engine)에서 라이선스 유효성 확인
 * 인증 불필요 (퍼블릭)
 *
 * Body: { licenseKey: "arha_lic_..." }
 * Response: { valid: true } | { valid: false, reason: string }
 */

import { getAdminDb } from '../_firebaseAdmin.js';

export const config = { maxDuration: 15 };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function setCors(res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { licenseKey } = req.body || {};
  if (!licenseKey || !licenseKey.startsWith('arha_lic_')) {
    return res.status(200).json({ valid: false, reason: 'Invalid license key format' });
  }

  try {
    const db = getAdminDb();
    const snap = await db.collection('licenses')
      .where('key', '==', licenseKey)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(200).json({ valid: false, reason: 'License not found' });
    }

    const doc = snap.docs[0];
    const data = doc.data();

    if (!data.isActive) {
      return res.status(200).json({ valid: false, reason: 'License is inactive' });
    }

    // 만료일 체크 (null = 영구)
    if (data.expiresAt) {
      const expiresMs = data.expiresAt.toMillis ? data.expiresAt.toMillis() : new Date(data.expiresAt).getTime();
      if (Date.now() > expiresMs) {
        return res.status(200).json({ valid: false, reason: 'License has expired' });
      }
    }

    // lastVerified 업데이트 (비동기, 응답 차단 안 함)
    doc.ref.update({ lastVerified: new Date() }).catch(() => {});

    return res.status(200).json({
      valid: true,
      tier: data.tier || 'basic',
      expiresAt: data.expiresAt?.toMillis?.() ?? null,
    });

  } catch (e) {
    return res.status(500).json({ valid: false, reason: 'Verification error: ' + e.message });
  }
}
