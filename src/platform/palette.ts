export const SERIES_COLORS = [
  '#0e6e6b',
  '#c4622d',
  '#234e70',
  '#b0893e',
  '#6d4c7d',
  '#2f7d4f',
  '#a3414b',
  '#3d7c8a',
] as const;

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}
