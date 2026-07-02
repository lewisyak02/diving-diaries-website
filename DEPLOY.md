# Diving Diaries — Website deploy guide

The site is built with **Astro + Tailwind + Keystatic (CMS)** and targets **Netlify**.
Everything runs and builds locally. This guide covers going live on `divingdiaries.au`.

## Run it locally

```bash
cd Website
npm install          # first time only
npm run dev          # http://localhost:4321   (CMS at /keystatic)
npm run build        # production build into dist/
```

Node is managed by nvm (`nvm use --lts`). Node 24 LTS is installed.

---

## 1. Push to GitHub

The repo is already `git init`-ed in `Website/`. Create an empty GitHub repo, then:

```bash
cd Website
git add -A
git commit -m "Initial Diving Diaries website"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo>.git
git push -u origin main
```

## 2. Connect Netlify

1. Netlify → **Add new site → Import an existing project → GitHub** → pick the repo.
2. Build command: `npm run build`  ·  Publish directory: `dist`  (the Netlify
   Astro adapter is already configured — Netlify auto-detects these).
3. Deploy. You'll get a `random-name.netlify.app` URL to preview.

`.npmrc` sets `legacy-peer-deps=true` so Netlify's `npm install` resolves the same
way it does locally (Keystatic hasn't bumped its Astro 7 peer range yet).

## 3. Connect the domain `divingdiaries.au` (registered at Squarespace)

In Netlify → **Domain management → Add a domain** → `divingdiaries.au`. Netlify shows
the exact records. Two options:

- **Recommended (keep DNS at Squarespace):** in Squarespace DNS settings add the
  records Netlify gives you — an **A record** for the apex `@` pointing at Netlify's
  load balancer IP, and a **CNAME** for `www` pointing to your `*.netlify.app` host.
- **Simplest:** switch the domain's **nameservers** to Netlify DNS (Netlify lists 4
  nameservers; set them in Squarespace). Netlify then manages apex + www itself.

HTTPS is provisioned automatically by Netlify once DNS verifies (can take up to a
few hours). Confirm both `https://divingdiaries.au` and `https://www.divingdiaries.au`
load and redirect to one canonical host.

## 4. Turn on in-browser editing (Keystatic GitHub mode)

Right now `keystatic.config.ts` uses `storage: { kind: 'local' }` (edit only when
running `npm run dev`). To edit the **live** site in the browser:

1. Change storage in `keystatic.config.ts` to:
   ```ts
   storage: { kind: 'github', repo: '<your-username>/<repo>' }
   ```
2. Install the **Keystatic GitHub app** (Keystatic walks you through it on first
   visit to `/keystatic` on the deployed site) and add the two env vars it gives you
   (`KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, plus
   `KEYSTATIC_SECRET`) in **Netlify → Site settings → Environment variables**.
3. Then visiting `divingdiaries.au/keystatic`, logging in with GitHub, and saving an
   edit commits to the repo → Netlify rebuilds automatically.

## 5. SEO go-live

- Add the site to **Google Search Console** (verify via DNS TXT or the Netlify
  method) and submit `https://divingdiaries.au/sitemap-index.xml`.
- Validate the structured data with Google's **Rich Results Test**.
- Run a **Lighthouse** pass (aim 90+ SEO / Performance).

---

## Before launch — confirm these placeholders

Edit in `src/lib/site.ts` (or via the CMS **Site settings** for the socials):

- **Founder name** — currently `'Lewis'`; set your full name for the Person schema
  (this is what helps Google describe *you*).
- **Social URLs** — currently defaulted to `@DivingDiaries`; confirm the exact
  YouTube / Instagram / TikTok URLs. These feed the `sameAs` in the structured data.
- **Contact email** — currently `lewisyak02@gmail.com`.

## Contact form

The `/contact` page uses **Netlify Forms** (auto-detected at deploy). Submissions
appear in **Netlify → Forms**; set up email notifications there.

## Adding a shop later (Horizon 3)

The structure leaves room for a `/shop` route — drop in Shopify Buy Buttons or
Snipcart with no re-architecture. First product is likely the preset/LUT bundle.
