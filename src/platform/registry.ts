export interface ToolMeta {
  id: string;
  path: string;
  name: string;
  channel: string;
  eyebrow: string;
  summary: string;
  outcome: string;
}

export const tools: ToolMeta[] = [
  {
    id: 'retirement',
    path: '/retirement',
    name: 'Retirement',
    channel: 'savings.plan',
    eyebrow: 'Savings plan',
    summary:
      'Start a plan on a chosen date and run it forward for as many years as you like. Each entry has a name, a monthly amount, and its own yearly interest.',
    outcome: 'A stacked chart of capital by entry, plus each entry’s share of the total.',
  },
  {
    id: 'etf',
    path: '/etf',
    name: 'ETFs',
    channel: 'market.etf',
    eyebrow: 'Expected return',
    summary:
      'Pick an ETF or ETC you can buy at DKB. The page estimates a long-term yearly return from the market’s history and from dividends, growth, and today’s prices.',
    outcome: 'A planning rate the retirement plan can use as the interest on that entry.',
  },
  {
    id: 'rent',
    path: '/rent',
    name: 'Rent',
    channel: 'housing.munich',
    eyebrow: 'Flat in Munich',
    summary:
      'Buy a flat, or rent the same flat and put every euro you did not have to tie up into an MSCI World ETF. Loan, upkeep, and appreciation start from Munich figures.',
    outcome: 'Net worth, monthly cash, and where the capital sits in each life.',
  },
  {
    id: 'leasing',
    path: '/leasing',
    name: 'Leasing',
    channel: 'vehicle.lease',
    eyebrow: 'Car',
    summary:
      'Buy a car for cash, or lease the same car and invest the free capital in an MSCI World ETF. Replace the car on a schedule, buy it when the lease ends, or have both lives save up from zero.',
    outcome: 'The same wealth and cash comparison as the flat, applied to a car.',
  },
];
