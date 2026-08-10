#!/usr/bin/env node
/**
 * Builds the sticker pack artwork: the five stickers in the pack, laid out on
 * one transparent sheet so the pack can be rendered like any other sticker.
 *
 * This arranges Lewis's finished artwork. It does not draw, redraw or alter
 * any of it: every pixel comes from the files listed in SHEET.
 *
 *   node scripts/sticker-shots/build-pack.mjs
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HQ = path.resolve(ROOT, '..');
const OUT = path.join(ROOT, 'public/stickers/marine-life/sticker-pack.webp');

const SIZE = 1800;
const PAD = 40;

// Row layout, top to bottom. Each row shares its height; each cell in a row
// shares its width. The shark is very wide so it gets a row to itself.
const SHEET = [
  [{ src: "public/stickers/marine-life/grey-nurse-shark.webp", abs: false }],
  [
    { src: "public/stickers/marine-life/hawksbill-turtle.webp", abs: false },
    { src: "public/stickers/marine-life/fiddler-ray.webp", abs: false },
  ],
  [
    { src: "public/stickers/marine-life/starfish-cuddles.webp", abs: false },
    { src: "Stickers/Hologrpahic Stickers/dd-circle--hero-alpha.png", abs: true },
  ],
];

/** Trim a sticker to its own ink so the layout is not driven by padding. */
async function trimmed(file) {
  const buf = await fs.readFile(file);
  return sharp(buf).trim({ threshold: 1 }).png().toBuffer();
}

async function main() {
  const rows = SHEET.length;
  const rowH = Math.floor((SIZE - PAD * (rows + 1)) / rows);
  const composites = [];

  for (let r = 0; r < rows; r++) {
    const cells = SHEET[r];
    const cellW = Math.floor((SIZE - PAD * (cells.length + 1)) / cells.length);

    for (let c = 0; c < cells.length; c++) {
      const file = cells[c].abs
        ? path.join(HQ, cells[c].src)
        : path.join(ROOT, cells[c].src);
      try {
        await fs.access(file);
      } catch {
        console.error(`STOP: missing artwork ${file}`);
        process.exit(1);
      }

      const art = await trimmed(file);
      const fitted = await sharp(art)
        .resize(cellW, rowH, { fit: 'inside', withoutEnlargement: false })
        .png()
        .toBuffer();
      const m = await sharp(fitted).metadata();

      composites.push({
        input: fitted,
        left: PAD + c * (cellW + PAD) + Math.round((cellW - m.width) / 2),
        top: PAD + r * (rowH + PAD) + Math.round((rowH - m.height) / 2),
      });
      console.log(
        `  ${path.basename(file).padEnd(30)} ${m.width}x${m.height}  row ${r + 1}`
      );
    }
  }

  const info = await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .webp({ quality: 90, alphaQuality: 95, effort: 6 })
    .toFile(OUT);

  console.log(`\n${path.relative(ROOT, OUT)}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)}KB`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
