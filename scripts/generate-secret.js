/**
 * Script pour générer des secrets sécurisés
 * Usage: node scripts/generate-secret.js
 */

const crypto = require('crypto');

// Générer un secret de 32+ caractères (64 caractères hexadécimaux)
const secret = crypto.randomBytes(32).toString('hex');

console.log('🔑 Secret généré (64 caractères hex):');
console.log(secret);
console.log('');
console.log('📋 Copiez ce secret pour votre configuration .env:');

// Version avec préfix pour faciliter l'identification
const secretWithPrefix = `nova_secret_${secret}`;
console.log(secretWithPrefix);

// Version URL-safe (base64)
const urlSafeSecret = crypto.randomBytes(32).toString('base64url');
console.log('');
console.log('🔐 Version URL-safe (base64url):');
console.log(urlSafeSecret);
