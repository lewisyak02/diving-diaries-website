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

- **Prices (Aug 2026):** every sticker $5, Front Adhesive Small $2.50 with a **minimum order
  of 3** (`minOrder`, mix the finishes freely). Sticker Pack is **$15 for any 5**, shown against
  a struck through `compareAt` of $25. Shipping is a flat **$1.50 Australia wide**, stated once
  under the grid. The pack price only works because everything in it is $5: the small adhesive
  was removed from `pack.from` for exactly that reason, so **do not add a differently priced
  sticker to the pack** without rethinking the flat price.
- **Stock:** `stock` on a product is a **manual count**, in whole units. `0` shows "Out of
  stock", disables the buy button, and greys that sticker out in the pack picker (which also
  caps how many of one design can go into a pack, and says "Not enough in stock" if the range
  cannot fill one). `1..5` shows "Only N left". **Leave it unset to not track that product.**
  Stripe cannot decrement it, so it has to be updated by hand after packing orders. Animals are
  currently `0`; the rest are untracked until Lewis counts them.
- **Stripe still to do:** Payment Links per product pasted into `buyUrl`. Set the small
  adhesive link to adjustable quantity with a **minimum of 3**, since the site only states that
  rule and cannot enforce it. The on-card finish buttons are a preview only; the pack passes
  its selection as `client_reference_id`.
- **Marine life artwork is AI generated**, not drawn by Lewis and not by a commissioned
  artist. He may collaborate with a real artist later. **Never write copy claiming these are
  hand drawn, illustrated, or his own art**, and do not imply a specific animal he met.
- **Sticker artwork:** every product renders from the **real artwork** through the live WebGL
  viewer (`src/lib/holo/`, see its README). Circle = holo foil from `dd-tile.png`; Small +
  Medium = decal material from `dd-wordmark-white.png`, switchable White / Drop shadow; marine
  life = `matte` material on finished die cut art that carries its own cut line in its alpha.
  The **Sticker Pack has no image**: its card is a mix and match picker (`StickerPicker.astro`)
  where you choose 5 from the range, doubles allowed. The buy button stays locked until the
  count is exact, then appends the choice to the Stripe link as `client_reference_id`
  (e.g. `fiddler-rayx3_grey-nurse-sharkx1_hawksbill-turtlex1`), which shows on the payment in
  the Stripe dashboard so the order can be packed. `scripts/sticker-shots/build-pack.mjs` can
  still regenerate a pack photo if one is ever wanted.
  No AI mockups anywhere: the renderer draws his files directly. Front Adhesive Large was
  removed (Aug 2026) because he did not like it.
- **Product shots do not ship.** `shoot.mjs` writes the five angle shots to `product-shots/`
  (gitignored, outside `public/`) because the site never serves them; only `--poster.webp`,
  `--spin-sheet.webp` and `--spin.json` go to `public/products/`. That took the deployed
  folder from 31MB to 2.3MB. The script also **prunes** anything in those folders it did not
  write, so superseded renders cannot pile up. PNG is skipped above 600px (`PNG_MAX_WIDTH`).
- **Marine life art:** source is `Stickers/Marine Life/Stickers/[Name].png` (clean cutout,
  real transparency). The `[Name] 1.png` files have the **transparency checkerboard baked in
  as opaque pixels** and cannot be used. The white cut line is generated by
  `addContourCut()` in `viewer.ts` (`dieCut: "contour"`), so new animal art only needs a clean
  cutout with some transparent margin around it.
- **Bordered marine PNGs** for listings live in `Stickers/Marine Life/Bordered/` (HQ, not the
  repo), generated the same way the site draws the cut line.
- **Pack entries are variants, not products.** `pack.from` is a list of
  `{ product, dropShadow }`, so a logo in white and the same logo with a drop shadow are two
  separate choices with their own key, label and thumbnail (9 options in total). `shoot.mjs`
  renders one poster per finish a product sells: `--poster.webp` and `--poster-drop-shadow.webp`.
  Labels come from `packLabel` plus the finish name, because several thumbnails are the same
  logo and cannot be told apart by picture alone.
- **Motion range is per material** (`MOTION` in `viewer.ts`): holographic swings ±60°, every
  other sticker ±28° with a shallower bow, because only the foil pays off a big swing. The
  scrub sheets follow whatever the live viewer allows.
- **Card backdrop** is a deliberate mid tone (`.sticker-backdrop`): white ink vanishes on a
  light background and the drop shadow vanishes on a dark one. Do not "tidy" it back to
  `bg-ocean-900`.
- **Activate the CMS** (GitHub App + env vars) when Lewis wants browser editing.
- **Point the domain** `divingdiaries.au` at Netlify.
- **Instagram/TikTok live stats:** not feasible without their official APIs; maintained by hand in
  the community CMS (YouTube auto-updates via the monthly sync).
- Unpushed commits may be waiting — remind Lewis to Push origin.

## Docs

Astro docs: https://docs.astro.build — routing, content collections, components, Tailwind.
