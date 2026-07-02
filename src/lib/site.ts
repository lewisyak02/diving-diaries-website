import siteData from '../content/site/index.json';

// Central site configuration. Editable values (tagline, bio, email, socials)
// come from src/content/site/index.json via Keystatic; constants live here.
export const SITE = {
  name: 'Diving Diaries',
  url: 'https://divingdiaries.au',
  // The person behind the brand — used for the Person JSON-LD (knowledge panel).
  founder: 'Lewis Kay',
  location: 'Gold Coast, Queensland, Australia',
  tagline: siteData.tagline ?? 'Exploring the beauty of the underwater world',
  bio:
    siteData.bio ??
    'Dive trips, marine life encounters, fish ID, gear and tips from a Gold Coast diver working toward PADI Divemaster.',
  description:
    'Diving Diaries is an underwater adventure content brand from the Gold Coast — cinematic dive trips, marine life encounters, a Fish ID series, gear and tips. Exploring the beauty of the underwater world.',
  email: siteData.email ?? 'lewisyak02@gmail.com',
  socials: {
    youtube: siteData.youtube || null,
    instagram: siteData.instagram || null,
    tiktok: siteData.tiktok || null,
  },
} as const;

// Only the socials that are actually set — used for nav links and JSON-LD sameAs.
export const socialLinks = (
  [
    { label: 'YouTube', href: SITE.socials.youtube },
    { label: 'Instagram', href: SITE.socials.instagram },
    { label: 'TikTok', href: SITE.socials.tiktok },
  ] as { label: string; href: string | null }[]
).filter((s): s is { label: string; href: string } => Boolean(s.href));

export const sameAs = socialLinks.map((s) => s.href);
