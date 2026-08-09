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
| `material` | `'matte'` | `'holo'` for the foil shader, `'matte'` for flat diffuse vinyl. |
| `dieCut` | `'none'` | `'circle'` cuts a disc with a thin unprinted rim. `'none'` is full bleed. |
| `intensity` | `0.9` | Foil strength. |
| `hueScale` | `1` | Per product hue tuning. Higher packs more colour bands across the sticker. |
| `tileScale` | `1.15` holo, `1` matte | Tile drawn at this multiple of the die diameter, then centre cropped. 1.15 gives roughly three badge rows across, matching the printed product. |
| `grain` | `0.05` holo, `0` matte | Fine noise over the foil so it is not a clean mathematical gradient. |

## Switching holographic to matte

One prop: `material="matte"`. It is a config change, not a fork. The matte path skips the
foil entirely and uses flat diffuse shading with a soft specular roll off, which is what
transfer decals actually look like. Running the holo shader on a matte decal looks wrong.

In the CMS, `holographic: true` on a product sets `material="holo"`.

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

WebGL missing or the texture fails to load, in order:

1. CSS 3D transform plus a layered gradient, driven by the same angle the shader uses.
2. The static poster image.

Never a blank box, and never a drawn placeholder.
