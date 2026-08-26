export class GridCalculator {
  static calculateLevels(lowerPrice: number, upperPrice: number, gridCount: number): number[] {
    if (gridCount < 2) {
      throw new Error('grid_count must be at least 2');
    }
    if (lowerPrice >= upperPrice) {
      throw new Error('lower_price must be less than upper_price');
    }

    const step = (upperPrice - lowerPrice) / (gridCount - 1);
    const levels: number[] = [];
    for (let i = 0; i < gridCount; i++) {
      levels.push(Number((lowerPrice + step * i).toFixed(8)));
    }
    return levels;
  }

  static getBuyLevels(levels: number[], currentPrice: number): number[] {
    return levels.filter((level) => level < currentPrice);
  }

  static getSellLevels(levels: number[], currentPrice: number): number[] {
    return levels.filter((level) => level > currentPrice);
  }

  static getLevelAbove(levels: number[], price: number): number | undefined {
    return levels.find((level) => level > price);
  }

  static getLevelBelow(levels: number[], price: number): number | undefined {
    const below = levels.filter((level) => level < price);
    return below.length > 0 ? below[below.length - 1] : undefined;
  }

  static amountPerGrid(capitalUsdt: number, buyLevelCount: number): number {
    if (buyLevelCount <= 0) {
      throw new Error('No buy levels available for capital allocation');
    }
    return capitalUsdt / buyLevelCount;
  }

  static baseAmount(usdtAmount: number, price: number): number {
    return Number((usdtAmount / price).toFixed(8));
  }
}
