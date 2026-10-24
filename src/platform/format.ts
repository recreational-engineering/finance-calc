const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const eurExact = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 2,
});

export function formatEur(value: number, digits: 0 | 2 = 0): string {
  if (!Number.isFinite(value)) return '—';
  return (digits === 0 ? eur : eurExact).format(value);
}

export function formatAxisEur(value: number): string {
  if (!Number.isFinite(value)) return '';
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toLocaleString('de-DE', {
      maximumFractionDigits: 1,
      minimumFractionDigits: abs >= 10_000_000 ? 0 : 1,
    })} Mio.`;
  }
  if (abs >= 10_000) {
    return `${sign}${Math.round(abs / 1000).toLocaleString('de-DE')} Tsd.`;
  }
  return `${sign}${Math.round(abs).toLocaleString('de-DE')}`;
}

/** Percent points as entered by the user, e.g. 4.5 → "4,50 %". */
export function formatPercentPoints(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} %`;
}

/** Share of a whole, e.g. 0.42 → "42,0 %". */
export function formatShare(fraction: number): string {
  if (!Number.isFinite(fraction)) return '—';
  return fraction.toLocaleString('de-DE', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPlain(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return number.format(value);
}

export function monthLabel(startDate: string, monthIndex: number): string {
  const [yearText, monthText] = startDate.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return `Month ${monthIndex}`;
  const date = new Date(Date.UTC(year, month - 1 + monthIndex, 1));
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Calendar day in `timeZone`, as YYYY-MM-DD. */
export function calendarToday(timeZone = 'Europe/Berlin', now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function dayLabel(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function horizonLabel(monthIndex: number): string {
  if (monthIndex <= 0) return 'Start';
  if (monthIndex % 12 === 0) return `Year ${monthIndex / 12}`;
  const years = Math.floor(monthIndex / 12);
  const months = monthIndex % 12;
  return years === 0 ? `Month ${months}` : `Year ${years}, month ${months}`;
}
