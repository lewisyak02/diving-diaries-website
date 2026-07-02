// Primary navigation and the five content pillars.
export const NAV = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Watch', href: '/watch' },
  { label: 'Journal', href: '/journal' },
  { label: 'Contact', href: '/contact' },
] as const;

export type PillarSlug = 'trips' | 'marine-life' | 'fish-id' | 'gear' | 'tips';

// Pillar metadata (label + short blurb from the About doc). Long-form pillar
// copy lives in the CMS (src/content/pillars/*).
export const PILLARS: { slug: PillarSlug; label: string; blurb: string }[] = [
  {
    slug: 'trips',
    label: 'Trips',
    blurb: 'Dive travel vlogs and adventure diaries from the sites we explore.',
  },
  {
    slug: 'marine-life',
    label: 'Marine Life',
    blurb:
      'Up-close encounters with the ocean’s inhabitants, from stingrays and zebra sharks to the smallest reef dwellers.',
  },
  {
    slug: 'fish-id',
    label: 'Fish ID',
    blurb:
      'Our signature species-identification series, helping you recognise the marine life you see.',
  },
  {
    slug: 'gear',
    label: 'Gear',
    blurb: 'Honest looks at the cameras, masks, and dive equipment we actually use.',
  },
  {
    slug: 'tips',
    label: 'Tips',
    blurb: 'Practical advice for new and progressing divers, from skills to safety.',
  },
];

export const pillarLabel = (slug: string) =>
  PILLARS.find((p) => p.slug === slug)?.label ?? slug;
