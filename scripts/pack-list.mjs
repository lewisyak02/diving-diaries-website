#!/usr/bin/env node
// What is in each sticker pack order.
//
// Pack contents are stored on the Stripe Checkout Session. The dashboard's
// Payments page reads the PaymentIntent instead, so for any order placed
// before that was fixed the contents are in Stripe but not on screen.
// This reads them back.
//
// Run from inside Website/:
//   STRIPE_SECRET_KEY=sk_live_... node scripts/pack-list.mjs
//   STRIPE_SECRET_KEY=sk_live_... node scripts/pack-list.mjs --all
//
// The key is read from the environment and never written anywhere.

import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('Set STRIPE_SECRET_KEY first, e.g.\n  STRIPE_SECRET_KEY=sk_live_... node scripts/pack-list.mjs');
  process.exit(1);
}

const showAll = process.argv.includes('--all');
const stripe = new Stripe(key);

const sessions = await stripe.checkout.sessions.list({ limit: 50 });
const paid = sessions.data.filter((s) => s.payment_status === 'paid');

if (!paid.length) {
  console.log('No paid orders found.');
  process.exit(0);
}

for (const s of paid) {
  const packs = s.metadata?.packs;
  if (!packs && !showAll) continue;

  const when = new Date(s.created * 1000).toLocaleString('en-AU');
  const who = s.customer_details?.name ?? s.customer_details?.email ?? 'unknown';
  const total = ((s.amount_total ?? 0) / 100).toFixed(2);

  console.log('\n' + '='.repeat(60));
  console.log(`${when}  ${who}  $${total} ${s.currency?.toUpperCase()}`);
  console.log(`session ${s.id}`);

  const items = await stripe.checkout.sessions.listLineItems(s.id, { limit: 100 });
  for (const li of items.data) {
    console.log(`  ${li.quantity} x ${li.description}`);
  }

  if (packs) {
    console.log('\n  PACK CONTENTS:');
    for (const one of packs.split(' | ')) console.log(`    ${one}`);
  }

  const a = s.shipping_details?.address ?? s.customer_details?.address;
  if (a) {
    console.log('\n  SHIP TO:');
    console.log(`    ${s.shipping_details?.name ?? who}`);
    for (const l of [a.line1, a.line2, `${a.city ?? ''} ${a.state ?? ''} ${a.postal_code ?? ''}`.trim(), a.country]) {
      if (l) console.log(`    ${l}`);
    }
  }
}

console.log('');
