// Static imports so Astro can optimise these at build time.
import type { ImageMetadata } from 'astro';
import diaryEntries from '../assets/pillars/diary-entries.jpg';
import diveSiteReviews from '../assets/pillars/dive-site-reviews.jpg';
import fishId from '../assets/pillars/fish-id.jpg';
import gear from '../assets/pillars/gear.jpg';
import tips from '../assets/pillars/tips.jpg';

export const pillarImages: Record<string, ImageMetadata> = {
  'diary-entries': diaryEntries,
  'dive-site-reviews': diveSiteReviews,
  'fish-id': fishId,
  gear,
  tips,
};
