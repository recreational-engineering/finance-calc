import { describe, expect, it } from 'vitest';
import { comparisonNarrative, leadFromYear, payoffLabel } from './narrate';

describe('narrate', () => {
  it('describes a loan payoff', () => {
    expect(payoffLabel(null, 0)).toBe('No loan');
    expect(payoffLabel(null, 100)).toBe('Not repaid within 80 years');
    expect(payoffLabel(30 * 12, 100)).toBe('After 30 years');
    expect(payoffLabel(26, 100)).toBe('After 2 years and 2 months');
  });

  it('finds the year a lead becomes permanent', () => {
    const points = [0, 1, 2, 3, 4].map((year) => ({
      month: year * 12,
      left: year < 3 ? 10 : 40,
      right: 20,
    }));
    expect(leadFromYear(points, 'left')).toBe(3);
    const story = comparisonNarrative({
      left: 'Buying',
      right: 'Renting',
      leftNet: 40,
      rightNet: 20,
      points,
      detail: 'Same cash in both lives.',
    });
    expect(story.tone).toBe('left');
    expect(story.title).toContain('Buying finishes');
    expect(story.body).toContain('from year 3 on');
  });
});
