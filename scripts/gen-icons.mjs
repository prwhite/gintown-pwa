#!/usr/bin/env node
/**
 * Generate PWA icons from static/icon-source.png (the abs deck back).
 *
 * The source is a card (560×784, ~0.71:1). We center-crop the largest square
 * out of it so the icon is filled edge-to-edge with the abstract back art.
 *
 * Outputs three PNGs into static/icons/:
 *   - icon-192.png            (192×192, square-cropped back, no padding)
 *   - icon-512.png            (512×512, same)
 *   - icon-maskable-512.png   (512×512, art inset into the 80% safe zone with
 *                              a dark plate for Android adaptive icons)
 *
 * Run via `npm run icons`.
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const sourcePath = resolve(root, 'static/icon-source.png');
const outDir = resolve(root, 'static/icons');

const BG = '#1a1a2e';
const sourceBytes = readFileSync(sourcePath);

mkdirSync(outDir, { recursive: true });

const meta = await sharp(sourceBytes).metadata();
const w = meta.width ?? 0;
const h = meta.height ?? 0;
const side = Math.min(w, h);
const cropLeft = Math.round((w - side) / 2);
const cropTop = Math.round((h - side) / 2);

// Pre-crop to the largest centered square once.
const squareCard = await sharp(sourceBytes)
  .extract({ left: cropLeft, top: cropTop, width: side, height: side })
  .png()
  .toBuffer();

console.log(`Source: ${w}×${h} → centered square crop ${side}×${side}`);

async function makeFlatIcon({ size, file }) {
  const out = await sharp(squareCard)
    .resize(size, size, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(resolve(outDir, file), out);
  console.log(`  wrote ${file}  (${size}×${size}, edge-to-edge)`);
}

async function makeMaskableIcon({ size, file, safeZoneRatio = 0.8 }) {
  // Android maskable: artwork must live inside the inner 80% safe zone; outer
  // 10% on each side is liable to be cropped to a circle/squircle.
  const innerSize = Math.round(size * safeZoneRatio);
  const inset = Math.round((size - innerSize) / 2);

  const innerArt = await sharp(squareCard)
    .resize(innerSize, innerSize, { fit: 'cover' })
    .png()
    .toBuffer();

  const out = await sharp({
    create: { width: size, height: size, channels: 4, background: BG }
  })
    .composite([{ input: innerArt, top: inset, left: inset }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  writeFileSync(resolve(outDir, file), out);
  console.log(`  wrote ${file}  (${size}×${size}, maskable safe-zone ${Math.round(safeZoneRatio * 100)}%)`);
}

console.log('Generating PWA icons:');
await makeFlatIcon({ size: 192, file: 'icon-192.png' });
await makeFlatIcon({ size: 512, file: 'icon-512.png' });
await makeMaskableIcon({ size: 512, file: 'icon-maskable-512.png' });
console.log('Done.');
