#!/usr/bin/env node

/**
 * PWA Icon Generation Script
 *
 * Generates all required icon sizes from a source icon.
 * Uses sharp for image processing.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Configuration
const SOURCE_ICON = process.env.SOURCE_ICON || path.join(__dirname, '../assets/icon.png');
const OUTPUT_DIR = path.join(__dirname, '../dist/assets/icons');

// Required icon sizes
const ICON_SIZES = [
  72, 96, 128, 144, 152, 192, 384, 512
];

// Maskable icon sizes (with safe zone)
const MASKABLE_SIZES = [192, 512];

// Shortcut icon sizes
const SHORTCUT_SIZE = 96;

// Favicon sizes
const FAVICON_SIZES = [16, 32, 48];

async function generateIcons() {
  console.log('🎨 Generating PWA icons...');

  try {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Check if source icon exists
    if (!fs.existsSync(SOURCE_ICON)) {
      throw new Error(`Source icon not found: ${SOURCE_ICON}`);
    }

    // Generate standard icons
    await generateStandardIcons();

    // Generate maskable icons
    await generateMaskableIcons();

    // Generate shortcut icons
    await generateShortcutIcons();

    // Generate favicons
    await generateFavicons();

    console.log('✅ All icons generated successfully');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);

  } catch (error) {
    console.error('❌ Icon generation failed:', error);
    process.exit(1);
  }
}

async function generateStandardIcons() {
  console.log('📦 Generating standard icons...');

  for (const size of ICON_SIZES) {
    const filename = `icon-${size}x${size}.png`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    await sharp(SOURCE_ICON)
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
      })
      .png()
      .toFile(outputPath);

    console.log(`  ✓ Generated ${filename}`);
  }
}

async function generateMaskableIcons() {
  console.log('🎭 Generating maskable icons...');

  for (const size of MASKABLE_SIZES) {
    const filename = `icon-maskable-${size}x${size}.png`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    // Create a square canvas with padding for maskable safe zone
    // The safe zone is a circular area in the center (40% of diameter)
    const safeZone = Math.floor(size * 0.4);

    // Resize source to fit within safe zone
    await sharp(SOURCE_ICON)
      .resize(safeZone, safeZone, {
        fit: 'cover',
        position: 'center',
      })
      .extend({
        top: Math.floor((size - safeZone) / 2),
        bottom: Math.floor((size - safeZone) / 2),
        left: Math.floor((size - safeZone) / 2),
        right: Math.floor((size - safeZone) / 2),
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toFile(outputPath);

    console.log(`  ✓ Generated ${filename}`);
  }
}

async function generateShortcutIcons() {
  console.log('🔗 Generating shortcut icons...');

  const shortcuts = [
    { name: 'attendance', color: '#3b82f6' },
    { name: 'grades', color: '#10b981' },
    { name: 'schedule', color: '#f59e0b' },
    { name: 'notifications', color: '#ef4444' },
  ];

  for (const shortcut of shortcuts) {
    const filename = `shortcut-${shortcut.name}.png`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    // Create a colored background with the source icon overlay
    const svg = `
      <svg width="${SHORTCUT_SIZE}" height="${SHORTCUT_SIZE}">
        <rect width="${SHORTCUT_SIZE}" height="${SHORTCUT_SIZE}" fill="${shortcut.color}"/>
        <image href="${SOURCE_ICON}" x="${SHORTCUT_SIZE * 0.25}" y="${SHORTCUT_SIZE * 0.25}"
               width="${SHORTCUT_SIZE * 0.5}" height="${SHORTCUT_SIZE * 0.5}"/>
      </svg>
    `;

    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);

    console.log(`  ✓ Generated ${filename}`);
  }
}

async function generateFavicons() {
  console.log('🔖 Generating favicons...');

  const faviconDir = path.join(OUTPUT_DIR, 'favicon');
  if (!fs.existsSync(faviconDir)) {
    fs.mkdirSync(faviconDir, { recursive: true });
  }

  for (const size of FAVICON_SIZES) {
    const filename = `favicon-${size}x${size}.png`;
    const outputPath = path.join(faviconDir, filename);

    await sharp(SOURCE_ICON)
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
      })
      .png()
      .toFile(outputPath);

    console.log(`  ✓ Generated ${filename}`);
  }

  // Generate ICO file (Windows favicon)
  const icoPath = path.join(OUTPUT_DIR, 'favicon.ico');
  await sharp(SOURCE_ICON)
    .resize(32, 32, { fit: 'cover' })
    .toFile(icoPath);

  console.log(`  ✓ Generated favicon.ico`);
}

async function updateManifest() {
  console.log('📄 Updating manifest.json...');

  const manifestPath = path.join(__dirname, '../dist/manifest.json');

  if (!fs.existsSync(manifestPath)) {
    console.warn('⚠️  manifest.json not found, skipping update');
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // Update icon paths
  manifest.icons = ICON_SIZES.map((size) => ({
    src: `/assets/icons/icon-${size}x${size}.png`,
    sizes: `${size}x${size}`,
    type: 'image/png',
    purpose: 'any',
  }));

  // Add maskable icons
  MASKABLE_SIZES.forEach((size) => {
    manifest.icons.push({
      src: `/assets/icons/icon-maskable-${size}x${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: 'maskable',
    });
  });

  // Update shortcuts
  if (manifest.shortcuts) {
    manifest.shortcuts.forEach((shortcut) => {
      const iconPath = shortcut.icons?.[0]?.src || '';
      const iconName = path.basename(iconPath, path.extname(iconPath));
      shortcut.icons = [{
        src: `/assets/icons/shortcut-${iconName}.png`,
        sizes: `${SHORTCUT_SIZE}x${SHORTCUT_SIZE}`,
        type: 'image/png',
      }];
    });
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('✅ manifest.json updated');
}

// Run the icon generation
generateIcons()
  .then(() => updateManifest())
  .catch(console.error);
