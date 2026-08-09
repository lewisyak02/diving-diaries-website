// Every destination. The full list lives in the dropdown menu.
export const NAV = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Watch', href: '/watch' },
  { label: 'Journal', href: '/journal' },
  { label: 'Community', href: '/community' },
  { label: 'Shop', href: '/shop' },
  { label: 'Contact', href: '/contact' },
] as const;

// The few shown as tabs in the bar itself. Everything else stays one tap away
// in the menu, so the bar does not get crowded.
export const TAB_NAV = NAV.filter((n) =>
  ['/about', '/watch', '/shop', '/contact'].includes(n.href)
);

export type PillarSlug =
  | 'diary-entries'
  | 'dive-site-reviews'
  | 'fish-id'
  | 'gear'
  | 'tips';

// Pillar metadata (label + short blurb). Long form pillar copy lives in the CMS
// (src/content/pillars/*).
export const PILLARS: { slug: PillarSlug; label: string; blurb: string }[] = [
  {
    slug: 'diary-entries',
    label: 'Diary Entries',
    blurb: 'Long form dive diaries, full adventures from the dives I do, start to finish.',
  },
  {
    slug: 'dive-site-reviews',
    label: 'Dive Site Reviews',
    blurb: 'Honest reviews of the sites I dive, conditions, what to expect, and what you might see.',
  },
  {
    slug: 'fish-id',
    label: 'Fish ID',
    blurb: 'My signature species identification series, helping you recognise the marine life you see.',
  },
  {
    slug: 'gear',
    label: 'Gear',
    blurb: 'Honest reviews of the cameras, masks, and dive equipment I use, coming soon.',
  },
  {
    slug: 'tips',
    label: 'Tips',
    blurb: 'Practical advice for new and progressing divers, from skills to safety.',
  },
];

export const pillarLabel = (slug: string) =>
  PILLARS.find((p) => p.slug === slug)?.label ?? slug;
