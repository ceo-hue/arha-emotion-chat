/**
 * ARHA API 키 관리 엔드포인트 (어드민 전용)
 *
 * GET    /api/arha-keys          → 내 키 목록 조회
 * POST   /api/arha-keys          → 새 키 생성
 * DELETE /api/arha-keys?id=xxx   → 키 비활성화
 *
 * 모든 요청에 Authorization: Bearer <Firebase ID Token> 필요
 */

import crypto from 'crypto';
import { getAdminDb, verifyIdToken } from './_firebaseAdmin.js';

export const config = { maxDuration: 30 };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function setCors(res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
}

function generateApiKey() {
  const rand = crypto.randomBytes(24).toString('hex');
  return `arha_sk_${rand}`;
}

export default async function handler(req, res) {
  setCors(res);

  // CORS preflight
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Firebase ID 토큰 검증
  let uid;
  try {
    uid = await verifyIdToken(req.headers['authorization']);
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized: ' + e.message });
  }

  const db = getAdminDb();

  // ── GET: 키 목록 ──────────────────────────────────
  if (req.method === 'GET') {
    try {
      const snap = await db.collection('apiKeys')
        .where('ownerId', '==', uid)
        .orderBy('createdAt', 'desc')
        .get();

      const keys = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name,
          keyPreview: d.key.slice(0, 14) + '••••••••••••••••',
          isActive: d.isActive,
          callCount: d.callCount ?? 0,
          dailyLimit: d.dailyLimit ?? 100,
          createdAt: d.createdAt?.toMillis?.() ?? Date.now(),
          lastUsed: d.lastUsed?.toMillis?.() ?? null,
        };
      });

      return res.status(200).json({ keys });
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Failed to fetch keys' });
    }
  }

  // ── POST: 키 생성 ─────────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const name = (body.name ?? '').trim() || 'My API Key';
      const dailyLimit = Number(body.dailyLimit) || 100;

      const key = generateApiKey();

      const docRef = await db.collection('apiKeys').add({
        key,
        name,
        ownerId: uid,
        isActive: true,
        callCount: 0,
        dailyCallCount: 0,
        dailyLimit,
        createdAt: new Date(),
        lastUsed: null,
      });

      // 키는 생성 직후 1회만 전체 공개
      return res.status(201).json({
        id: docRef.id,
        key,          // ← 이 응답 이후로는 전체 키를 다시 볼 수 없음
        name,
        dailyLimit,
      });
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Failed to create key' });
    }
  }

  // ── DELETE: 키 비활성화 ────────────────────────────
  if (req.method === 'DELETE') {
    try {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'Missing id param' });

      const docRef = db.collection('apiKeys').doc(id);
      const doc = await docRef.get();

      if (!doc.exists) return res.status(404).json({ error: 'Key not found' });
      if (doc.data().ownerId !== uid) return res.status(403).json({ error: 'Forbidden' });

      await docRef.update({ isActive: false });
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Failed to deactivate key' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
