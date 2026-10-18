/**
 * Restore a flat settings object. Unknown or malformed fields keep the default.
 * Booleans stay booleans; everything else is read as a finite number.
 */
export function reviveFields<T extends object>(defaults: T, value: unknown): T | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const next = { ...defaults };
  for (const key of Object.keys(defaults) as Array<keyof T>) {
    const candidate = raw[String(key)];
    const current = defaults[key];
    if (typeof current === 'boolean') {
      if (typeof candidate === 'boolean') next[key] = candidate as T[keyof T];
      continue;
    }
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      next[key] = candidate as T[keyof T];
    } else if (
      typeof candidate === 'string' &&
      candidate.trim() !== '' &&
      Number.isFinite(Number(candidate))
    ) {
      next[key] = Number(candidate) as T[keyof T];
    }
  }
  return next;
}
