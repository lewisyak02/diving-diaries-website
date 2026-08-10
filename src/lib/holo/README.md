# Sticker viewer

Live WebGL viewer for the Diving Diaries stickers. Built to `STICKER_VIEWER_BRIEF.md`
(in the HQ `Stickers/` folder).

Nothing here draws artwork. The renderer loads your files by path and shades them. If a
texture is missing the component falls back to the poster image rather than inventing
anything.

## How the holographic effect works

The artwork is two flat colours: white `#F0F0F0` and periwinkle `#6060D8`. Printed on
holographic vinyl, the white regions are *unprinted*, so the rainbow substrate shows
through them. The periwinkle regions are ink over that substrate and stay purple.

So the foil mask is never authored by hand. It comes from the artwork's own luminance:

```
mask = clamp((luminance - 0.55) / (0.92 - 0.55), 0, 1)   // then a 0.8px gaussian
```

and composites as a **replacement**, not a screen blend, because screen blending a
rainbow onto white just gives you white:

```
out = base*(1 - mask*0.93) + holo*(mask*0.93)   // foil replaces unprinted white
out = 1 - (1 - out)*(1 - holo*0.16)             // faint sheen over printed ink
```

That means any future sticker designed the same way works with zero per product setup.
Draw it in white and periwinkle, point the viewer at it, done.

## Files

| File | What it is |
|---|---|
| `shaders.ts` | The GLSL. Vertex does the perspective and the bow, fragment does the mask, the spectral sweep, the die cut and the rim. |
| `viewer.ts` | WebGL setup, pointer/keyboard input, the spring, the render loop. Returns `null` if WebGL is unavailable. |
| `../../components/HoloSticker.astro` | The component. Poster first, canvas swapped in when ready, CSS 3D fallback if WebGL fails. |

## Props

All on `<HoloSticker />`.

| Prop | Default | What it does |
|---|---|---|
| `src` | required | Texture the renderer draws. For the holo circle this is the seamless tile. |
| `alt` | required | Describes the sticker. Becomes the canvas `aria-label`. Not "3D viewer". |
| `poster` | `src` | Static image shown until the canvas is live, and the last resort fallback. |
| `material` | `'matte'` | `'holo'` foil shader, `'decal'` clear transfer vinyl, `'matte'` plain flat shading. |
| `dropShadow` | `false` | Decal only. Shows the drop shadow finish instead of plain white. |
| `dieCut` | `'none'` | `'circle'` cuts a disc with a thin unprinted rim. `'none'` is full bleed. |
| `intensity` | `0.9` | Foil strength. |
| `hueScale` | `1` | Per product hue tuning. Higher packs more colour bands across the sticker. |
| `tileScale` | `1.15` holo, `1` matte | Tile drawn at this multiple of the die diameter, then centre cropped. 1.15 gives roughly three badge rows across, matching the printed product. |
| `grain` | `0.05` holo, `0` matte | Fine noise over the foil so it is not a clean mathematical gradient. |
| `spin` | none | Path to a scrub sequence manifest. Used on low power devices instead of the shader. |

`viewer.ts` takes two more options the component does not expose, both for the
headless shot script: `interactive: false` (no listeners, no idle, no spring) and
`pixelSize` (a fixed backing store instead of a measured one), plus `fit` to
control how much of the frame the sticker fills.

## Switching between materials

One prop: `material`. It is a config change, not a fork.

- **`holo`** the full spectral foil path, for holographic vinyl.
- **`decal`** clear transfer vinyl: white ink on a clear carrier film, cut as a rounded
  rectangle around the logo. No foil, no rainbow. Running the holo shader here looks wrong.
- **`matte`** plain flat diffuse with a soft specular roll off. The fallback for artwork
  that is already a finished image rather than printable art.

A product's `material` field wins; with it unset, `holographic: true` means `holo` and
anything else means `matte`.

### How the decal path works

The artwork is the **white wordmark with alpha**, and its alpha channel is the printed ink,
exactly as in your `render_decal.py`. Everything else is derived, so a new decal needs no
per product numbers:

- the logo is cropped to its own ink bounds, so file padding cannot shift anything
- the print margin is 17% of the logo height
- the die cut is a rounded rectangle with a corner radius of 34% of the frame height
- the drop shadow finish offsets a dark plate by 5.5% of the logo height

Those four ratios live at the top of `viewer.ts`. Change them there and every decal follows.

## Adding a new sticker

1. Put the artwork in `public/stickers/`. Copy the file as is, do not recolour or trace it.
2. Add a product JSON in `src/content/products/`:

