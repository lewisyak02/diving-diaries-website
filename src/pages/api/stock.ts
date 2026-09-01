/**
 * The counter, for Lewis. GET reads it, POST sets it.
 *
 * Guarded by STOCK_TOKEN, a password you make up and set in Netlify. Without it
 * set, this is off entirely. Counts are not secret, but being able to rewrite
 * them is, so both verbs need the token.
 *
 * Editing here never triggers a deploy, which is the whole point: a hand edit
 * to a product file costs 15 Netlify credits, 5% of the month.
 */
import type { APIRoute } from 'astro';
import { listVariants, readCounts, setCounts, type Counts } from '../../lib/stock';

export const prerender = false;

const authorised = (request: Request, body?: { token?: unknown }) => {
  const expected = import.meta.env.STOCK_TOKEN;
  if (!expected) return false;
  const given = request.headers.get('x-stock-token') ?? (typeof body?.token === 'string' ? body.token : '');
  // Same length compare, so a wrong token cannot be found a character at a time.
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
};

async function report() {
  const [variants, { counts, live }] = await Promise.all([listVariants(), readCounts()]);
  return {
    live, // false means Blobs is not reachable, so these are the seeded numbers
    total: variants.reduce((sum, v) => sum + (counts[v.key] ?? 0), 0),
    variants: variants.map((v) => ({
      key: v.key,
      name: v.name,
      count: counts[v.key] ?? null, // null means this one is not counted
      seed: v.seed ?? null,
    })),
  };
}

export const GET: APIRoute = async ({ request }) => {
  if (!import.meta.env.STOCK_TOKEN) return json({ error: 'The counter is not set up yet.' }, 503);
  if (!authorised(request)) return json({ error: 'Wrong password.' }, 401);
  return json(await report());
};

export const POST: APIRoute = async ({ request }) => {
  if (!import.meta.env.STOCK_TOKEN) return json({ error: 'The counter is not set up yet.' }, 503);

  let body: { token?: unknown; counts?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Could not read that.' }, 400);
  }
  if (!authorised(request, body)) return json({ error: 'Wrong password.' }, 401);

  const known = new Set((await listVariants()).map((v) => v.key));
  const changes: Counts = {};
  for (const [key, value] of Object.entries((body.counts ?? {}) as Record<string, unknown>)) {
    if (!known.has(key)) return json({ error: `There is no sticker called ${key}.` }, 400);
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 0) return json({ error: 'Counts have to be whole and positive.' }, 400);
    changes[key] = n;
  }
  if (!Object.keys(changes).length) return json({ error: 'Nothing to change.' }, 400);

  const saved = await setCounts(changes);
  if (!saved) {
    return json({ error: 'Could not save. The counter only works on the live site.' }, 503);
  }
  return json(await report());
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
