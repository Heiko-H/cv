/**
 * Merge rules for CV configuration files:
 * - plain objects are merged recursively,
 * - arrays and scalars replace the inherited value,
 * - `null` removes an inherited key,
 * - a list of entries with an `id` (e.g. `work`, `positions`) may be overridden with a map
 *   keyed by id; each entry is deep-merged into the inherited entry with the same id
 *   (unknown ids are appended). Giving an array instead replaces the whole list.
 */

export type PlainObject = Record<string, unknown>;

export const BASE_NAME = 'base';

export function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function deepMerge(base: PlainObject, override: PlainObject): PlainObject {
  const result: PlainObject = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (value === null) {
      delete result[key];
    } else if (Array.isArray(result[key]) && isPlainObject(value)) {
      result[key] = mergeById(result[key] as unknown[], value, key);
    } else if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key] as PlainObject, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function mergeById(baseItems: unknown[], overrides: PlainObject, key = 'list'): unknown[] {
  const knownIds = new Set<string>();

  const merged = baseItems.map((item) => {
    if (!isPlainObject(item) || typeof item.id !== 'string') return item;
    knownIds.add(item.id);
    const override = overrides[item.id];
    if (override === undefined) return item;
    if (!isPlainObject(override)) {
      throw new Error(`Override for ${key} entry "${item.id}" must be an object`);
    }
    return deepMerge(item, override);
  });

  for (const [id, override] of Object.entries(overrides)) {
    if (knownIds.has(id)) continue;
    if (!isPlainObject(override)) {
      throw new Error(`New ${key} entry "${id}" must be an object`);
    }
    merged.push({ id, ...override });
  }

  return merged;
}

/**
 * Resolves the `extends` chain of a CV (e.g. `dev-shopify` → `dev` → `base`) and returns
 * the merged raw configuration without the `extends` key.
 * Every CV implicitly extends `base` unless it names another parent.
 */
export function resolveCv(name: string, sources: Record<string, PlainObject>): PlainObject {
  const chain: PlainObject[] = [];
  const visited: string[] = [];
  let current: string | undefined = name;

  while (current !== undefined) {
    if (visited.includes(current)) {
      throw new Error(`Circular "extends" chain: ${[...visited, current].join(' → ')}`);
    }
    visited.push(current);

    const source: PlainObject | undefined = sources[current];
    if (!source) {
      const from = visited.length > 1 ? ` (extended by "${visited[visited.length - 2]}")` : '';
      throw new Error(`CV config "${current}" not found${from}`);
    }
    chain.unshift(source);

    const parent: unknown = source.extends;
    if (parent !== undefined && typeof parent !== 'string') {
      throw new Error(`"extends" in "${current}" must be a string`);
    }
    current = parent ?? (current === BASE_NAME || !(BASE_NAME in sources) ? undefined : BASE_NAME);
  }

  const merged = chain.reduce<PlainObject>((acc, source) => deepMerge(acc, source), {});
  delete merged.extends;
  return merged;
}
