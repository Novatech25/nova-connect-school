#!/usr/bin/env node

/**
 * Service Worker Build Script
 *
 * Bundles the Service Worker with its dependencies using esbuild.
 * Injects environment variables and generates the precache manifest.
 */

const fs = require('fs');
const path = require('path');
const { build } = require('esbuild');

// Configuration
const SW_SOURCE = path.join(__dirname, '../public/service-worker.js');
const SW_DEST = path.join(__dirname, '../dist/service-worker.js');
const SW_WRAPPER = path.join(__dirname, '../src/service-worker/sw-wrapper.ts');

// Environment variables to inject
const envVars = {
  'process.env.API_URL': JSON.stringify(process.env.EXPO_PUBLIC_API_URL || 'https://api.novaconnect.fr'),
  'process.env.SUPABASE_URL': JSON.stringify(process.env.EXPO_PUBLIC_SUPABASE_URL || ''),
  'process.env.CACHE_VERSION': JSON.stringify(process.env.EXPO_PUBLIC_CACHE_VERSION || '1.0.0'),
  'process.env.SW_UPDATE_INTERVAL': JSON.stringify(process.env.EXPO_PUBLIC_SW_UPDATE_INTERVAL || '3600000'),
};

async function buildServiceWorker() {
  console.log('🔨 Building Service Worker...');

  try {
    // Ensure dist directory exists
    const distDir = path.dirname(SW_DEST);
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }

    // Check if source file exists
    if (!fs.existsSync(SW_SOURCE)) {
      throw new Error(`Service Worker source file not found: ${SW_SOURCE}`);
    }

    // Copy service worker to dist (it's already plain JS with Workbox)
    fs.copyFileSync(SW_SOURCE, SW_DEST);

    // If we have TypeScript wrapper, we would bundle it here
    // For now, the Service Worker uses Workbox's CDN imports
    // In production, you'd want to bundle Workbox locally

    console.log('✅ Service Worker built successfully');
    console.log(`📦 Output: ${SW_DEST}`);

    // Generate manifest for Workbox
    await generatePrecacheManifest();

    // Inject environment variables
    await injectEnvironmentVariables();

  } catch (error) {
    console.error('❌ Service Worker build failed:', error);
    process.exit(1);
  }
}

async function generatePrecacheManifest() {
  console.log('📋 Generating precache manifest...');

  try {
    // This would typically use workbox-cli to generate a manifest
    // For now, we'll create a simple one
    const manifest = [
      { url: '/', revision: Date.now().toString() },
      { url: '/index.html', revision: Date.now().toString() },
      { url: '/manifest.json', revision: Date.now().toString() },
    ];

    const manifestPath = path.join(__dirname, '../dist/workbox-precache-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log('✅ Precache manifest generated');

  } catch (error) {
    console.warn('⚠️  Failed to generate precache manifest:', error.message);
  }
}

async function injectEnvironmentVariables() {
  console.log('💉 Injecting environment variables...');

  try {
    let swContent = fs.readFileSync(SW_DEST, 'utf-8');

    // Inject environment variables at the beginning of the file
    const envInjection = Object.entries(envVars)
      .map(([key, value]) => `const ${key} = ${value};`)
      .join('\n');

    swContent = envInjection + '\n\n' + swContent;

    fs.writeFileSync(SW_DEST, swContent);

    console.log('✅ Environment variables injected');

  } catch (error) {
    console.warn('⚠️  Failed to inject environment variables:', error.message);
  }
}

// Run the build
buildServiceWorker().catch(console.error);
