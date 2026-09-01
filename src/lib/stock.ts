/**
 * The stock counter.
 *
 * Counts live in Netlify Blobs, outside git, so selling a sticker never
 * triggers a rebuild. The `stock` / `stockDropShadow` numbers in the product
 * files are only the **seed**: the first count a variant ever has. Once a
 * variant exists in the blob, the blob wins and editing the JSON does nothing.
 * Restock from /stock instead, which costs no deploy.
 *
 * A *variant* is one physical sticker in the drawer, not a product. The two
 * logo decals sell in White and Drop shadow and those are different sheets, so
 * they are counted separately. Variant keys match the cart's line ids:
 *   "fiddler-ray", "front-adhesive-medium", "front-adhesive-medium:ds"
 *
 * Blobs only exists on Netlify. Locally there is no store, so everything falls
 * back to the seed and nothing persists.
 */
import { getCollection } from 'astro:content';
import { getStore } from '@netlify/blobs';

const STORE = 'stock';
const COUNTS_KEY = 'counts';
const APPLIED_PREFIX = 'applied/';
const DS = ':ds';
const PACK_DS = '-drop-shadow';

export type Counts = Record<string, number>;

export interface Variant {
  key: string;
  slug: string;
  dropShadow: boolean;
  /** Full name, finish included, as it reads on an order. */
  name: string;
  /** Starting count from the product file. Undefined means not counted. */
  seed?: number;
}

export const variantKey = (slug: string, dropShadow = false) =>
  dropShadow ? `${slug}${DS}` : slug;

/** The pack picker keys its options differently. Same drawer, though. */
export const packKeyToVariant = (key: string) =>
  key.endsWith(PACK_DS) ? `${key.slice(0, -PACK_DS.length)}${DS}` : key;

export const splitVariant = (key: string) =>
  key.endsWith(DS)
    ? { slug: key.slice(0, -DS.length), dropShadow: true }
    : { slug: key, dropShadow: false };

/**
 * Every buyable sticker, one entry per finish. Packs are not listed: a pack is
 * not a thing in the drawer, it draws down the stickers it contains.
 */
export async function listVariants(): Promise<Variant[]> {
  const products = await getCollection('products');
  const out: Variant[] = [];

  for (const p of products.sort((a, b) => (a.data.order ?? 1) - (b.data.order ?? 1))) {
    const d = p.data;
    if (d.pack) continue;

    const finishes = d.finishes?.length ? d.finishes : [{ label: '', dropShadow: false }];
    for (const f of finishes) {
      out.push({
        key: variantKey(p.id, f.dropShadow),
        slug: p.id,
        dropShadow: f.dropShadow,
        name: f.label ? `${d.name}, ${f.label.toLowerCase()}` : d.name,
        seed: f.dropShadow ? d.stockDropShadow : d.stock,
      });
    }
  }
  return out;
}

function store() {
  try {
    // Strong consistency, because every write here is a read, subtract, write.
    return getStore({ name: STORE, consistency: 'strong' });
  } catch {
    // No Blobs environment, i.e. local dev or a plain `astro build`.
    return null;
  }
}

/**
 * The live counts, seeded from the product files. A variant missing from the
 * blob falls back to its seed, which is how a sticker added to the range later
 * starts counting without anyone having to prime it.
 */
export async function readCounts(): Promise<{ counts: Counts; etag?: string; live: boolean }> {
  const variants = await listVariants();
  const counts: Counts = {};
  for (const v of variants) if (v.seed !== undefined) counts[v.key] = v.seed;

  const s = store();
  if (!s) return { counts, live: false };

  try {
    const res = await s.getWithMetadata(COUNTS_KEY, { type: 'json' });
    const saved = (res?.data ?? {}) as Counts;
    for (const [key, n] of Object.entries(saved)) {
      if (typeof n === 'number' && Number.isFinite(n)) counts[key] = Math.max(0, Math.floor(n));
    }
    return { counts, etag: res?.etag, live: true };
  } catch (err) {
    console.error('[stock] could not read the counter', err);
    return { counts, live: false };
  }
}

/** Overwrite the counter. `etag` makes it a compare and swap. */
async function writeCounts(counts: Counts, etag?: string): Promise<boolean> {
  const s = store();
  if (!s) return false;
  const res = await s.setJSON(COUNTS_KEY, counts, etag ? { onlyIfMatch: etag } : {});
  return res.modified;
}

/**
 * Subtract a whole order in one go. Retries on a lost race, because two orders
 * landing together would otherwise overwrite each other and give a sticker away
 * for free. Counts stop at 0: an oversell is recorded as empty, never negative.
 */
export async function applyOrder(tally: Counts): Promise<boolean> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { counts, etag, live } = await readCounts();
    if (!live) return false;

    const next: Counts = { ...counts };
    for (const [key, qty] of Object.entries(tally)) {
      if (next[key] === undefined) continue; // untracked, sells freely
      next[key] = Math.max(0, next[key] - qty);
    }

    if (await writeCounts(next, etag)) return true;
  }
  console.error('[stock] gave up trying to apply an order', tally);
  return false;
}

/** Set counts by hand, from the /stock page. Only the keys given are touched. */
export async function setCounts(changes: Counts): Promise<Counts | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { counts, etag, live } = await readCounts();
    if (!live) return null;

    const next: Counts = { ...counts };
    for (const [key, n] of Object.entries(changes)) next[key] = Math.max(0, Math.floor(n));

    if (await writeCounts(next, etag)) return next;
  }
  return null;
}

/**
 * Claim an order so it can only ever be counted once. Stripe retries a webhook
 * it thinks failed, and a retry must not take the stock down twice.
 * Returns false if this order has already been counted.
 */
export async function claimOrder(id: string): Promise<boolean> {
  const s = store();
  if (!s) return false;
  const res = await s.set(`${APPLIED_PREFIX}${id}`, new Date().toISOString(), { onlyIfNew: true });
  return res.modified;
}

/** Let go of a claim, so a failed decrement can be retried. */
export async function releaseOrder(id: string): Promise<void> {
  const s = store();
  if (!s) return;
  try {
    await s.delete(`${APPLIED_PREFIX}${id}`);
  } catch (err) {
    console.error('[stock] could not release the claim on', id, err);
  }
}

/** Pack a tally small enough to ride in Stripe metadata: "slug:ds=3,other=1". */
export const encodeTally = (tally: Counts) =>
  Object.entries(tally)
    .map(([key, qty]) => `${key}=${qty}`)
    .join(',');

export function decodeTally(encoded: string): Counts {
  const tally: Counts = {};
  for (const part of encoded.split(',')) {
    const at = part.lastIndexOf('=');
    if (at < 1) continue;
    const key = part.slice(0, at);
    const qty = Number(part.slice(at + 1));
    if (Number.isFinite(qty) && qty > 0) tally[key] = (tally[key] ?? 0) + Math.floor(qty);
  }
  return tally;
}
