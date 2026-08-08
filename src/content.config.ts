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
