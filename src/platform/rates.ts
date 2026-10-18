/** Effective monthly rate from a nominal annual return that compounds once a year. */
export function effectiveMonthlyRate(annualPercent: number): number {
  if (!Number.isFinite(annualPercent)) return 0;
  return Math.pow(1 + annualPercent / 100, 1 / 12) - 1;
}

/**
 * German bank convention for loans: nominal annual rate divided by 12.
 * This is not the same as an effective annual rate.
 */
export function nominalMonthlyRate(annualPercent: number): number {
  if (!Number.isFinite(annualPercent)) return 0;
  return annualPercent / 100 / 12;
}

export function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
