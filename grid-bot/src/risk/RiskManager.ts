import type { BotConfig, PairConfig } from '../config/schema.js';

export type RiskState = 'OK' | 'OUT_OF_RANGE' | 'KILL_SWITCH' | 'INSUFFICIENT_BALANCE';

export class RiskManager {
  private initialCapital: number;
  private peakValue: number;
  private currentValue: number;

  constructor(private readonly config: BotConfig) {
    this.initialCapital = config.pairs.reduce((sum, p) => sum + p.capital_usdt, 0);
    this.peakValue = this.initialCapital;
    this.currentValue = this.initialCapital;
  }

  updatePortfolioValue(totalValueUsdt: number): void {
    this.currentValue = totalValueUsdt;
    if (totalValueUsdt > this.peakValue) {
      this.peakValue = totalValueUsdt;
    }
  }

  checkKillSwitch(): boolean {
    if (this.peakValue <= 0) return false;
    const drawdownPct = ((this.peakValue - this.currentValue) / this.peakValue) * 100;
    return drawdownPct >= this.config.global.kill_switch_drawdown_pct;
  }

  checkPriceInRange(pair: PairConfig, currentPrice: number): boolean {
    return currentPrice >= pair.lower_price && currentPrice <= pair.upper_price;
  }

  getPnl(): number {
    return this.currentValue - this.initialCapital;
  }

  getDrawdownPct(): number {
    if (this.peakValue <= 0) return 0;
    return ((this.peakValue - this.currentValue) / this.peakValue) * 100;
  }
}
