import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub project site: https://recreational-engineering.github.io/finance-calc/
export default defineConfig({
  plugins: [react()],
  base: '/finance-calc/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
