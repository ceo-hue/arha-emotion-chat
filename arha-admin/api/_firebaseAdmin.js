/**
 * Firebase Admin SDK 공유 헬퍼
 * Vercel 서버리스 함수에서 공통으로 사용
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let _db = null;
let _auth = null;

function initAdminApp() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is missing');
  const serviceAccount = JSON.parse(raw);
  // Vercel 환경변수에서 \\n 이 이중 이스케이프될 수 있어 보정
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  initializeApp({ credential: cert(serviceAccount) });
}

export function getAdminDb() {
  if (_db) return _db;
  initAdminApp();
  _db = getFirestore();
  return _db;
}

export function getAdminAuth() {
  if (_auth) return _auth;
  initAdminApp();
  _auth = getAuth();
  return _auth;
}

/**
 * Firebase ID 토큰 검증 → UID 반환
 * @param {string} authHeader  "Bearer <token>"
 * @returns {Promise<string>} uid
 */
export async function verifyIdToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }
  const idToken = authHeader.slice(7);
  const decoded = await getAdminAuth().verifyIdToken(idToken);
  return decoded.uid;
}

/**
 * API 키 검증 → key 문서 반환
 * @param {string} apiKey  "arha_sk_..."
 * @returns {Promise<{ref, data}>}
 */
export async function verifyApiKey(apiKey) {
  if (!apiKey?.startsWith('arha_sk_')) {
    throw new Error('Invalid API key format');
  }
  const db = getAdminDb();
  const snap = await db.collection('apiKeys')
    .where('key', '==', apiKey)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new Error('API key not found or inactive');
  }

  const doc = snap.docs[0];
  return { ref: doc.ref, data: doc.data() };
}
