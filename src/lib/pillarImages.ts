// Static imports so Astro can optimise these at build time.
import type { ImageMetadata } from 'astro';
import trips from '../assets/pillars/trips.jpg';
import marineLife from '../assets/pillars/marine-life.jpg';
import fishId from '../assets/pillars/fish-id.jpg';
import gear from '../assets/pillars/gear.jpg';
import tips from '../assets/pillars/tips.jpg';

export const pillarImages: Record<string, ImageMetadata> = {
  trips,
  'marine-life': marineLife,
  'fish-id': fishId,
  gear,
  tips,
};
