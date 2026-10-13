/** Public location of the resumes on GitHub Pages (used for canonical and printed URLs). */
export const PUBLIC_SITE = 'https://heiko-h.github.io';
export const PUBLIC_BASE = '/cv';

/**
 * Base path of the current build. Locally the resumes live at `/dev`, `/po`, ...;
 * the GitHub Pages build sets `CV_BASE=/cv` (see .github/workflows/deploy.yml).
 */
export function buildBase(env: Record<string, string | undefined> = process.env): string {
  const base = env.CV_BASE?.trim().replace(/\/+$/, '') ?? '';
  return base === '' ? '/' : base.startsWith('/') ? base : `/${base}`;
}

/** Public URL of a resume, independent of the local base path. */
export function publicUrl(slug: string): URL {
  return new URL(`${PUBLIC_BASE}/${slug}`, PUBLIC_SITE);
}