```json
{
  "name": "New Sticker",
  "image": "/stickers/new-sticker-poster.webp",
  "artwork": "/stickers/new-sticker.png",
  "dieCut": "circle",
  "altText": "One sentence describing what the sticker actually looks like.",
  "holographic": true,
  "order": 5
}
```

`artwork` is what the renderer draws; `image` is the static poster. If you only have one
image, set `image` and leave `artwork` out.

3. If the artwork is a seamless tile, keep `tileScale` at 1.15. If it is a single finished
   design that should be seen whole, pass `tileScale={1}` and `dieCut="none"`.

## Motion range

Two profiles, in `MOTION` at the top of `viewer.ts`:

| | Drag | Tilt | Idle | Bow |
|---|---|---|---|---|
| **Holographic** | ±60° | ±15° | ±8° | 0.055 |
| **Everything else** | ±28° | ±8° | ±4° | 0.032 |

The holographic sticker earns the wide swing: the foil shifts colour right through it, so the
movement is the whole point. Flat vinyl gets no such payoff and at the same angles just reads
as floppy, so it moves less and sits stiffer. Drag sensitivity follows the limit, so the
tighter range also feels tighter under the finger rather than just clamping sooner.

The scrub sequence picks the matching range automatically, so the low power fallback feels
like the live thing. `--spin-range` still overrides it.

## Accessibility and motion

- Pointer Events throughout, so mouse, touch and pen are one code path.
- `touch-action: pan-y` on the canvas, so a vertical swipe still scrolls the page.
- Keyboard focusable with a visible focus ring; arrow keys nudge 5 degrees.
- `prefers-reduced-motion` kills the idle drift and the spring back. Manual drag still works.

## Performance

- 4.8KB gzipped, no dependencies. No three.js: this is one textured quad and three.js
  would have been roughly 600KB for geometry we do not need.
- The GL context is not created until the card is within 200px of the viewport.
- The render loop stops when the canvas leaves the viewport and when the tab is hidden.
  At rest, with no idle drift left to run, it draws nothing at all.
- Device pixel ratio capped at 2.
- The aspect ratio is reserved in CSS, so there is no layout shift when the canvas swaps in.

## Fallbacks

WebGL missing, the texture failing to load, or a device with 2 cores or less, in order:

1. The pre rendered scrub sequence, if the product has one.
2. CSS 3D transform plus a layered gradient, driven by the same angle the shader uses.
3. The static poster image.

Never a blank box, and never a drawn placeholder.

## Product shots

`scripts/sticker-shots/shoot.mjs` renders the shots by driving *this* renderer in a
headless browser, so the shots and the live viewer cannot drift apart. There is no
second implementation of the shader anywhere.

```bash
npm i -D playwright --no-save && npx playwright install chromium   # first run only
node scripts/sticker-shots/shoot.mjs --spin
```

Playwright is deliberately not in `package.json`. It is only needed when the artwork
changes, and adding it would pull ~130MB of Chromium into every Netlify build. The
`--no-save` install leaves `package.json` untouched; re-run it after any `npm ci`.

| Flag | Effect |
|---|---|
| *(none)* | The five angles, cached if nothing changed |
| `--force` | Ignore the cache and redo everything |
| `--slug <name>` | Just one product |
| `--spin` | Also build the scrub sequence |
| `--spin-range <deg>` | Half width of the scrub sweep. Default 60, matching the drag limit. Pass 180 for a literal 360 spin. |

**Output** goes to `public/products/{slug}/` as `{slug}--{shot}@{width}.{ext}`.

- Angles: `flat` 0°, `hero` 10°, `angle-l` −35°, `angle-r` 35°, `edge` 62°.
- Each angle twice: transparent alpha, and `-dark` over the reference vignette.
- Rendered at 2400², written at 1200 / 600 / 300, as PNG, WebP and AVIF.
- A soft contact shadow at 110/255 opacity is built from the sticker's own alpha, so
  it follows the silhouette at every angle. Its own layer, no mount or support in frame.
- Re-runnable and idempotent: a fingerprint of the artwork plus every setting that
  affects output is kept in `.astro/sticker-shots/`, outside `public/`.

Products without an `artwork` field are skipped with a note rather than rendered from
a mockup. If a file named in `artwork` is missing, the script stops for that product
and says so; it never substitutes anything.

### Scrub sequence

`--spin` writes 36 frames as one 6×6 sprite sheet (`{slug}--spin-sheet.webp`, ~400KB)
plus `{slug}--spin.json`. Point a product's `spin` field at the JSON.

The frames sweep −60° to +60°, which is the viewer's own drag range, so scrubbing feels
like the live thing. The brief said "36 frames at 10° steps", which is literally 360°,
but the reference scrub rocks within the drag range and never shows the sticker's back.
Pass `--spin-range 180` if you did want the full rotation.
