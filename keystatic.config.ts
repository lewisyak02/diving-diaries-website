import { config, fields, collection, singleton } from '@keystatic/core';

// Diving Diaries content model.
// storage.kind is 'local' for now (edit at /keystatic when running locally).
// At deploy time this switches to { kind: 'github', repo: 'owner/repo' }
// so Lewis can log in and edit in the browser on the live site.
export default config({
  storage: {
    kind: 'local',
  },

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
            { label: 'Trips', value: 'trips' },
            { label: 'Marine Life', value: 'marine-life' },
            { label: 'Fish ID', value: 'fish-id' },
            { label: 'Gear', value: 'gear' },
            { label: 'Tips', value: 'tips' },
          ],
          defaultValue: 'trips',
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
