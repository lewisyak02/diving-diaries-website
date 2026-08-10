import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const journal = defineCollection({
  loader: glob({ pattern: '**/*.mdoc', base: './src/content/journal' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    pillar: z.enum(['diary-entries', 'dive-site-reviews', 'fish-id', 'gear', 'tips']),
    excerpt: z.string().optional(),
    cover: z.string().optional(),
    youtube: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

const pillars = defineCollection({
  loader: glob({ pattern: '**/*.mdoc', base: './src/content/pillars' }),
  schema: z.object({
    title: z.string(),
    order: z.number().default(1),
    blurb: z.string().optional(),
    cover: z.string().optional(),
  }),
});

const products = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/products' }),
  schema: z.object({
    name: z.string(),
    price: z.string().optional(),
    image: z.string().optional(),
    // Source artwork the sticker viewer renders. Falls back to `image`.
    artwork: z.string().optional(),
    // Die cut shape applied by the renderer, not baked into the artwork.
    dieCut: z.enum(['circle', 'none', 'contour']).default('none'),
    // How the surface is rendered. Falls back to `holographic` when unset.
    material: z.enum(['holo', 'matte', 'decal']).optional(),
    // Decal only: preview the drop shadow finish instead of plain white.
    dropShadow: z.boolean().default(false),
    // Switchable finishes. The card renders these as buttons and the viewer
    // redraws, so the finish can be seen rather than just read about.
    finishes: z
      .array(z.object({ label: z.string(), dropShadow: z.boolean().default(false) }))
      .optional(),
    // Short label for the pack picker, where full product names do not fit.
    packLabel: z.string().optional(),
    // Mix and match bundle: pick `choose` stickers from `from` (product slugs).
    // The card renders a picker instead of a single sticker.
    pack: z
      .object({
        choose: z.number().default(5),
        // Each entry is a buyable variant, not just a product: a logo in white
        // and the same logo with a drop shadow are two different stickers.
        from: z.array(
          z.object({
            product: z.string(),
            dropShadow: z.boolean().default(false),
          })
        ),
      })
      .optional(),
    // Pre rendered scrub sequence manifest, for low power devices.
    spin: z.string().optional(),
    // Short sentence describing the sticker, used as the viewer's alt text.
    altText: z.string().optional(),
    description: z.string().optional(),
    size: z.string().optional(),
    finish: z.string().optional(),
    holographic: z.boolean().default(false),
    buyUrl: z.string().optional(),
    soldOut: z.boolean().default(false),
    order: z.number().default(1),
  }),
});

export const collections = { journal, pillars, products };
