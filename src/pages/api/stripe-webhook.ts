/**
 * Stripe tells the site when an order is actually paid, and the counter comes
 * down. This is the only thing that decrements stock automatically.
 *
 * Set up in Stripe: Developers > Webhooks > add endpoint
 *   https://divingdiaries.au/api/stripe-webhook
 *   events: checkout.session.completed, checkout.session.async_payment_succeeded
 * then put the signing secret in Netlify as STRIPE_WEBHOOK_SECRET.
 *
 * A refund does NOT put stock back, because a refunded sticker has usually
 * already been posted. Put it back by hand from /stock if it comes home.
 */
import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { applyOrder, claimOrder, decodeTally, releaseOrder } from '../../lib/stock';

export const prerender = false;

const HANDLED = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded']);

export const POST: APIRoute = async ({ request }) => {
  const key = import.meta.env.STRIPE_SECRET_KEY;
  const secret = import.meta.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !secret) return new Response('Webhook is not configured.', { status: 503 });

  const signature = request.headers.get('stripe-signature');
  if (!signature) return new Response('Unsigned.', { status: 400 });

  // The signature is over the exact bytes Stripe sent, so the body has to be
  // read raw. Anything that parses it first breaks verification.
  const body = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(key);
    event = await stripe.webhooks.constructEventAsync(body, signature, secret);
  } catch (err) {
    console.error('[webhook] bad signature', err);
    return new Response('Bad signature.', { status: 400 });
  }

  if (!HANDLED.has(event.type)) return new Response('Ignored.', { status: 200 });

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== 'paid') return new Response('Not paid yet.', { status: 200 });

  const encoded = session.metadata?.stock;
  if (!encoded) {
    console.warn(`[webhook] ${session.id} carried no stock tally, nothing to count`);
    return new Response('Nothing to count.', { status: 200 });
  }

  // Stripe retries anything it thinks failed, so an order is claimed before it
  // is counted. Two deliveries of the same order must not take stock twice.
  if (!(await claimOrder(session.id))) {
    return new Response('Already counted.', { status: 200 });
  }

  const tally = decodeTally(encoded);
  const ok = await applyOrder(tally);
  if (!ok) {
    // Let go, so Stripe's retry gets another go at it.
    await releaseOrder(session.id);
    console.error('[webhook] could not apply', session.id, tally);
    return new Response('Could not update stock.', { status: 500 });
  }

  console.log(`[webhook] counted ${session.id}: ${encoded}`);
  return new Response('Counted.', { status: 200 });
};
