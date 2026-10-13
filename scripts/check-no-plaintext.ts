/**
 * Fails if any contact detail appears in plaintext anywhere in the build output.
 * Usage: npm run check:secrets   (reads CV_EMAIL, CV_PHONE, CV_LOCATION like the build does)
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { CONTACT_ENV } from '../src/lib/contact-crypto';

const root = process.cwd();
const dist = resolve(root, 'dist');
const envFile = resolve(root, '.env');
const env = { ...(existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {}), ...process.env };

if (!existsSync(dist)) {
  console.error('dist/ not found – run `npm run build` first.');
  process.exit(1);
}

// The location is not scanned: a city may legitimately appear in the work history.
const needles = new Set<string>();
for (const variable of [CONTACT_ENV.email, CONTACT_ENV.phone]) {
  const value = env[variable]?.trim();
  if (!value) continue;
  needles.add(value.toLowerCase());
  needles.add(encodeURIComponent(value).toLowerCase());
  if (variable === CONTACT_ENV.email) needles.add(value.split('@')[0]!.toLowerCase());
  if (variable === CONTACT_ENV.phone) {
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 6) needles.add(digits.slice(-7));
  }
}

if (needles.size === 0) {
  console.warn('No contact environment variables set – nothing to check.');
  process.exit(0);
}

function* files(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

const leaks: string[] = [];
let count = 0;
for (const file of files(dist)) {
  count++;
  const content = readFileSync(file).toString('latin1').toLowerCase();
  const normalised = content.replace(/[\s\-().]/g, '');
  for (const needle of needles) {
    if (content.includes(needle) || (/^\d+$/.test(needle) && normalised.includes(needle))) {
      leaks.push(relative(root, file));
      break;
    }
  }
}

if (leaks.length > 0) {
  console.error(`✗ Plaintext contact details found in:\n  ${leaks.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ No plaintext contact details in ${count} files of dist/`);
