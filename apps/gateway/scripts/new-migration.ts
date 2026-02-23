import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
let name = 'migration';

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--name' && args[i + 1]) {
    name = args[i + 1];
    break;
  }
  if (!arg.startsWith('-') && name === 'migration') {
    name = arg;
  }
}

const safeName = name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '') || 'migration';

const migrationsDir = join(import.meta.dir, '../src/db/migrations');

if (!existsSync(migrationsDir)) {
  mkdirSync(migrationsDir, { recursive: true });
}

const files = readdirSync(migrationsDir).filter((file) => file.endsWith('.sql'));
const numbers = files
  .map((file) => {
    const match = /^(\d+)_/.exec(file);
    return match ? Number(match[1]) : 0;
  })
  .filter((value) => Number.isFinite(value));

const nextNumber = (numbers.length ? Math.max(...numbers) : 0) + 1;
const prefix = String(nextNumber).padStart(4, '0');
const filename = `${prefix}_${safeName}.sql`;
const filePath = join(migrationsDir, filename);

if (existsSync(filePath)) {
  console.log(`Migration already exists: ${filename}`);
  process.exit(1);
}

const header = `-- Migration ${prefix}: ${safeName}\n\n`;
writeFileSync(filePath, header, 'utf-8');

console.log(`Created migration ${filename}`);
