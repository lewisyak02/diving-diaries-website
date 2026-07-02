// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import netlify from '@astrojs/netlify';
import keystatic from '@keystatic/astro';

// https://astro.build/config
export default defineConfig({
  site: 'https://divingdiaries.au',

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [markdoc(), react(), keystatic(), sitemap()],
  // imageCDN:false → optimise images with Astro's built-in Sharp pipeline at
  // build time, so they render identically in local dev and in production
  // (Netlify's Image CDN only works once deployed).
  adapter: netlify({ imageCDN: false })
});
