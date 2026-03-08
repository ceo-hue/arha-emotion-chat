/**
 * 사용자 관리 엔드포인트 (어드민 전용)
 *
 * GET   /api/users              → 사용자 목록 (tier, email, 오늘 사용량)
 * PATCH /api/users/:uid/tier    → 특정 유저 tier 변경
 *
 * 모든 요청에 Authorization: Bearer <Firebase ID Token> 필요
 * 요청자가 admin 등급이어야만 허용
 */

import { getAdminDb, verifyIdToken } from './_firebaseAdmin.js';

export const config = { maxDuration: 30 };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function setCors(res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
}

const VALID_TIERS = ['free', 'paid', 'admin'];

/** 요청자가 admin 등급인지 확인 */
async function verifyAdmin(uid, db) {
  const snap = await db.doc(`users/${uid}/profile/info`).get();
  if (!snap.exists) throw new Error('Profile not found');
  if (snap.data().tier !== 'admin') throw new Error('Admin access required');
}

/** KST 오늘 날짜 (YYYY-MM-DD) */
function getKSTDate() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  let uid;
  try {
    uid = await verifyIdToken(req.headers['authorization']);
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized: ' + e.message });
  }

  const db = getAdminDb();

  try {
    await verifyAdmin(uid, db);
  } catch (e) {
    return res.status(403).json({ error: e.message });
  }

  // ── GET: 사용자 목록 ──────────────────────────────
  if (req.method === 'GET') {
    try {
      const today = getKSTDate();
      const profilesSnap = await db.collectionGroup('profile').get();

      // collectionGroup 이 없으면 users/{uid}/profile/info 경로를 직접 순회
      // 실제로는 profile 서브컬렉션 내 'info' 문서들을 가져옴
      const infoSnap = await db.collectionGroup('profile').where('tier', 'in', VALID_TIERS.concat(['free'])).get();

      const users = await Promise.all(
        infoSnap.docs
          .filter(d => d.id === 'info')
          .map(async d => {
            const uid = d.ref.parent.parent.id;
            const data = d.data();

            // 오늘 사용량
            let dailyCount = 0;
            try {
              const usageSnap = await db.doc(`users/${uid}/usage/daily`).get();
              if (usageSnap.exists) {
                const u = usageSnap.data();
                if (u.date === today) dailyCount = u.count ?? 0;
              }
            } catch {}

            return {
              uid,
              email: data.email ?? '',
              displayName: data.displayName ?? '',
              photoURL: data.photoURL ?? null,
              tier: data.tier ?? 'free',
              dailyCount,
              createdAt: data.createdAt?.toMillis?.() ?? null,
            };
          })
      );

      // email 기준 정렬
      users.sort((a, b) => (a.email < b.email ? -1 : 1));

      return res.status(200).json({ users });
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Failed to fetch users' });
    }
  }

  // ── PATCH /api/users?uid=xxx&tier=paid ────────────
  if (req.method === 'PATCH') {
    try {
      const targetUid = req.query?.uid || req.body?.uid;
      const newTier = req.query?.tier || req.body?.tier;

      if (!targetUid) return res.status(400).json({ error: 'Missing uid' });
      if (!VALID_TIERS.includes(newTier)) {
        return res.status(400).json({ error: `Invalid tier. Must be one of: ${VALID_TIERS.join(', ')}` });
      }

      await db.doc(`users/${targetUid}/profile/info`).set(
        { tier: newTier, updatedAt: new Date() },
        { merge: true }
      );

      return res.status(200).json({ success: true, uid: targetUid, tier: newTier });
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Failed to update tier' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
