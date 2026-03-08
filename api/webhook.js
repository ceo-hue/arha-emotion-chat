/**
 * Stripe Webhook 처리
 * POST /api/webhook
 *
 * CRITICAL: bodyParser: false 필수 — Vercel이 body를 parse하면 서명 검증 실패
 */

// Vercel body 파싱 비활성화 (Stripe 서명 검증에 raw body 필요)
export const config = {
  api: { bodyParser: false },
  maxDuration: 30,
};

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Stripe = require('stripe');

import { getAdminDb } from './_firebaseAdmin.js';

/** Node.js IncomingMessage stream → Buffer */
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Firestore 구독 정보 업데이트 헬퍼 */
async function updateSubscription(db, uid, subscription) {
  const isActive = ['active', 'trialing'].includes(subscription.status);
  const billingCycle = subscription.metadata?.billingCycle ?? 'monthly';
  await db.doc(`users/${uid}/profile/info`).set({
    tier: isActive ? 'paid' : 'free',
    subscriptionStatus: subscription.status,
    stripeSubscriptionId: subscription.id,
    billingCycle,
    currentPeriodEnd: subscription.current_period_end,
    updatedAt: new Date(),
  }, { merge: true });
  console.log(`[webhook] subscription.updated uid=${uid} status=${subscription.status} → tier=${isActive ? 'paid' : 'free'}`);
}

/** stripeCustomerId로 uid 역조회 (metadata.firebaseUid 없을 때 fallback) */
async function resolveUidByCustomer(db, customerId) {
  const snap = await db.collectionGroup('profile')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  // 경로: users/{uid}/profile/info → parent.parent.id = uid
  return snap.docs[0].ref.parent.parent.id;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // 1. Stripe 서명 검증
  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      req.headers['stripe-signature'],
      webhookSecret,
    );
  } catch (e) {
    console.error('[webhook] signature verification failed:', e.message);
    return res.status(400).json({ error: `Webhook Error: ${e.message}` });
  }

  const db = getAdminDb();

  try {
    switch (event.type) {

      // ── 결제 완료 → tier = 'paid' ──────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object;
        const uid = session.metadata?.firebaseUid
          ?? await resolveUidByCustomer(db, session.customer);

        if (!uid) {
          console.error('[webhook] checkout.session.completed: uid 없음, customer:', session.customer);
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const billingCycle = session.metadata?.billingCycle ?? subscription.metadata?.billingCycle ?? 'monthly';

        await db.doc(`users/${uid}/profile/info`).set({
          tier: 'paid',
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          subscriptionStatus: subscription.status,
          billingCycle,
          currentPeriodEnd: subscription.current_period_end,
          updatedAt: new Date(),
        }, { merge: true });

        console.log(`[webhook] checkout.completed uid=${uid} → tier=paid ends=${new Date(subscription.current_period_end * 1000).toISOString()}`);
        break;
      }

      // ── 구독 상태 변경 (갱신, 카드 실패 후 복구 등) ──────────────────────
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const uid = subscription.metadata?.firebaseUid
          ?? await resolveUidByCustomer(db, subscription.customer);
        if (!uid) { console.error('[webhook] subscription.updated: uid 없음'); break; }
        await updateSubscription(db, uid, subscription);
        break;
      }

      // ── 구독 취소/만료 → tier = 'free' ────────────────────────────────────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const uid = subscription.metadata?.firebaseUid
          ?? await resolveUidByCustomer(db, subscription.customer);
        if (!uid) { console.error('[webhook] subscription.deleted: uid 없음'); break; }

        await db.doc(`users/${uid}/profile/info`).set({
          tier: 'free',
          subscriptionStatus: 'canceled',
          currentPeriodEnd: subscription.current_period_end,
          updatedAt: new Date(),
        }, { merge: true });

        console.log(`[webhook] subscription.deleted uid=${uid} → tier=free`);
        break;
      }

      // ── 결제 실패 → past_due 경고 (바로 다운그레이드 하지 않음) ──────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (!invoice.subscription) break;
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const uid = subscription.metadata?.firebaseUid
          ?? await resolveUidByCustomer(db, invoice.customer);
        if (!uid) break;

        await db.doc(`users/${uid}/profile/info`).set({
          subscriptionStatus: 'past_due',
          updatedAt: new Date(),
        }, { merge: true });

        console.log(`[webhook] invoice.payment_failed uid=${uid} → subscriptionStatus=past_due`);
        break;
      }

      default:
        // 처리 안 하는 이벤트는 무시
        break;
    }
  } catch (e) {
    console.error('[webhook] handler error:', e);
    return res.status(500).json({ error: 'Internal webhook processing error' });
  }

  return res.status(200).json({ received: true });
}
