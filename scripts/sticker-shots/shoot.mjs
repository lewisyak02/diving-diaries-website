#!/usr/bin/env node
/**
 * Deliverable B: product shots.
 *
 * Drives the site's own WebGL renderer headlessly, so the artwork in the shots
 * is guaranteed to be the same artwork the shop renders. Nothing here draws.
 *
 *   node scripts/sticker-shots/shoot.mjs
 *   node scripts/sticker-shots/shoot.mjs --force      # ignore the cache
 *   node scripts/sticker-shots/shoot.mjs --slug circle-holographic
 *   node scripts/sticker-shots/shoot.mjs --spin       # also the scrub sequence
 *   node scripts/sticker-shots/shoot.mjs --spin --spin-range 180   # full 360
 *
 * Playwright is fetched with npx rather than added to package.json, to keep
 * ~130MB of Chromium out of every Netlify build. First run needs a network.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PRODUCTS = path.join(ROOT, 'src/content/products');
const PUBLIC = path.join(ROOT, 'public');
// The site only serves the poster and the scrub sheet. The five angle shots
// are for listings and socials, so they live outside public/ and never ship.
const SITE_ROOT = path.join(PUBLIC, 'products');
const SHOTS_ROOT = path.join(ROOT, 'product-shots');

const SOURCE_PX = 2400;
// A little smaller than on the shop, to leave the contact shadow somewhere to go.
const SHOT_FIT = 0.8;
const WIDTHS = [1200, 600, 300];
const FORMATS = ['png', 'webp', 'avif'];
// PNG above this width is skipped. At 1200 the PNGs were 52MB across the shop
// for images WebP renders identically at a tenth the size, and every one of
// them was being deployed. Raise to 1200 if a printer ever demands PNG.
const PNG_MAX_WIDTH = 600;

// Angles from the brief.
const SHOTS = [
  { name: 'flat', yaw: 0 },
  { name: 'hero', yaw: 10 },
  { name: 'angle-l', yaw: -35 },
  { name: 'angle-r', yaw: 35 },
  { name: 'edge', yaw: 62 },
];

// Sampled from the reference render's background: a very dark, barely there
// radial. Centre rgb(11,11,14), corners rgb(8,8,10).
const VIGNETTE_CENTRE = { r: 11, g: 11, b: 14 };
const VIGNETTE_EDGE = { r: 8, g: 8, b: 10 };

// Contact shadow, per the brief.
const SHADOW_ALPHA = 110 / 255;
const SHADOW_BLUR_AT_2400 = 26 * (SOURCE_PX / 1200); // 26px is quoted at 1200

// Deliverable C: a scrub sequence for devices that should not run the shader.
// 36 frames, as one sprite sheet so it is a single request.
const SPIN_FRAMES = 36;
const SPIN_COLS = 6;
const SPIN_FRAME_PX = 240;

const args = process.argv.slice(2);
const force = args.includes('--force');
const onlySlug = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;
const doSpin = args.includes('--spin');
// The frames span -range..+range. Default matches the viewer's own drag limit,
// so a scrub feels like the live thing. Pass 180 for a literal 360 spin.
// Unset means "match whatever the live viewer allows for this material".
const spinRangeArg = args.includes('--spin-range')
  ? Number(args[args.indexOf('--spin-range') + 1])
  : null;

const log = (...a) => console.log(...a);

async function readProducts() {
  const files = (await fs.readdir(PRODUCTS)).filter((f) => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    const data = JSON.parse(await fs.readFile(path.join(PRODUCTS, f), 'utf8'));
    out.push({ slug: f.replace(/\.json$/, ''), ...data });
  }
  return out.sort((a, b) => (a.order ?? 1) - (b.order ?? 1));
}

/** Bundle the entry + the real viewer into one file the harness page can load. */
async function buildHarness() {
  const bundle = await esbuild.build({
    entryPoints: [path.join(HERE, 'entry.ts')],
    bundle: true,
    format: 'iife',
    target: 'chrome110',
    write: false,
  });
  const js = bundle.outputFiles[0].text;
  const html = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:transparent}canvas{display:block}</style>
