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
  `divingdiaries.au` (registered at Squarespace) **is pointed and serving** as of Aug 2026.
  Both addresses currently return 200; the netlify.app one does **not** redirect to the
  custom domain, so anything pointed at either keeps working. Prefer the `.au` address in
  anything given to an outside service (Stripe's webhook, for one), because a redirect would
  be read as a failed delivery if that ever changes.
- **The loop:** Claude edits code → **Lewis pushes via GitHub Desktop (Push origin)** →
  Netlify rebuilds. Claude cannot push (no auth); always hand off with "push in GitHub Desktop".
- **⚠️ DEPLOYS ARE THE SCARCE RESOURCE. BATCH THEM.** Netlify free plan gives **300 credits a
  month** and a production deploy costs **15 credits**, so there are only **~20 deploys per
  month**. Measured Aug 2026: 19 deploys ate 285 of 301 credits used. Everything else was
  rounding (12,081 web requests = 2.4 credits, compute = 1, bandwidth = 12.9).
  **Do not tell Lewis to push after every change.** Batch a session's work into one push. A
  previous session burned the whole month on 19 deploys of small edits.
  Credits reset monthly (cycle ran Aug 2 → Sep 2, 2026). When exhausted, the **published site
  stays up** on separate "operational credits" but **no new deploys are possible until reset**,
  so work can still be committed and pushed to GitHub, it just will not go live.
- Commits use `-c user.name="Lewis Kay" -c user.email="lewisyak02@gmail.com"` and end with the
  Co-Authored-By line.

## Pages (`src/pages`)

`index` (video hero: hawksbill turtle loop), `about`, `watch` ("The Dive Log", all long-form
videos), `journal/` (index + `[slug]`, 40+ posts), `pillars/[slug]` (5 pillars), `community`,
`shop`, `contact`, `thank-you`, `order-confirmed` (Stripe success), `policies` (shipping,
returns, terms). `/keystatic` is the CMS admin (noindex).

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
  of 2** (`minOrder`, mix the finishes freely). Sticker Pack is **$15 for any 5**, shown against
  a struck through `compareAt` of $25. Shipping is a flat **$1.50 Australia wide**, stated once
  under the grid. The pack price only works because everything in it is $5: the small adhesive
  was removed from `pack.from` for exactly that reason, so **do not add a differently priced
  sticker to the pack** without rethinking the flat price.
- **`comingSoon: true`** shows a product with its price and artwork but no add to cart, labelled
  "Not printed yet" and "Coming soon". Distinct from `soldOut` and `stock: 0`, which mean it ran
  out rather than never existing. Checkout refuses it server side too. Zebra Shark is the only
  one right now, and is deliberately **left out of `pack.from`** until it exists.
- **Stock counter (built Aug 2026, `src/lib/stock.ts`).** The live count lives in **Netlify
  Blobs**, outside git, so an order never triggers a rebuild. Everything is counted by
  **variant, not product**: a variant is one physical sticker in the drawer, keyed the same way
  as a cart line (`fiddler-ray`, `front-adhesive-medium`, `front-adhesive-medium:ds`). White and
  drop shadow are separate sheets with separate counts, which is why the schema has both `stock`
  and `stockDropShadow`.
  - **The JSON numbers are only the seed.** A variant missing from the blob starts on its
    `stock` / `stockDropShadow` number, and from then on the blob wins. Editing the JSON after
    that changes nothing live, so **restock from `/stock`**, never by editing a product file.
    Seeding by key is also what makes a **newly added sticker start counting on its own**, pack
    range included.
  - **`/stock` is the counter**, password `STOCK_TOKEN`, noindex and out of the sitemap, not
    linked from anywhere. It reads and writes through `/api/stock`. Editing there costs **no
    deploy**, which is the whole point: a hand edit to a product file costs 15 credits, 5% of
    the month.
  - **`/api/stripe-webhook` does the decrementing**, on `checkout.session.completed` and
    `checkout.session.async_payment_succeeded`. Checkout writes a machine readable tally into
    the session metadata as `stock` (`"fiddler-ray=3,front-adhesive-medium:ds=1"`), so the
    webhook never has to work out what was in a pack. Orders are claimed by session id before
    being counted, so a Stripe retry cannot take stock twice, and counts clamp at 0 rather than
    going negative. **A refund does not put stock back** (it has usually been posted already).
  - **A pack draws down the same drawer as the singles**, and the two are added together before
    anything is checked: 3 loose fiddler rays plus 2 inside a pack is 5 fiddler rays, and the
    order is refused if that is more than there is. This is one combined check at the end of
    `/api/checkout`, not per line.
  - **The shop cards are a snapshot from the last build, not the live count.** That is Lewis's
    option 1 (validate at checkout only): no live count on the cards, no extra requests, and the
    server still refuses an order it cannot fill. `0` renders "Out of stock" and, for a two
    finish product, only that finish's button; `1..5` renders "Only N left"; the finish buttons
    rewrite both, since each finish has its own number. **Leave both unset to not count a
    product at all** (Zebra Shark is the only one, and is `comingSoon` anyway).
  - Blobs is a Netlify thing, but `astro dev` runs Netlify's local emulator, so the counter,
    `/stock` and the webhook **do all work locally** and persist in `.netlify/`.
  - **Counter went live 2 Sep 2026.** The build that shipped carried the 1 Sep seeds (727
    total). Seven stickers sold between counting the drawer and that deploy (1 Circle
    Holographic, 2 Hawksbill, 2 Starfish, 1 Grey Nurse, 1 Medium drop shadow) and were
    corrected **on `/stock`**, not in the files, because by then the deploy had happened.
    The file numbers were brought into line as history and now read: Circle Holographic 11,
    Medium 50 white / 41 drop shadow, Small 214 white / 225 drop shadow, Hawksbill 47,
    Fiddler Ray 39, Starfish 46, Grey Nurse 47, **720 total**. They will not be read again
    unless the blob is wiped. **From here, every stock change happens on `/stock`.**
- **Shopify was considered and rejected (Aug 2026).** Full Shopify would mean rebuilding the
  homepage, About, Watch, 42 journal posts and the pillars inside a shop platform, and losing
  the WebGL sticker viewer and the mix and match pack picker, for ~A$45-50/month. At $5 stickers
  that is 10-15 sales a month just to break even on the platform. Stripe already gives sales and
  units sold; **inventory was the only real gap**, and the webhook above closes it for free.
  Revisit only if the range grows well beyond stickers.
- **Checkout is a real cart, not Payment Links.** `buyUrl` is no longer used. The flow is:
  `src/lib/cart.ts` (localStorage, slugs and quantities only) → `CartDrawer.astro` (slide over,
  lives on the header but **moves itself to `document.body` on init**, because the nav's
  `backdrop-filter` would otherwise trap a `position: fixed` child) → `POST /api/checkout`
  (`src/pages/api/checkout.ts`, `prerender = false`) → Stripe Checkout → `/order-confirmed`.
  - **The server never trusts the cart.** Price, stock, `minOrder` and pack contents are all
    re-read from the content collection and re-validated, so a tampered cart cannot buy a $5
    sticker for a cent. Shipping ($1.50, AU only) is added server side.
  - Pack contents ride along in session `metadata` so an order can be packed.
  - **`stripePriceId` / `stripePriceIdDropShadow`** on a product make checkout charge
    Stripe's own price, so the sale lands against the real catalogue product and the
    dashboard can report units sold. Either a `price_...` or a `prod_...` id works: a
    product id is resolved to its default price, because the dashboard shows the product
    id far more prominently and that is what gets copied. Unset falls back to an inline price, which charges
    correctly but spawns a one off product per order and ruins the reporting. When an ID is
    used the price is fetched and **checked against the site price before charging**: a
    mismatch or an inactive price refuses the checkout rather than surprising the customer.
    Price IDs are not secrets.
  - Any markup injected by script (the cart lines) must be styled with `:global()`, since
    dynamically created nodes never get Astro's scope attribute.
  - The **cart pill is its own glass pill beside the nav bar** and is hidden entirely until
    the cart has something in it. Open and close use a forced reflow and a `transitionend`
    with a timeout fallback, never `requestAnimationFrame`, which never fires in a
    backgrounded tab and left the drawer stuck half open.
  - **Three secrets, all in `.env.example`.** `STRIPE_SECRET_KEY` (checkout),
    `STRIPE_WEBHOOK_SECRET` (the stock webhook) and `STOCK_TOKEN` (the `/stock` password). Copy
    `.env.example` to `.env` for local work and set the same three in Netlify. Without the
    Stripe key the endpoint returns a clean 503 and the shop still browses; without the other
    two the counter simply does not decrement and `/stock` is switched off.
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
- **Marine life art:** sources live in `Stickers/Marine Life/Stickers/`. The site needs a
  **clean cutout with real transparency**; the white cut line is generated by `addContourCut()`
  in `viewer.ts` (`dieCut: "contour"`), so new art only needs the animal on transparency with a
  little margin. **Always check the alpha channel before using a file**: some exports have the
  transparency checkerboard **baked in as opaque grey pixels** (the older `[Name] 1.png` batch
  did). Do not judge by filename, `zebra shark1.png` is a perfectly good transparent file.
  Sample a corner pixel: alpha 0 is real transparency, alpha 255 is a baked background.
- **Zebra Shark (Aug 2026):** $5, `comingSoon: true`, **not in `pack.from`** until printed.
  Description is **first person** ("the only one I liked enough to get tattooed"), which is a
  deliberate exception: every other product description is neutral and observational. He has it
  tattooed, and that detail only works as "I". Flag it if rewriting the shop voice.
  Artwork is **Lewis's own illustrated version** matching the other four, wordmark on the
  pectoral fin. An earlier attempt cut the animal out of his dive footage and was discarded.
- **If a photo ever does become a sticker**, the working recipe from that attempt: flood fill
  the white backdrop inward **from the border by connectivity** (thresholding on whiteness alone
  punches holes in pale bellies), erode one pixel to kill the halo, then colour correct in two
  stages. **Do not grey world the average**: underwater crushes red so hard that scaling the
  mean to neutral multiplies red by ~2.5 and goes pink. Instead white balance off the subject's
  **highlights**, then bend the **midtones** with a per channel gamma, because water absorbs red
  progressively and one multiplier cannot fix both ends of the curve.
- **Bordered marine PNGs** live beside the cutouts in `Stickers/Marine Life/Stickers/` (HQ, not
  the repo), as `<name>-bordered.png`, generated the same way the site draws the cut line.
  The border is **1.6% of the artwork's long edge**, which is the average the first four landed
  on. Size it off the long edge, not the short one: the zebra shark is far more elongated than
  the rest and the short edge gave him half the border weight of the set.
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
- **Returns policy:** no returns for change of mind, genuine damage handled case by case,
  **15 days** to report it. On `/policies`, linked from the footer. Lewis is **not** on the
  Gold Coast and does not post from there: he dives there, which is why the journal and About
  mention it. Do not put a location in shop or order copy without asking.
- **Activate the CMS** (GitHub App + env vars) when Lewis wants browser editing.
- **Instagram/TikTok live stats:** not feasible without their official APIs; maintained by hand in
  the community CMS (YouTube auto-updates via the monthly sync).
- **Stripe linking status (Aug 2026):** every product carries a `prod_` id **except the Sticker
  Pack**. Each Stripe product must have a **default price matching the site**, or that item's
  checkout refuses rather than charging a wrong amount.
- **Stripe receipts are off by default.** Settings → Customer emails → "Successful payments",
  **per mode**, so test and live are separate. Test mode heavily restricts outbound email, so a
  missing test receipt usually means nothing is wrong. Also worth setting: public business
  details (receipts use them) and personal notifications for successful payments, otherwise no
  alert arrives when an order needs posting. Statement descriptor is `DIVINGDIARIES`.
- Unpushed commits may be waiting — remind Lewis to Push origin, but **batch them** (see the
  deploy credit warning at the top).

## Docs

Astro docs: https://docs.astro.build — routing, content collections, components, Tailwind.
