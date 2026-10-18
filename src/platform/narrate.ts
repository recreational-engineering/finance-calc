import { formatEur } from './format';

export type Side = 'left' | 'right' | 'tie';

export function payoffLabel(month: number | null, loan: number): string {
  if (!(loan > 0)) return 'No loan';
  if (month === null) return 'Not repaid within 80 years';
  const years = Math.floor(month / 12);
  const rest = month % 12;
  if (years === 0) return `After ${rest} months`;
  if (rest === 0) return `After ${years} years`;
  return `After ${years} years and ${rest} months`;
}

export function sideOf(left: number, right: number): Side {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 'tie';
  if (Math.abs(left - right) < 1) return 'tie';
  return left > right ? 'left' : 'right';
}

/**
 * Earliest year-end from which the final leader stays strictly ahead.
 * Year-ends only, so a one-month blip does not move the sentence.
 */
export function leadFromYear(
  points: Array<{ month: number; left: number; right: number }>,
  leader: Exclude<Side, 'tie'>,
): number | null {
  const ends = points.filter((point) => point.month > 0 && point.month % 12 === 0);
  for (let index = 0; index < ends.length; index += 1) {
    const rest = ends.slice(index);
    const holds = rest.every((point) => sideOf(point.left, point.right) === leader);
    if (holds) return ends[index].month / 12;
  }
  return null;
}

export function comparisonNarrative(options: {
  left: string;
  right: string;
  leftNet: number;
  rightNet: number;
  points: Array<{ month: number; left: number; right: number }>;
  detail: string;
}): { tone: Side; title: string; body: string } {
  const tone = sideOf(options.leftNet, options.rightNet);
  const gap = options.leftNet - options.rightNet;
  const title =
    tone === 'tie'
      ? `${options.left} and ${options.right} finish level`
      : tone === 'left'
        ? `${options.left} finishes ${formatEur(gap)} ahead`
        : `${options.right} finishes ${formatEur(-gap)} ahead`;
  const sentences = [options.detail];
  if (tone !== 'tie') {
    const year = leadFromYear(options.points, tone);
    const name = tone === 'left' ? options.left : options.right;
    if (year === 1) sentences.push(`${name} is ahead from the first year on.`);
    else if (year !== null) sentences.push(`${name} stays ahead from year ${year} on.`);
  }
  return { tone, title, body: sentences.join(' ') };
}
