/**
 * POST /api/license/issue
 * 어드민 전용 — 새 라이선스 키 발급
 * Authorization: Bearer <Firebase ID Token> 필요
 *
 * Body: { name, email, tier?, dailyLimit?, expiresAt? }
 * Response: { id, key, name, email, tier, dailyLimit, expiresAt }
 */

import crypto from 'crypto';
import { getAdminDb, verifyIdToken } from '../_firebaseAdmin.js';

export const config = { maxDuration: 15 };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const TIERS = {
  basic:      { dailyLimit: 1000 },
  pro:        { dailyLimit: 10000 },
  enterprise: { dailyLimit: 100000 },
};

function setCors(res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
}

function generateLicenseKey() {
  return 'arha_lic_' + crypto.randomBytes(24).toString('hex');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 어드민 인증
  let uid;
  try {
    uid = await verifyIdToken(req.headers['authorization']);
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized: ' + e.message });
  }

  const { name, email, tier = 'basic', dailyLimit, expiresAt } = req.body || {};

  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  if (!email?.trim()) return res.status(400).json({ error: 'email is required' });
  if (!TIERS[tier]) return res.status(400).json({ error: 'tier must be basic | pro | enterprise' });

  try {
    const db = getAdminDb();
    const key = generateLicenseKey();
    const resolvedLimit = dailyLimit || TIERS[tier].dailyLimit;
    const resolvedExpiry = expiresAt ? new Date(expiresAt) : null;

    const docRef = await db.collection('licenses').add({
      key,
      name: name.trim(),
      email: email.trim(),
      tier,
      isActive: true,
      dailyLimit: resolvedLimit,
      callCount: 0,
      dailyCallCount: 0,
      dailyResetDate: new Date().toISOString().slice(0, 10),
      expiresAt: resolvedExpiry,
      issuedBy: uid,
      createdAt: new Date(),
      lastVerified: null,
    });

    return res.status(201).json({
      id: docRef.id,
      key,           // ← 발급 직후 1회만 전체 노출
      name: name.trim(),
      email: email.trim(),
      tier,
      dailyLimit: resolvedLimit,
      expiresAt: resolvedExpiry?.toISOString() ?? null,
    });

  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to issue license' });
  }
}
