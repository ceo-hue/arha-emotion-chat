/**
 * Stripe Checkout 세션 생성
 * POST /api/checkout
 * Body: { priceId, billingCycle }
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

  // 1. Firebase 인증
  let uid;
  try {
    uid = await verifyIdToken(req.headers['authorization']);
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized: ' + e.message });
  }

  const { priceId, billingCycle } = req.body || {};

  const validPrices = [
    process.env.STRIPE_PRICE_MONTHLY,
    process.env.STRIPE_PRICE_YEARLY,
  ].filter(Boolean);

  if (!priceId || !validPrices.includes(priceId)) {
    return res.status(400).json({ error: 'Invalid price ID' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const db = getAdminDb();
    const profileRef = db.doc(`users/${uid}/profile/info`);
    const profileSnap = await profileRef.get();
    const profile = profileSnap.exists ? profileSnap.data() : {};

    // 기존 stripeCustomerId 재사용 또는 신규 생성
    let customerId = profile.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email ?? undefined,
        name: profile.displayName ?? undefined,
        metadata: { firebaseUid: uid },
      });
      customerId = customer.id;
      // Checkout 완료 전에 미리 저장 (중복 생성 방지)
      await profileRef.set({ stripeCustomerId: customerId }, { merge: true });
    }

    const origin = req.headers.origin ?? 'https://arha-emotion-chat.vercel.app';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
      metadata: { firebaseUid: uid, billingCycle: billingCycle ?? 'monthly' },
      subscription_data: {
        metadata: { firebaseUid: uid, billingCycle: billingCycle ?? 'monthly' },
      },
      allow_promotion_codes: true,
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('checkout error:', e.message);
    return res.status(500).json({ error: e.message || 'Failed to create checkout session' });
  }
}
