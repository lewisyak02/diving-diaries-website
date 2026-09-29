import { PILLARS, type PillarSlug } from './nav';

// The Watch page groups every video into a series. The five pillars are series,
// and so is Scubavan, which is Watch only: the campervan build is not one of the
// content pillars and has no pillar page.
export type SeriesSlug = PillarSlug | 'scubavan';

export interface Series {
  slug: SeriesSlug;
  label: string;
  /** One line under the series name on Watch. */
  blurb: string;
  /** Vertical 9:16 cards rather than widescreen. */
  reels?: boolean;
}

const pillarName = (slug: PillarSlug) =>
  PILLARS.find((p) => p.slug === slug)?.label ?? slug;

// Watch page order. Change this list to reorder the rail. A series with no
// videos is dropped from the rail entirely, so an empty one never shows.
export const SERIES: Series[] = [
  {
    slug: 'diary-entries',
    label: pillarName('diary-entries'),
    blurb: 'Full dives, start to finish.',
  },
  {
    slug: 'fish-id',
    label: pillarName('fish-id'),
    blurb: 'Short species guides, one animal at a time.',
    reels: true,
  },
  {
    slug: 'dive-site-reviews',
    label: pillarName('dive-site-reviews'),
    blurb: 'What a site is really like before you get wet.',
  },
  {
    slug: 'scubavan',
    label: 'Scubavan',
    blurb: 'Turning a Hiace into a dive van.',
  },
  {
    slug: 'gear',
    label: pillarName('gear'),
    blurb: 'Cameras, masks and the kit that gets used.',
  },
  {
    slug: 'tips',
    label: pillarName('tips'),
    blurb: 'Skills and safety for newer divers.',
  },
];

/** The word for one of these, so a count reads right. */
export const unit = (s: Series, n: number) =>
  s.reels ? (n === 1 ? 'reel' : 'reels') : n === 1 ? 'video' : 'videos';
