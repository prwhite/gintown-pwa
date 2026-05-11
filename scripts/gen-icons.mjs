#!/usr/bin/env node
/**
 * Generate PWA icons from static/splash/ace-spades.svg.
 *
 * Outputs three PNGs into static/icons/:
 *   - icon-192.png            (192×192, tight artwork, dark background)
 *   - icon-512.png            (512×512, tight artwork, dark background)
 *   - icon-maskable-512.png   (512×512, artwork inset for safe zone)
 *
 * Run via `npm run icons`.
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const splashPath = resolve(root, 'static/splash/ace-spades.png');
const outDir = resolve(root, 'static/icons');

const BG = '#1a1a2e';
const splashBytes = readFileSync(splashPath);

mkdirSync(outDir, { recursive: true });

const splashMeta = await sharp(splashBytes).metadata();
const splashAspect = (splashMeta.width ?? 1) / (splashMeta.height ?? 1);

async function makeIcon({ size, inset, file, maskable = false }) {
  // Fit the card inside the inset box, height-constrained so the full card stays visible.
  const box = size - 2 * inset;
  const cardH = box;
  const cardW = Math.round(box * splashAspect);

  const card = await sharp(splashBytes)
    .resize(cardW, cardH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const top = Math.round((size - cardH) / 2);
  const left = Math.round((size - cardW) / 2);

  const out = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG
    }
  })
    .composite([{ input: card, top, left }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  const outPath = resolve(outDir, file);
  writeFileSync(outPath, out);
  console.log(`  wrote ${file}  (${size}×${size}${maskable ? ', maskable' : ''})`);
}

console.log('Generating PWA icons:');
await makeIcon({ size: 192, inset: 18, file: 'icon-192.png' });
await makeIcon({ size: 512, inset: 48, file: 'icon-512.png' });
// Maskable: artwork must fit within a 80% safe zone (Android crops the outer 10% to a circle/rounded mask).
await makeIcon({ size: 512, inset: 84, file: 'icon-maskable-512.png', maskable: true });
console.log('Done.');
