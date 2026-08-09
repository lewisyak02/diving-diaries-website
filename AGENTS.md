# Diving Diaries — Website

The Diving Diaries website. **Astro 7 + Tailwind v4 + Keystatic CMS**, deployed to
**Netlify**. Owner: Lewis Kay (a PADI Divemaster / underwater content creator).
(`CLAUDE.md` is a symlink to this file.)

## Toolchain (read first)

Node is installed via **nvm** and is NOT on the default PATH. Before any `node`/`npm`/
`npx`/`astro` command, load it:

```
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use --lts
```

- Build: `npm run build` (must stay green before handing off).
- Dev server: `astro dev --background` (manage with `astro dev status|logs|stop`).
- `sharp` and `ffmpeg-static` are installed for image/video processing (run scripts from
  inside `Website/` so they resolve).

## Deploy + edit loop

- **GitHub repo:** `lewisyak02/diving-diaries-website`. **Netlify** auto-deploys `main`.
- Netlify site name **divingdiaries** → live at `divingdiaries.netlify.app`. Custom domain
  `divingdiaries.au` is registered at Squarespace; **DNS not pointed yet** (A `@` →
  `75.2.60.5`, CNAME `www` → `divingdiaries.netlify.app`).
- **The loop:** Claude edits code → **Lewis pushes via GitHub Desktop (Push origin)** →
  Netlify rebuilds. Claude cannot push (no auth); always hand off with "push in GitHub Desktop".
- Commits use `-c user.name="Lewis Kay" -c user.email="lewisyak02@gmail.com"` and end with the
  Co-Authored-By line.

## Pages (`src/pages`)

`index` (video hero: hawksbill turtle loop), `about`, `watch` ("The Dive Log", all long-form
videos), `journal/` (index + `[slug]`, 40+ posts), `pillars/[slug]` (5 pillars), `community`,
`shop`, `contact`, `thank-you`. `/keystatic` is the CMS admin (noindex).

**Pillars:** diary-entries, dive-site-reviews, fish-id, gear, tips. Each pillar page shows its
tagged videos + journal posts. Long lists use `<ShowMore initial={15}>`.

## Content + CMS (`src/content`, `keystatic.config.ts`)

Collections/singletons: `journal` (.mdoc), `pillars` (.mdoc), `videos` (index.json; each item
has `pillar` + `short`), `community` (index.json stats), `encounters` (index.json homepage
strip), `site` (index.json settings), `products` (one .json per shop product).

- Keystatic storage: **github mode in production, local in dev** (`import.meta.env.PROD`).
- **CMS is wired but NOT activated** — live editing needs a one-time GitHub App connection +
  3 env vars on Netlify. Lewis deferred this; for now Claude edits files and Lewis pushes.
- Journal posts have `youtube` frontmatter → rendered as a "Watch on YouTube" button (says
  "review" for dive-site-reviews, else "dive").

## Brand + components

- **Colours:** ocean blue scale + **purple `#6e65dc`** accent (from the avatar). Tokens in
  `src/styles/global.css` (`@theme`).
- **Fonts:** Archivo (headings, `--font-display`) + Inter (body). Headings uppercase, tight.
- **Logos:** `src/assets/logo/` — long + short × white + dark, plus `badge-purple`. Header uses
  the long wordmark (scale-up on hover); footer uses the short mark. Favicon = purple badge.
- Components: `Header` (detached glass pill), `Footer`, `SEO` (Person + Organization JSON-LD with
  `sameAs`), `Button`, `Wordmark`, `PillarCard`, `PostCard`, `VideoGrid` (click-to-load facades;
  vertical for reels), `ShowMore`, `HoloSticker` (3D tilt + holographic shimmer on shop images).

## Skills + scheduled tasks (live in the HQ `.claude/`, not this repo)

- **refresh-encounters** — refresh homepage "Recent encounters" from `Content/Photos`.
- **sync-new-videos** — add new YouTube uploads (journal posts + Fish ID reels), refresh YouTube
  community stats. Scheduled monthly as `sync-new-dive-videos` (1st, 9:30am).
- **draft-journal-from-video** — turn one YouTube video into a journal draft.
- Scheduled tasks run only while the Claude app is open; both fire on the 1st.
- Note: YouTube blocks transcript scraping; posts are built from video **descriptions**.

## House style

**No em dashes and no hyphenated compounds in user-facing copy** (Lewis: "hyphens scream AI").

**Two voices, deliberately.** The **journal is first person, his voice** — that is the whole
point of it, so never convert journal posts to brand voice. The **brand pages** (About, the
homepage mission band) speak as Diving Diaries: "we/our", or the brand by name. Pillar blurbs
stay first person, since they describe the dives he does. Tagline "Sharing the beauty of the underwater world"; catchphrase
"Let's see what we can see". Socials: YouTube @LewisKayDives, Instagram + TikTok @divingdiaries.au,
a Facebook page. Contact email divingdiariesau@gmail.com. Shot on a DJI Osmo Action 5 Pro.

## Open items / TODO

- **Shop / Stripe:** 4 sticker products exist (Circle Holographic + Front Adhesive Small/Medium/
  Large) with **blank prices and no buy links** (show "Coming soon"). Lewis sets up **Stripe
  Payment Links** per product and pastes them into each product's `buyUrl` (finish options via
  a Stripe custom dropdown).
- **Sticker artwork:** 3 of 4 products now render from the **real artwork** through the live
  WebGL viewer (`src/lib/holo/`, see its README). Circle = holo foil from `dd-tile.png`;
  Small + Medium = decal material from `dd-wordmark-white.png`. **Front Adhesive Large is the
  only one still on an AI mockup** — its "Black background" design was never supplied. If that
  is just the same wordmark on a black plate, it is a config change, not new artwork.
  No more AI mockups: the renderer draws his files directly.
- **Activate the CMS** (GitHub App + env vars) when Lewis wants browser editing.
- **Point the domain** `divingdiaries.au` at Netlify.
- **Instagram/TikTok live stats:** not feasible without their official APIs; maintained by hand in
  the community CMS (YouTube auto-updates via the monthly sync).
- Unpushed commits may be waiting — remind Lewis to Push origin.

## Docs

Astro docs: https://docs.astro.build — routing, content collections, components, Tailwind.
