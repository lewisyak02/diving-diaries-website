import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import Stripe from 'stripe';
import {
  readCounts,
  variantKey,
  packKeyToVariant,
  encodeTally,
  type Counts,
} from '../../lib/stock';

export const prerender = false;

const CURRENCY = 'aud';
const SHIPPING_CENTS = 150; // $1.50 flat, Australia wide

/** Cart lines arrive as a slug and a quantity, and nothing else is believed. */
interface Line {
  id: string; // "<slug>" or "<slug>:ds" for the drop shadow finish
  qty: number;
  pack?: string[]; // pack only: the chosen variant keys
}

const cents = (price: string) => Math.round(parseFloat(price) * 100);

export const POST: APIRoute = async ({ request, url }) => {
  const key = import.meta.env.STRIPE_SECRET_KEY;
  if (!key) {
    return json({ error: 'Checkout is not configured yet.' }, 503);
  }

  let lines: Line[];
  try {
    const body = await request.json();
    lines = Array.isArray(body?.lines) ? body.lines : [];
  } catch {
    return json({ error: 'Could not read the cart.' }, 400);
  }
  if (!lines.length) return json({ error: 'The cart is empty.' }, 400);

  const products = await getCollection('products');
  const bySlug = new Map(products.map((p) => [p.id, p]));

  // The live counter, not the numbers baked into the page. Cards are a snapshot
  // from the last build; this is what is actually left in the drawer.
  const { counts } = await readCounts();

  const stripe = new Stripe(key);
  const items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const packNotes: string[] = [];
  // Stripe ids to resolve and check before charging. Accepts either a price id
  // or a product id, since the dashboard shows the product id far more
  // prominently and that is what people copy.
  const toResolve: { at: number; id: string; expected: number; name: string }[] = [];
  // Every physical sticker this order would take out of the drawer. Singles and
  // pack contents land in the same tally, because they come from the same
  // drawer: three fiddler rays loose plus two inside a pack is five fiddler
  // rays. Checked once at the end, and sent to Stripe so the webhook can
  // subtract exactly what was sold.
  const tally: Counts = {};
  const take = (vkey: string, qty: number) => {
    tally[vkey] = (tally[vkey] ?? 0) + qty;
  };

  for (const line of lines) {
    const qty = Math.floor(Number(line.qty));
    if (!Number.isFinite(qty) || qty < 1) return json({ error: 'Bad quantity.' }, 400);

    const dropShadow = line.id.endsWith(':ds');
    const slug = dropShadow ? line.id.slice(0, -3) : line.id;
    const product = bySlug.get(slug);
    if (!product) return json({ error: 'That sticker does not exist.' }, 400);

    const d = product.data;
    if (!d.price) return json({ error: `${d.name} has no price yet.` }, 409);
    if (d.comingSoon) return json({ error: `${d.name} is not on sale yet.` }, 409);
    if (d.soldOut) return json({ error: `${d.name} is sold out.` }, 409);
    if (d.minOrder && qty < d.minOrder) {
      return json({ error: `${d.name} has a minimum order of ${d.minOrder}.` }, 409);
    }

    // A pack is one line, but the contents have to reach the packing bench.
    if (d.pack) {
      const picked = Array.isArray(line.pack) ? line.pack : [];
      if (picked.length !== d.pack.choose * qty) {
        return json({ error: `Pick ${d.pack.choose} stickers for each pack.` }, 400);
      }
      const allowed = new Set(
        d.pack.from.map((e) => (e.dropShadow ? `${e.product}-drop-shadow` : e.product))
      );
      const inPack = new Map<string, number>();
      for (const k of picked) {
        if (!allowed.has(k)) return json({ error: 'That sticker is not in the pack range.' }, 400);
        inPack.set(k, (inPack.get(k) ?? 0) + 1);
      }
      for (const [k, n] of inPack) {
        // A packed sticker is a sold sticker. It counts.
        take(packKeyToVariant(k), n);
      }
      packNotes.push([...inPack].map(([k, n]) => `${variantName(k, bySlug)} x${n}`).join(', '));
    } else {
      take(variantKey(slug, dropShadow), qty);
    }

    // Prefer the real Stripe price, so the sale is recorded against the actual
    // product and the dashboard can report units sold. The inline price is the
    // fallback: it charges correctly but spawns a one off product each time.
    const stripeId = dropShadow ? d.stripePriceIdDropShadow : d.stripePriceId;
    if (stripeId) {
      // Filled in once the id has been resolved and the price verified.
      toResolve.push({ at: items.length, id: stripeId, expected: cents(d.price), name: d.name });
      items.push({ price: '', quantity: qty });
      continue;
    }

    const finish = dropShadow ? ' (drop shadow)' : '';
    items.push({
      quantity: qty,
      price_data: {
        currency: CURRENCY,
        unit_amount: cents(d.price),
        product_data: {
          name: `${d.name}${finish}`,
          ...(d.description ? { description: d.description.slice(0, 300) } : {}),
        },
      },
    });
  }

  // One stock check for the whole order, now that everything the cart would
  // take has been added up. An untracked variant is not in `counts` and sells
  // freely, which is how a sticker with no count set behaves today.
  for (const [vkey, qty] of Object.entries(tally)) {
    const left = counts[vkey];
    if (left === undefined) continue;
    const name = variantName(vkey, bySlug);
    if (left === 0) return json({ error: `${name} is sold out.` }, 409);
    if (qty > left) return json({ error: `Only ${left} of ${name} left.` }, 409);
  }

  // Two places now hold a price, so make sure they agree. Charging someone a
  // different number to the one on the card they were looking at is the one
  // failure here that would really matter.
  try {
    const seen = new Map<string, Stripe.Price>();
    for (const v of toResolve) {
      let price = seen.get(v.id);
      if (!price) {
        if (v.id.startsWith('prod_')) {
          const product = await stripe.products.retrieve(v.id, { expand: ['default_price'] });
          const dp = product.default_price;
          if (!dp || typeof dp === 'string') {
            console.error(`[checkout] ${v.name}: product ${v.id} has no default price`);
            return json({ error: `${v.name} has no price set in Stripe.` }, 409);
          }
          price = dp;
        } else {
          price = await stripe.prices.retrieve(v.id);
        }
        seen.set(v.id, price);
      }

      if (price.active === false) {
        return json({ error: `${v.name} is not available right now.` }, 409);
      }
      if (price.unit_amount !== v.expected || price.currency !== CURRENCY) {
        console.error(
          `[checkout] ${v.name}: site says ${v.expected} ${CURRENCY}, Stripe says ${price.unit_amount} ${price.currency} (${v.id})`
        );
        return json(
          { error: `The price of ${v.name} has changed. Refresh and try again.` },
          409
        );
      }
      items[v.at] = { ...items[v.at], price: price.id };
    }
  } catch (err) {
    console.error('[checkout] could not resolve a Stripe price', err);
    return json({ error: 'Could not confirm pricing. Try again shortly.' }, 502);
  }

  const origin = url.origin;

  // The pack contents are the only thing not obvious from the line items.
  // This has to ride on the PaymentIntent, not just the session: the
  // dashboard's Payments page reads the PaymentIntent, and Stripe does not
  // copy session metadata across, so a session-only note cannot be seen
  // where the order actually gets packed. Kept on the session too, since
  // that is what the success URL can look up.
  const packs = packNotes.join(' | ').slice(0, 500);
  // `stock` is the machine readable version of the same order: what to take
  // off the counter once the payment lands. The webhook reads it off the
  // session, so it never has to work out what was in a pack.
  const stock = encodeTally(tally).slice(0, 500);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: items,
      shipping_address_collection: { allowed_countries: ['AU'] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: SHIPPING_CENTS, currency: CURRENCY },
            display_name: 'Australia wide',
          },
        },
      ],
      metadata: { stock, ...(packs ? { packs } : {}) },
      payment_intent_data: {
        metadata: { stock, ...(packs ? { packs } : {}) },
        ...(packs ? { description: `Sticker pack: ${packs}`.slice(0, 1000) } : {}),
      },
      success_url: `${origin}/order-confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop`,
    });

    return json({ url: session.url });
  } catch (err) {
    console.error('[checkout] stripe rejected the session', err);
    return json({ error: 'Stripe could not start the checkout. Try again shortly.' }, 502);
  }
};

/** Reads a variant or pack key back into something a person can act on. */
function variantName(key: string, bySlug: Map<string, { data: { name: string } }>) {
  const isDs = key.endsWith(':ds') || key.endsWith('-drop-shadow');
  const slug = key.endsWith(':ds')
    ? key.slice(0, -3)
    : key.endsWith('-drop-shadow')
      ? key.slice(0, -'-drop-shadow'.length)
      : key;
  const name = bySlug.get(slug)?.data.name ?? slug;
  return `${name}${isDs ? ' (drop shadow)' : ''}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
