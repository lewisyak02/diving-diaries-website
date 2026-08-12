import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import Stripe from 'stripe';

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

  const stripe = new Stripe(key);
  const items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const packNotes: string[] = [];
  // Price id -> the site price it is supposed to match, checked before charging.
  const toVerify: { id: string; expected: number; name: string }[] = [];

  for (const line of lines) {
    const qty = Math.floor(Number(line.qty));
    if (!Number.isFinite(qty) || qty < 1) return json({ error: 'Bad quantity.' }, 400);

    const dropShadow = line.id.endsWith(':ds');
    const slug = dropShadow ? line.id.slice(0, -3) : line.id;
    const product = bySlug.get(slug);
    if (!product) return json({ error: 'That sticker does not exist.' }, 400);

    const d = product.data;
    if (!d.price) return json({ error: `${d.name} has no price yet.` }, 409);
    if (d.soldOut || d.stock === 0) return json({ error: `${d.name} is sold out.` }, 409);

    // The count is a manual one, but it still decides what can be ordered.
    if (d.stock !== undefined && qty > d.stock) {
      return json({ error: `Only ${d.stock} of ${d.name} left.` }, 409);
    }
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
      const tally = new Map<string, number>();
      for (const k of picked) {
        if (!allowed.has(k)) return json({ error: 'That sticker is not in the pack range.' }, 400);
        tally.set(k, (tally.get(k) ?? 0) + 1);
      }
      // A pack draws from the same drawer as the singles.
      for (const [k, n] of tally) {
        const base = k.endsWith('-drop-shadow') ? k.slice(0, -'-drop-shadow'.length) : k;
        const stock = bySlug.get(base)?.data.stock;
        if (stock !== undefined && n > stock) {
          return json({ error: `Not enough ${bySlug.get(base)!.data.name} left.` }, 409);
        }
      }
      packNotes.push([...tally].map(([k, n]) => `${k} x${n}`).join(', '));
    }

    // Prefer the real Stripe price, so the sale is recorded against the actual
    // product and the dashboard can report units sold. The inline price is the
    // fallback: it charges correctly but spawns a one off product each time.
    const priceId = dropShadow ? d.stripePriceIdDropShadow : d.stripePriceId;
    if (priceId) {
      items.push({ price: priceId, quantity: qty });
      toVerify.push({ id: priceId, expected: cents(d.price), name: d.name });
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

  // Two places now hold a price, so make sure they agree. Charging someone a
  // different number to the one on the card they were looking at is the one
  // failure here that would really matter.
  try {
    const seen = new Map<string, Stripe.Price>();
    for (const v of toVerify) {
      let price = seen.get(v.id);
      if (!price) {
        price = await stripe.prices.retrieve(v.id);
        seen.set(v.id, price);
      }
      if (price.unit_amount !== v.expected || price.currency !== CURRENCY) {
        console.error(
          `[checkout] ${v.name}: site says ${v.expected} ${CURRENCY}, Stripe price ${v.id} says ${price.unit_amount} ${price.currency}`
        );
        return json(
          { error: `The price of ${v.name} has changed. Refresh and try again.` },
          409
        );
      }
      if (price.active === false) {
        return json({ error: `${v.name} is not available right now.` }, 409);
      }
    }
  } catch (err) {
    console.error('[checkout] could not verify a Stripe price', err);
    return json({ error: 'Could not confirm pricing. Try again shortly.' }, 502);
  }

  const origin = url.origin;

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
      // The pack contents are the only thing not obvious from the line items.
      ...(packNotes.length ? { metadata: { packs: packNotes.join(' | ').slice(0, 500) } } : {}),
      success_url: `${origin}/order-confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop`,
    });

    return json({ url: session.url });
  } catch (err) {
    console.error('[checkout] stripe rejected the session', err);
    return json({ error: 'Stripe could not start the checkout. Try again shortly.' }, 502);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
