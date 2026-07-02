import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const journal = defineCollection({
  loader: glob({ pattern: '**/*.mdoc', base: './src/content/journal' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    pillar: z.enum(['trips', 'marine-life', 'fish-id', 'gear', 'tips']),
    excerpt: z.string().optional(),
    cover: z.string().optional(),
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

export const collections = { journal, pillars };
