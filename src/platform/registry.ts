export interface ToolMeta {
  id: string;
  path: string;
  name: string;
  /** One line, shown under the tool name in the list. */
  purpose: string;
}

export const tools: ToolMeta[] = [
  {
    id: 'retirement',
    path: '/retirement',
    name: 'Retirement',
    purpose: 'Monthly savings, each with its own interest',
  },
  {
    id: 'etf',
    path: '/etf',
    name: 'ETFs',
    purpose: 'Planning rate for a DKB fund',
  },
  {
    id: 'rent',
    path: '/rent',
    name: 'Rent',
    purpose: 'Buy a flat, or rent and invest',
  },
  {
    id: 'leasing',
    path: '/leasing',
    name: 'Leasing',
    purpose: 'Buy a car, or lease and invest',
  },
];
