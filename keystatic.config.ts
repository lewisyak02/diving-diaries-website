import { config, fields, collection, singleton } from '@keystatic/core';

// (videos singleton is defined inline below)

// Diving Diaries content model.
// storage.kind is 'local' for now (edit at /keystatic when running locally).
// At deploy time this switches to { kind: 'github', repo: 'owner/repo' }
// so Lewis can log in and edit in the browser on the live site.
export default config({
  // Local editing in dev; on the live site, edits save to GitHub (which triggers
  // a Netlify rebuild). The GitHub connection is set up once via /keystatic.
  storage: import.meta.env.PROD
    ? { kind: 'github', repo: 'lewisyak02/diving-diaries-website' }
    : { kind: 'local' },

  ui: {
    brand: { name: 'Diving Diaries' },
  },

  singletons: {
    site: singleton({
      label: 'Site settings',
      path: 'src/content/site/index',
      format: { data: 'json' },
      schema: {
        tagline: fields.text({
          label: 'Tagline',
          defaultValue: 'Exploring the beauty of the underwater world',
        }),
        bio: fields.text({
          label: 'Short bio',
          multiline: true,
        }),
        email: fields.text({ label: 'Contact email' }),
        youtube: fields.url({ label: 'YouTube URL' }),
        instagram: fields.url({ label: 'Instagram URL' }),
        tiktok: fields.url({ label: 'TikTok URL' }),
      },
    }),

    encounters: singleton({
      label: 'Recent encounters (Home)',
      path: 'src/content/encounters/index',
      format: { data: 'json' },
      schema: {
        items: fields.array(
          fields.object({
            image: fields.image({
              label: 'Photo',
              directory: 'public/images/encounters',
              publicPath: '/images/encounters/',
            }),
            caption: fields.text({ label: 'Caption' }),
          }),
          {
            label: 'Encounters',
            itemLabel: (props) => props.fields.caption.value || 'Photo',
          }
        ),
      },
    }),

    videos: singleton({
      label: 'Videos (Watch page)',
      path: 'src/content/videos/index',
      format: { data: 'json' },
      schema: {
        items: fields.array(
          fields.object({
            title: fields.text({ label: 'Title' }),
            id: fields.text({
              label: 'YouTube video ID',
              description: 'The 11-character ID from the video URL (youtu.be/XXXXXXXXXXX).',
            }),
            pillar: fields.select({
              label: 'Pillar',
              description: 'Which pillar page this video shows on. "None" keeps it on the Watch page only.',
              options: [
                { label: 'None (Watch page only)', value: 'none' },
                { label: 'Diary Entries', value: 'diary-entries' },
                { label: 'Dive Site Reviews', value: 'dive-site-reviews' },
                { label: 'Fish ID', value: 'fish-id' },
                { label: 'Gear', value: 'gear' },
                { label: 'Tips', value: 'tips' },
              ],
              defaultValue: 'none',
            }),
            short: fields.checkbox({
              label: 'Short / reel (vertical)',
              defaultValue: false,
            }),
          }),
          {
            label: 'Videos',
            itemLabel: (props) => props.fields.title.value || props.fields.id.value,
          }
        ),
      },
    }),
  },

  collections: {
    journal: collection({
      label: 'Journal',
      slugField: 'title',
      path: 'src/content/journal/*',
      format: { contentField: 'content' },
      entryLayout: 'content',
      columns: ['title', 'date'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        date: fields.date({
          label: 'Date',
          defaultValue: { kind: 'today' },
        }),
        pillar: fields.select({
          label: 'Pillar',
          options: [
            { label: 'Diary Entries', value: 'diary-entries' },
            { label: 'Dive Site Reviews', value: 'dive-site-reviews' },
            { label: 'Fish ID', value: 'fish-id' },
            { label: 'Gear', value: 'gear' },
            { label: 'Tips', value: 'tips' },
          ],
          defaultValue: 'diary-entries',
        }),
        excerpt: fields.text({
          label: 'Excerpt',
          description: 'One or two sentences shown in listings and search results.',
          multiline: true,
        }),
        cover: fields.image({
          label: 'Cover image',
          directory: 'public/images/journal',
          publicPath: '/images/journal/',
        }),
        draft: fields.checkbox({
          label: 'Draft',
          description: 'Hide from the live site until unchecked.',
          defaultValue: false,
        }),
        content: fields.markdoc({ label: 'Content' }),
      },
    }),

    pillars: collection({
      label: 'Pillars',
      slugField: 'title',
      path: 'src/content/pillars/*',
      format: { contentField: 'content' },
      columns: ['title', 'order'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        order: fields.integer({ label: 'Order', defaultValue: 1 }),
        blurb: fields.text({ label: 'Blurb', multiline: true }),
        cover: fields.image({
          label: 'Cover image',
          directory: 'public/images/pillars',
          publicPath: '/images/pillars/',
        }),
        content: fields.markdoc({ label: 'Content' }),
      },
    }),
  },
});
