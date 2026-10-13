# CV - resumes for the Canadian job market

One Astro project, one layout, many resumes. Every YAML file in `src/content/cvs/` becomes its own
page on GitHub Pages, prints on exactly **one US Letter page** and keeps the contact details encrypted.

| Role | URL | File |
|---|---|---|
| Full-Stack Web Developer | https://heiko-h.github.io/cv/dev | `dev.yaml` |
| IT Project Manager | https://heiko-h.github.io/cv/pm | `pm.yaml` |
| Business Analyst | https://heiko-h.github.io/cv/ba | `ba.yaml` |
| Product Owner | https://heiko-h.github.io/cv/po | `po.yaml` |
| Technical Team Lead | https://heiko-h.github.io/cv/lead | `lead.yaml` |

## Creating a resume for a specific job

1. Create `src/content/cvs/<slug>.yaml` (lowercase letters, digits and dashes, e.g. `dev-shopify.yaml`).
2. Inherit from a role and override only what differs:

   ```yaml
   extends: dev                    # optional - defaults to base.yaml
   headline: Senior Shopify Developer
   summary: >-
     Tailored summary for this job ad …
   skills:                         # lists replace the inherited list
     - category: E-commerce
       items: [Shopify, Liquid, Headless Commerce]
   work:                           # jobs are merged by id
     ri-werkstattservice:
       bullets: [ … ]
     travix:
       positions:                  # sub-positions are merged by id (lead, dev)
         lead: { bullets: [ … ] }
     html-design:
       hidden: true                # drop a job to save space
   ```

3. Commit and push to `main` → after the workflow finishes the resume is live at
   `https://heiko-h.github.io/cv/<slug>`.

**Merge rules:** objects merge, lists replace, `null` removes a value, lists with `id`s (`work`,
`positions`) can be overridden by id. Chains such as `dev-shopify → dev → base` are supported.
Files starting with `_` are treated as drafts/partials and are not published.

**Validation:** the build fails on typos (unknown keys), more than 5 items per skill category,
more than 6 skill categories or more than 3 certifications. The workflow also fails if any
resume does not fit on one Letter page.

> In YAML flow lists (`[a, b, c]`) a comma separates items - quote labels that contain commas,
> e.g. `"PIM, MDM & DAM"`.

> Writing style: use a normal `-` (never en/em dashes) and the plain apostrophe `'`.

## Contact details (email, phone, location)

The plaintext **never** lives in the repository or in the generated HTML:

- In CI the values come from GitHub Secrets, which are masked in logs and never shown again.
- At build time they are encrypted with **AES-256-GCM** using a fresh random key per build.
  The page only contains the ciphertext. The key is XOR-masked and stored in a separate file with
  a random name (`_k/<random>.bin`) that is referenced only from the external script bundle.
- The reveal trigger is deliberately **not** a `<button>` or `<a>`: it is a plain `<div>` without
  role, and its label ("Show contact details") exists only in the CSS, not in the HTML.
- The browser fetches the key and decrypts only after a genuine click: the event must be trusted,
  the browser must not be automated (`navigator.webdriver`), there must be prior real mouse or
  touch interaction, a short dwell time and a click inside the trigger. After the click a
  3-second countdown runs (cancelled if the tab is hidden) before the key is even requested.
- When printing without revealing, the PDF shows *"Contact details: see web version"* and the URL.
- The build scans `dist/` and fails if email or phone appear in plaintext.

Any purely client-side scheme can ultimately be decrypted by a real browser - the goal is to keep
scrapers, LLM crawlers and blind-clicking bots away, which this does reliably.

### Setting the secrets

GitHub → repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Example |
|---|---|
| `CV_EMAIL` | `jane.doe@example.com` |
| `CV_PHONE` | `+49 176 0000 0000` |
| `CV_LOCATION` | `Stuttgart, Germany - Relocating to Canada` |

The deployment fails if one of them is missing.

## Enabling GitHub Pages

1. Repository name: `cv`. GitHub Pages serves the site under `/cv`; the workflow sets `CV_BASE=/cv`.
   Locally there is no base path (`/dev`, `/po`, ...).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push to `main` or run the workflow manually (**Actions → Build & deploy resumes → Run workflow**).

## Local development

```bash
npm install
cp .env.example .env          # put your real values here - .env is git-ignored
npm run dev                   # http://localhost:4321/dev
```

Without `.env` the build uses placeholder contact details and prints a warning.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with live reload |
| `npm run build` | Static build into `dist/` |
| `npm run preview` | Serve the build at `http://localhost:4321/<slug>` |
| `npm test` | Unit tests (merge logic, encryption round-trip) |
| `npm run check` | TypeScript / Astro diagnostics |
| `npm run check:secrets` | Fails if email/phone appear in plaintext in `dist/` |
| `npm run check:pages` | Fails if a resume exceeds one Letter page (needs `npx playwright install chromium`) |

## Design notes

- Canadian conventions: no photo, date of birth or marital status; Canadian English; action verbs
  with measurable results.
- Calm two-column layout: anthracite text, one navy accent, self-hosted Inter, 9.5 pt in print.
- Print: the distance to the paper edge is part of the page itself (`--print-padding-x/y`), so it
  also applies when the print dialog uses "Margins: None".
- Fine-tune density via the CSS variables in `src/styles/cv.css` (`--fs-base`, `--lh`, `--gap-*`, `--sidebar`).
- Pages are `noindex` by default; set `seo.index: true` in a YAML file to allow indexing.

## Project structure

```
src/content/cvs/   base.yaml + one file per resume
src/lib/           schema (zod), merge/extends logic, loader, encryption helpers
src/layouts/       CvLayout.astro - the single resume template
src/components/    Header, Contact, Section, Skills, WorkItem
src/scripts/       contact.ts - human-only reveal + WebCrypto decryption
src/styles/        cv.css - screen + print styles
integrations/      contact-key.ts - per-build key, writes dist/_k/<random>.bin
scripts/           check-one-page.ts, check-no-plaintext.ts
```

> The original `CV-Resume.pdf` contains plaintext contact details and is git-ignored (`*.pdf`).
