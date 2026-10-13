import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { BASE_NAME, isPlainObject, resolveCv, type PlainObject } from './merge';
import { CvSchema, type Cv } from './schema';

export const CV_DIR = resolve(process.cwd(), 'src/content/cvs');

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface CvEntry {
  slug: string;
  data: Cv;
}

export function readSources(dir: string = CV_DIR): Record<string, PlainObject> {
  const sources: Record<string, PlainObject> = {};

  for (const file of readdirSync(dir)) {
    const ext = extname(file).toLowerCase();
    if (ext !== '.yaml' && ext !== '.yml') continue;

    const name = basename(file, extname(file));
    const parsed: unknown = parse(readFileSync(join(dir, file), 'utf8')) ?? {};
    if (!isPlainObject(parsed)) {
      throw new Error(`CV config "${file}" must contain a YAML mapping at the top level`);
    }
    sources[name] = parsed;
  }

  return sources;
}

/** Names that are only used as parents and never published as a route. */
export function isPublished(name: string): boolean {
  return name !== BASE_NAME && !name.startsWith('_');
}

export function buildCvs(sources: Record<string, PlainObject>): CvEntry[] {
  return Object.keys(sources)
    .filter(isPublished)
    .sort()
    .map((slug) => {
      if (!SLUG_PATTERN.test(slug)) {
        throw new Error(`Invalid CV file name "${slug}": use lowercase letters, digits and dashes only`);
      }
      const result = CvSchema.safeParse(resolveCv(slug, sources));
      if (!result.success) {
        throw new Error(`Invalid CV config "${slug}":\n${z.prettifyError(result.error)}`);
      }
      return { slug, data: result.data };
    });
}

export function loadCvs(dir: string = CV_DIR): CvEntry[] {
  return buildCvs(readSources(dir));
}