<canvas id="stage"></canvas>
<script>${js}</script>`;
  const file = path.join(HERE, '.harness.html');
  await fs.writeFile(file, html);
  return file;
}

/** Dark radial vignette matching the reference render. */
function vignette(size) {
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="v" cx="50%" cy="50%" r="72%">
      <stop offset="0%" stop-color="rgb(${VIGNETTE_CENTRE.r},${VIGNETTE_CENTRE.g},${VIGNETTE_CENTRE.b})"/>
      <stop offset="100%" stop-color="rgb(${VIGNETTE_EDGE.r},${VIGNETTE_EDGE.g},${VIGNETTE_EDGE.b})"/>
    </radialGradient></defs>
    <rect width="${size}" height="${size}" fill="url(#v)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Soft contact shadow built from the sticker's own alpha, as its own layer.
 * No mount, no support, nothing else in frame.
 */
async function contactShadow(stickerPng, size) {
  // The silhouette is the sticker's own alpha, so the shadow always matches
  // the shape at this angle.
  const mask = await sharp(stickerPng).ensureAlpha().extractChannel('alpha').png().toBuffer();

  // Find where the sticker actually bottoms out, so the shadow sits on that
  // contact line at any angle rather than a guessed offset.
  const { data, info } = await sharp(mask).raw().toBuffer({ resolveWithObject: true });
  let contactY = size - 1;
  outer: for (let y = info.height - 1; y >= 0; y--) {
    for (let x = 0; x < info.width; x++) {
      if (data[y * info.width + x] > 8) { contactY = y; break outer; }
    }
  }

  const band = Math.round(size * 0.13);
  const squashed = await sharp(mask)
    .resize(size, band, { fit: 'fill' })
    .blur(SHADOW_BLUR_AT_2400)
    .png()
    .toBuffer();

  // Tuck the top of the band just under the contact line so the shadow reads
  // as touching the surface rather than floating.
  const top = Math.min(size - band, Math.max(0, Math.round(contactY - band * 0.34)));

  // Lay it into a full frame on black, then read the intensity back out.
  const placed = await sharp({
    create: { width: size, height: size, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([{ input: squashed, top, left: 0 }])
    .png()
    .toBuffer();

  const intensity = await sharp(placed)
    .extractChannel('red')
    .linear(SHADOW_ALPHA, 0)
    .png()
    .toBuffer();

  // Black, with that intensity as its alpha. Its own layer, nothing else in frame.
  return sharp({
    create: { width: size, height: size, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .joinChannel(intensity)
    .png()
    .toBuffer();
}

/** Delete anything in a folder that this run did not write. */
async function prune(dir, keep, label) {
  let removed = 0;
  for (const f of await fs.readdir(dir).catch(() => [])) {
    if (keep.has(f)) continue;
    await fs.rm(path.join(dir, f), { force: true });
    removed++;
  }
  if (removed) log(`  pruned    ${removed} stale file(s) from ${label}`);
}

async function writeVariants(buf, dir, slug, shot, summary, written) {
  for (const width of WIDTHS) {
    const resized = sharp(buf).resize(width, width, { fit: 'inside' });
    for (const fmt of FORMATS) {
      if (fmt === 'png' && width > PNG_MAX_WIDTH) continue;
      const file = path.join(dir, `${slug}--${shot}@${width}.${fmt}`);
      let pipe = resized.clone();
      if (fmt === 'png') pipe = pipe.png({ compressionLevel: 9 });
      if (fmt === 'webp') pipe = pipe.webp({ quality: 88, alphaQuality: 92 });
      if (fmt === 'avif') pipe = pipe.avif({ quality: 58 });
      const info = await pipe.toFile(file);
      written.add(path.basename(file));
      summary.push({ file: path.basename(file), width, kb: Math.round(info.size / 1024) });
    }
  }
}

async function main() {
  const products = await readProducts();
  const targets = products.filter(
    (p) => p.artwork && (!onlySlug || p.slug === onlySlug)
  );
  const skipped = products.filter((p) => !p.artwork && (!onlySlug || p.slug === onlySlug));

  for (const p of skipped) {
    log(`skip  ${p.slug}: no "artwork" set, only a mockup image. Supply the real`);
    log(`      die cut art and add "artwork" to its JSON to include it here.`);
  }
  if (!targets.length) {
    log('\nNothing to render.');
    return;
  }

  const harness = await buildHarness();
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=default', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
  page.on('console', (m) => { if (m.type() === 'error') log('  browser error:', m.text()); });
  await page.goto(pathToFileURL(harness).href);

  const summary = [];
  let rendered = 0;
  let cached = 0;

  for (const p of targets) {
    const artworkPath = path.join(PUBLIC, p.artwork.replace(/^\//, ''));
    try {
      await fs.access(artworkPath);
    } catch {
      log(`\nSTOP  ${p.slug}: artwork missing at ${p.artwork}`);
      log(`      Nothing was rendered for it. Put the file in place and re-run.`);
      continue;
    }

    const shotDir = path.join(SHOTS_ROOT, p.slug);
    const siteDir = path.join(SITE_ROOT, p.slug);
    await fs.mkdir(shotDir, { recursive: true });
    await fs.mkdir(siteDir, { recursive: true });
    const wroteShots = new Set();
    const wroteSite = new Set();

    // Idempotence: a fingerprint of the artwork plus every setting that
    // affects the output. Unchanged inputs mean the shots are already correct.
    const art = await fs.readFile(artworkPath);
    const stamp = createHash('sha256')
      .update(art)
      .update(JSON.stringify({
        v: 7, SHOTS, WIDTHS, FORMATS, SOURCE_PX, SHOT_FIT,
        holographic: !!p.holographic, dieCut: p.dieCut ?? 'none',
        material: p.material ?? null, dropShadow: !!p.dropShadow,
        finishes: p.finishes ?? null,
        VIGNETTE_CENTRE, VIGNETTE_EDGE, SHADOW_ALPHA,
        doSpin, spinRangeArg, SPIN_FRAMES, SPIN_COLS, SPIN_FRAME_PX,
      }))
      .digest('hex')
      .slice(0, 16);
    // Kept out of public/, so build metadata is never deployed.
    const stampDir = path.join(ROOT, '.astro/sticker-shots');
    await fs.mkdir(stampDir, { recursive: true });
    const stampFile = path.join(stampDir, `${p.slug}.stamp`);
    if (!force) {
      const prev = await fs.readFile(stampFile, 'utf8').catch(() => null);
      if (prev === stamp) {
        log(`\ncache ${p.slug}: inputs unchanged, shots left alone (--force to redo)`);
        cached++;
        continue;
      }
    }

    log(`\n${p.slug}`);
    // Inline the artwork so the canvas is never tainted and toDataURL can read
    // real pixels back out.
    const ext = path.extname(artworkPath).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'jpeg' : ext === '.webp' ? 'webp' : 'png';
    const dataUrl = `data:image/${mime};base64,${art.toString('base64')}`;
    const ok = await page.evaluate(
      (o) => window.setupSticker(o),
      {
        src: dataUrl,
        material: p.material ?? (p.holographic ? 'holo' : 'matte'),
        dieCut: p.dieCut ?? 'none',
        dropShadow: !!p.dropShadow,
        intensity: 0.9,
        hueScale: 1,
        tileScale: p.holographic ? 1.15 : 1,
        grain: p.holographic ? 0.05 : 0,
        pixelSize: SOURCE_PX,
        fit: SHOT_FIT,
      }
    );
    if (!ok) {
      log(`  STOP: the renderer could not start (no WebGL in this Chromium).`);
      continue;
    }

    const bg = await vignette(SOURCE_PX);

    for (const shot of SHOTS) {
      const png = Buffer.from(
        (await page.evaluate(([y]) => window.shootAt(y), [shot.yaw])).split(',')[1],
        'base64'
      );

      const shadow = await contactShadow(png, SOURCE_PX);

      // Transparent alpha, sticker over its own contact shadow.
      const onAlpha = await sharp(shadow)
        .composite([{ input: png, blend: 'over' }])
        .png()
        .toBuffer();

      // The same pass over the dark radial vignette from the reference.
      const onDark = await sharp(bg)
        .composite([{ input: shadow, blend: 'over' }, { input: png, blend: 'over' }])
        .png()
        .toBuffer();

      await writeVariants(onAlpha, shotDir, p.slug, shot.name, summary, wroteShots);
      await writeVariants(onDark, shotDir, p.slug, `${shot.name}-dark`, summary, wroteShots);
      log(`  ${shot.name.padEnd(8)} ${String(shot.yaw).padStart(3)}deg  +  ${shot.name}-dark`);
      rendered++;
    }

    // Poster: the still the card shows until the canvas is live. Rendered at
    // the live fit so nothing jumps when the swap happens.
    {
      // One poster per finish the product actually sells, so the pack picker
      // can show the drop shadow variant as its own choice.
      const finishes = (p.finishes ?? [{ label: '', dropShadow: !!p.dropShadow }]).map(
        (f) => !!f.dropShadow
      );
      for (const ds of [...new Set(finishes)]) {
        const png = Buffer.from(
          (await page.evaluate((d) => window.shootPoster(10, d), ds)).split(',')[1],
          'base64'
        );
        const name = ds ? `${p.slug}--poster-drop-shadow.webp` : `${p.slug}--poster.webp`;
        const info = await sharp(png).resize(800, 800)
          .webp({ quality: 88, alphaQuality: 92 })
          .toFile(path.join(siteDir, name));
        wroteSite.add(name);
        log(`  poster    10deg at the live fit${ds ? ', drop shadow' : ''}`);
        summary.push({ file: name, width: 800, kb: Math.round(info.size / 1024) });
      }
      // Leave the renderer on the product's own default for the scrub sheet.
      await page.evaluate((d) => window.shootPoster(0, d), !!p.dropShadow);
    }

    // The poster switched the renderer to the live fit, which is what the
    // scrub wants too: it stands in for the live viewer, not for a shot.
    if (doSpin) {
      const spinRange = spinRangeArg ?? (await page.evaluate(() => window.yawLimit()));
      const rows = Math.ceil(SPIN_FRAMES / SPIN_COLS);
      const tiles = [];
      for (let i = 0; i < SPIN_FRAMES; i++) {
        const yaw = -spinRange + (i / (SPIN_FRAMES - 1)) * (spinRange * 2);
        const png = Buffer.from(
          (await page.evaluate(([y]) => window.shootAt(y), [yaw])).split(',')[1],
          'base64'
        );
        tiles.push({
          input: await sharp(png).resize(SPIN_FRAME_PX, SPIN_FRAME_PX).png().toBuffer(),
          left: (i % SPIN_COLS) * SPIN_FRAME_PX,
          top: Math.floor(i / SPIN_COLS) * SPIN_FRAME_PX,
        });
      }

      const sheet = sharp({
        create: {
          width: SPIN_COLS * SPIN_FRAME_PX,
          height: rows * SPIN_FRAME_PX,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      }).composite(tiles);

      // WebP only. Any device that can run a scrub can decode WebP, and the
      // PNG equivalent was 3MB for a file whose whole job is being light.
      const webp = await sheet.clone().webp({ quality: 80, alphaQuality: 86 })
        .toFile(path.join(siteDir, `${p.slug}--spin-sheet.webp`));
      wroteSite.add(`${p.slug}--spin-sheet.webp`);

      wroteSite.add(`${p.slug}--spin.json`);
      await fs.writeFile(
        path.join(siteDir, `${p.slug}--spin.json`),
        JSON.stringify({
          frames: SPIN_FRAMES, cols: SPIN_COLS, rows,
          framePx: SPIN_FRAME_PX, yawFrom: -spinRange, yawTo: spinRange,
          sheet: `/products/${p.slug}/${p.slug}--spin-sheet.webp`,
        }, null, 2) + '\n'
      );

      log(`  spin     ${SPIN_FRAMES} frames, ${-spinRange} to ${spinRange}deg, ${SPIN_COLS}x${rows} sheet`);
      summary.push({ file: `${p.slug}--spin-sheet.webp`, width: SPIN_COLS * SPIN_FRAME_PX, kb: Math.round(webp.size / 1024) });
    }

    // Anything left over from an earlier run is dead weight in the repo and,
    // for public/, in every deploy.
    await prune(shotDir, wroteShots, 'product-shots/' + p.slug);
    if (doSpin) await prune(siteDir, wroteSite, 'public/products/' + p.slug);

    await fs.writeFile(stampFile, stamp);
  }

  await browser.close();
  await fs.unlink(harness).catch(() => {});

  if (summary.length) {
    log('\n' + '-'.repeat(58));
    log('file'.padEnd(44) + 'width'.padStart(6) + 'size'.padStart(8));
    log('-'.repeat(58));
    for (const r of summary) {
      log(r.file.padEnd(44) + String(r.width).padStart(6) + (r.kb + 'K').padStart(8));
    }
    log('-'.repeat(58));
  }
  log(`\n${rendered} angles rendered, ${summary.length} files written, ${cached} product(s) cached.`);
  log(`Output: public/products/`);
}

main().catch((e) => {
  console.error('\nFAILED:', e.message);
  process.exit(1);
});
