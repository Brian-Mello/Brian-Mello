import { describe, it, expect } from 'vitest';
import { GridCalculator } from '../src/grid/GridCalculator.js';

describe('GridCalculator', () => {
  it('calculates equidistant levels', () => {
    const levels = GridCalculator.calculateLevels(100, 200, 5);
    expect(levels).toEqual([100, 125, 150, 175, 200]);
  });

  it('splits buy and sell levels by current price', () => {
    const levels = GridCalculator.calculateLevels(100, 200, 5);
    expect(GridCalculator.getBuyLevels(levels, 150)).toEqual([100, 125]);
    expect(GridCalculator.getSellLevels(levels, 150)).toEqual([175, 200]);
  });

  it('finds adjacent levels', () => {
    const levels = GridCalculator.calculateLevels(100, 200, 5);
    expect(GridCalculator.getLevelAbove(levels, 125)).toBe(150);
    expect(GridCalculator.getLevelBelow(levels, 175)).toBe(150);
  });

  it('allocates capital per buy grid', () => {
    expect(GridCalculator.amountPerGrid(300, 3)).toBe(100);
    expect(GridCalculator.baseAmount(100, 50000)).toBeCloseTo(0.002, 5);
  });

  it('throws on invalid range', () => {
    expect(() => GridCalculator.calculateLevels(200, 100, 5)).toThrow();
  });
});
