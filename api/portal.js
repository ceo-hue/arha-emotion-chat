/**
 * Stripe Customer Portal 세션 생성
 * POST /api/portal
 * Header: Authorization: Bearer <Firebase ID Token>
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Stripe = require('stripe');

import { verifyIdToken, getAdminDb } from './_firebaseAdmin.js';

export const config = { maxDuration: 30 };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let uid;
  try {
    uid = await verifyIdToken(req.headers['authorization']);
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized: ' + e.message });
  }

  try {
    const db = getAdminDb();
    const profileSnap = await db.doc(`users/${uid}/profile/info`).get();
    const customerId = profileSnap.exists ? profileSnap.data().stripeCustomerId : null;

    if (!customerId) {
      return res.status(400).json({ error: 'Stripe 고객 정보가 없습니다. 먼저 구독을 시작해주세요.' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = req.headers.origin ?? 'https://arha-emotion-chat.vercel.app';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/`,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (e) {
    console.error('portal error:', e.message);
    return res.status(500).json({ error: e.message || 'Failed to create portal session' });
  }
}
