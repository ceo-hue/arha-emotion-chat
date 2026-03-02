/**
 * ARHA API 키 관리 엔드포인트 (어드민 전용)
 *
 * GET    /api/arha-keys          → 내 키 목록 조회
 * POST   /api/arha-keys          → 새 키 생성
 * DELETE /api/arha-keys?id=xxx   → 키 비활성화
 *
 * 모든 요청에 Authorization: Bearer <Firebase ID Token> 필요
 */

import { getAdminDb, verifyIdToken } from './_firebaseAdmin.js';
import crypto from 'crypto';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function generateApiKey() {
  const rand = crypto.randomBytes(24).toString('hex');
  return `arha_sk_${rand}`;
}

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Firebase ID 토큰 검증
  let uid;
  try {
    uid = await verifyIdToken(req.headers.get('Authorization'));
  } catch (e) {
    return json({ error: 'Unauthorized: ' + e.message }, 401);
  }

  const db = getAdminDb();

  // ── GET: 키 목록 ──────────────────────────────────
  if (req.method === 'GET') {
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

    return json({ keys });
  }

  // ── POST: 키 생성 ─────────────────────────────────
  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
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
    return json({
      id: docRef.id,
      key,          // ← 이 응답 이후로는 전체 키를 다시 볼 수 없음
      name,
      dailyLimit,
    }, 201);
  }

  // ── DELETE: 키 비활성화 ────────────────────────────
  if (req.method === 'DELETE') {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Missing id param' }, 400);

    const docRef = db.collection('apiKeys').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) return json({ error: 'Key not found' }, 404);
    if (doc.data().ownerId !== uid) return json({ error: 'Forbidden' }, 403);

    await docRef.update({ isActive: false });
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
