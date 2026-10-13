/**
 * Verifies that every built resume prints on exactly one US Letter page -
 * both before and after the contact details are revealed.
 * Usage: npm run build && npm run check:pages
 */
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';
import { buildBase } from '../src/lib/site';

// Same base as the build: '' locally, '/cv' when CV_BASE=/cv (GitHub Actions).
const BASE = buildBase().replace(/\/$/, '');
const dist = resolve(process.cwd(), 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
};

if (!existsSync(dist)) {
  console.error('dist/ not found - run `npm run build` first.');
  process.exit(1);
}

const slugs = readdirSync(dist).filter(
  (entry) => !entry.startsWith('_') && existsSync(join(dist, entry, 'index.html')),
);

const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]!);
  if (!path.startsWith(`${BASE}/`)) {
    res.writeHead(404).end();
    return;
  }
  let file = normalize(join(dist, path.slice(BASE.length)));
  if (!file.startsWith(dist)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

const countPages = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
const pdfOptions = { format: 'Letter', preferCSSPageSize: true, printBackground: true } as const;

const browser = await chromium.launch();
const failures: string[] = [];

try {
  const page = await browser.newPage();
  await page.emulateMedia({ media: 'print' });

  for (const slug of slugs) {
    await page.goto(`${origin}${BASE}/${slug}/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const before = countPages(await page.pdf(pdfOptions));

    // Simulate revealed contact details with deliberately long values.
    await page.evaluate(() => {
      const list = document.querySelector<HTMLElement>('.contact__list');
      if (!list) return;
      list.innerHTML =
        '<li><a href="#">firstname.lastname@example.com</a></li>' +
        '<li><a href="#">+1 (555) 010-0000</a></li>' +
        '<li>Stuttgart, Germany - Relocating to Canada</li>';
      list.hidden = false;
      document.querySelector('.contact__reveal')?.remove();
      document.documentElement.classList.add('contact-revealed');
    });
    const after = countPages(await page.pdf(pdfOptions));

    const ok = before === 1 && after === 1;
    console.log(`${ok ? '✓' : '✗'} ${BASE}/${slug}: ${before} page(s), ${after} page(s) with contact details`);
    if (!ok) failures.push(slug);
  }
} finally {
  await browser.close();
  server.close();
}

if (slugs.length === 0) {
  console.error('No resumes found in dist/.');
  process.exit(1);
}
if (failures.length > 0) {
  console.error(
    `\n${failures.length} resume(s) exceed one Letter page: ${failures.join(', ')}.\n` +
      'Shorten bullets, hide an older job (`hidden: true`) or tune the print variables in src/styles/cv.css.',
  );
  process.exit(1);
}
