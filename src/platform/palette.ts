export const TRACE = {
  blue: '#4c8dff',
  orange: '#ff7a45',
  green: '#3ddc84',
  violet: '#c084fc',
  amber: '#ffb020',
  red: '#ff4d4d',
  cyan: '#2ee0c5',
  pink: '#ff6b9a',
} as const;

export const SERIES_COLORS = [
  TRACE.blue,
  TRACE.orange,
  TRACE.green,
  TRACE.violet,
  TRACE.amber,
  TRACE.cyan,
  TRACE.red,
  TRACE.pink,
] as const;

export const COMPARE = {
  left: TRACE.blue,
  right: TRACE.orange,
  equity: TRACE.green,
  etf: TRACE.violet,
} as const;

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}
