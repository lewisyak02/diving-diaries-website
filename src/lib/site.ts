import siteData from '../content/site/index.json';

// Central site configuration. Editable values (tagline, bio, email, socials)
// come from src/content/site/index.json via Keystatic; constants live here.
export const SITE = {
  name: 'Diving Diaries',
  url: 'https://divingdiaries.au',
  // The person behind the brand, used for the Person JSON-LD (knowledge panel).
  founder: 'Lewis Kay',
  location: 'Australia',
  tagline: siteData.tagline ?? 'Sharing the beauty of the underwater world',
  catchphrase: "Let's see what we can see",
  bio:
    siteData.bio ??
    'Dive diaries, dive site reviews, fish ID, gear and tips from an Australian PADI Divemaster.',
  description:
    'Diving Diaries is an underwater adventure content brand from a PADI Divemaster diving all around Australia. Cinematic diary entries, dive site reviews, a fish ID series, gear and tips. Sharing the beauty of the underwater world.',
  email: siteData.email ?? 'lewisyak02@gmail.com',
  socials: {
    youtube: siteData.youtube || null,
    instagram: siteData.instagram || null,
    tiktok: siteData.tiktok || null,
  },
} as const;

// Only the socials that are actually set, used for nav links and JSON-LD sameAs.
export const socialLinks = (
  [
    { label: 'YouTube', href: SITE.socials.youtube },
    { label: 'Instagram', href: SITE.socials.instagram },
    { label: 'TikTok', href: SITE.socials.tiktok },
  ] as { label: string; href: string | null }[]
).filter((s): s is { label: string; href: string } => Boolean(s.href));

export const sameAs = socialLinks.map((s) => s.href);
