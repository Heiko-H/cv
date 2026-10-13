import { describe, expect, it } from 'vitest';
import { buildCvs, loadCvs } from '../src/lib/cv';
import { deepMerge, resolveCv, type PlainObject } from '../src/lib/merge';

const base: PlainObject = {
  name: 'Jane Doe',
  headline: 'Base',
  summary: 'Base summary',
  skills: [{ category: 'A', items: ['a1', 'a2'] }],
  seo: { index: false },
  work: [
    { id: 'one', company: 'One Inc', title: 'Dev', location: 'Toronto', start: '2020', end: 'Present', bullets: ['b1'] },
    { id: 'two', company: 'Two Inc', title: 'Dev', location: 'Ottawa', start: '2018', end: '2020', bullets: ['b2'] },
  ],
};

describe('deepMerge', () => {
  it('merges nested objects and replaces arrays', () => {
    const result = deepMerge(
      { seo: { index: false, other: 1 }, skills: [1, 2, 3] },
      { seo: { index: true }, skills: [4] },
    );
    expect(result).toEqual({ seo: { index: true, other: 1 }, skills: [4] });
  });

  it('removes keys set to null', () => {
    expect(deepMerge({ a: 1, b: 2 }, { b: null })).toEqual({ a: 1 });
  });

  it('merges work entries by id and keeps order', () => {
    const result = deepMerge(base, { work: { two: { bullets: ['new'] }, one: { hidden: true } } });
    const work = result.work as PlainObject[];
    expect(work.map((job) => job.id)).toEqual(['one', 'two']);
    expect(work[0]).toMatchObject({ hidden: true, bullets: ['b1'] });
    expect(work[1]).toMatchObject({ company: 'Two Inc', bullets: ['new'] });
  });

  it('appends unknown job ids as new jobs', () => {
    const result = deepMerge(base, { work: { three: { company: 'Three' } } });
    expect((result.work as PlainObject[])[2]).toEqual({ id: 'three', company: 'Three' });
  });

  it('merges nested lists (positions) by id', () => {
    const withPositions = deepMerge(base, {
      work: { one: { positions: [{ id: 'lead', title: 'Lead', bullets: ['x'] }, { id: 'dev', title: 'Dev', bullets: ['y'] }] } },
    });
    const result = deepMerge(withPositions, { work: { one: { positions: { dev: { bullets: ['z'] } } } } });
    const positions = (result.work as PlainObject[])[0]!.positions;
    expect(positions).toEqual([
      { id: 'lead', title: 'Lead', bullets: ['x'] },
      { id: 'dev', title: 'Dev', bullets: ['z'] },
    ]);
  });

  it('replaces the work history when given as an array', () => {
    const result = deepMerge(base, { work: [{ id: 'x' }] });
    expect(result.work).toEqual([{ id: 'x' }]);
  });

  it('does not mutate its inputs', () => {
    const snapshot = structuredClone(base);
    deepMerge(base, { seo: { index: true }, work: { one: { bullets: [] } } });
    expect(base).toEqual(snapshot);
  });
});

describe('resolveCv', () => {
  it('implicitly extends base', () => {
    const result = resolveCv('dev', { base, dev: { headline: 'Dev' } });
    expect(result).toMatchObject({ name: 'Jane Doe', headline: 'Dev' });
  });

  it('resolves extends chains and strips the extends key', () => {
    const result = resolveCv('dev-shop', {
      base,
      dev: { headline: 'Dev', summary: 'Dev summary' },
      'dev-shop': { extends: 'dev', headline: 'Shopify Dev' },
    });
    expect(result).toMatchObject({ headline: 'Shopify Dev', summary: 'Dev summary', name: 'Jane Doe' });
    expect(result).not.toHaveProperty('extends');
  });

  it('detects cycles', () => {
    expect(() => resolveCv('a', { base, a: { extends: 'b' }, b: { extends: 'a' } })).toThrow(/Circular/);
  });

  it('reports missing parents', () => {
    expect(() => resolveCv('a', { base, a: { extends: 'missing' } })).toThrow(/"missing" not found/);
  });
});

describe('buildCvs', () => {
  it('publishes every file except base and _partials', () => {
    const entries = buildCvs({ base, _draft: {}, dev: { headline: 'Dev' }, pm: { headline: 'PM' } });
    expect(entries.map((entry) => entry.slug)).toEqual(['dev', 'pm']);
    expect(entries[0]?.data.work[0]?.hidden).toBe(false);
  });

  it('fails when a skill category has more than 5 items', () => {
    const skills = [{ category: 'Too many', items: ['1', '2', '3', '4', '5', '6'] }];
    expect(() => buildCvs({ base, dev: { skills } })).toThrow(/at most 5 items/);
  });

  it('fails on unknown keys (typos)', () => {
    expect(() => buildCvs({ base, dev: { sumary: 'typo' } })).toThrow(/sumary/);
  });

  it('rejects invalid file names', () => {
    expect(() => buildCvs({ base, Dev_CV: {} })).toThrow(/Invalid CV file name/);
  });

  it('loads and validates the real content files', () => {
    const slugs = loadCvs().map((entry) => entry.slug);
    expect(slugs).toEqual(expect.arrayContaining(['ba', 'dev', 'lead', 'pm', 'po']));
  });
});
