import type { PairConfig } from '../config/schema.js';
import type { ExchangeAdapter, Order } from '../exchange/types.js';
import { GridCalculator } from './GridCalculator.js';
import { logger } from '../logger.js';
import type { TradeRepository } from '../storage/TradeRepository.js';

export type EngineState = 'RUNNING' | 'OUT_OF_RANGE' | 'STOPPED';

export class GridEngine {
  private levels: number[] = [];
  private state: EngineState = 'STOPPED';
  private knownClosedOrderIds = new Set<string>();
  private initialCapital: number;
  private running = false;

  constructor(
    private readonly pairConfig: PairConfig,
    private readonly exchange: ExchangeAdapter,
    private readonly repository: TradeRepository,
    private readonly mode: 'paper' | 'live',
  ) {
    this.initialCapital = pairConfig.capital_usdt;
  }

  getState(): EngineState {
    return this.state;
  }

  async start(): Promise<void> {
    this.running = true;
    this.state = 'RUNNING';
    this.levels = GridCalculator.calculateLevels(
      this.pairConfig.lower_price,
      this.pairConfig.upper_price,
      this.pairConfig.grid_count,
    );

    const ticker = await this.exchange.fetchTicker(this.pairConfig.symbol);
    const currentPrice = ticker.last;

    if (currentPrice < this.pairConfig.lower_price || currentPrice > this.pairConfig.upper_price) {
      this.state = 'OUT_OF_RANGE';
      this.repository.logEvent('OUT_OF_RANGE', `Price ${currentPrice} outside grid range`, {
        pair: this.pairConfig.symbol,
      });
      logger.warn({ pair: this.pairConfig.symbol, currentPrice }, 'Price outside grid range');
      return;
    }

    await this.placeInitialOrders(currentPrice);
    this.repository.logEvent('START', `Grid started for ${this.pairConfig.symbol}`, {
      pair: this.pairConfig.symbol,
      levels: this.levels.length,
    });
    logger.info({ pair: this.pairConfig.symbol, levels: this.levels.length }, 'Grid initialized');
  }

  async tick(): Promise<void> {
    if (!this.running || this.state !== 'RUNNING') return;

    const ticker = await this.exchange.fetchTicker(this.pairConfig.symbol);
    const currentPrice = ticker.last;

    if (currentPrice < this.pairConfig.lower_price || currentPrice > this.pairConfig.upper_price) {
      this.state = 'OUT_OF_RANGE';
      await this.exchange.cancelAllOrders(this.pairConfig.symbol);
      this.repository.logEvent('OUT_OF_RANGE', `Price ${currentPrice} left grid range`, {
        pair: this.pairConfig.symbol,
      });
      logger.warn({ pair: this.pairConfig.symbol }, 'Price left range, orders canceled');
      return;
    }

    await this.handleFills();
    await this.recordSnapshot(currentPrice);
  }

  async stop(): Promise<void> {
    this.running = false;
    this.state = 'STOPPED';
    await this.exchange.cancelAllOrders(this.pairConfig.symbol);
    this.repository.logEvent('STOP', `Grid stopped for ${this.pairConfig.symbol}`, {
      pair: this.pairConfig.symbol,
    });
  }

  getPortfolioValue(currentPrice: number): number {
    if (this.exchange.mode === 'paper') {
      const paper = this.exchange as import('../exchange/PaperExchange.js').PaperExchange;
      return paper.getTotalValueUsdt(this.pairConfig.symbol, currentPrice);
    }
    return this.initialCapital;
  }

  private async placeInitialOrders(currentPrice: number): Promise<void> {
    const buyLevels = GridCalculator.getBuyLevels(this.levels, currentPrice);
    const usdtPerGrid = GridCalculator.amountPerGrid(this.pairConfig.capital_usdt, buyLevels.length);

    for (const level of buyLevels) {
      const amount = GridCalculator.baseAmount(usdtPerGrid, level);
      if (amount <= 0) continue;
      const order = await this.exchange.createLimitOrder(
        this.pairConfig.symbol,
        'buy',
        amount,
        level,
      );
      this.repository.saveOrder(order, this.mode, this.pairConfig.symbol);
    }

    const sellLevels = GridCalculator.getSellLevels(this.levels, currentPrice);
    for (const level of sellLevels) {
      const baseBal = this.exchange.getBaseBalance(this.pairConfig.symbol);
      if (baseBal <= 0) continue;
      const amount = GridCalculator.baseAmount(
        this.pairConfig.capital_usdt / this.pairConfig.grid_count,
        level,
      );
      if (amount <= 0 || amount > baseBal) continue;
      const order = await this.exchange.createLimitOrder(
        this.pairConfig.symbol,
        'sell',
        amount,
        level,
      );
      this.repository.saveOrder(order, this.mode, this.pairConfig.symbol);
    }
  }

  private async handleFills(): Promise<void> {
    const openOrders = await this.exchange.fetchOpenOrders(this.pairConfig.symbol);
    const openIds = new Set(openOrders.map((o) => o.id));

    for (const closedId of this.knownClosedOrderIds) {
      if (openIds.has(closedId)) {
        this.knownClosedOrderIds.delete(closedId);
      }
    }

    const allTracked = this.repository.getOpenOrders(this.pairConfig.symbol);
    for (const tracked of allTracked) {
      if (openIds.has(tracked.id)) continue;
      if (this.knownClosedOrderIds.has(tracked.id)) continue;

      this.knownClosedOrderIds.add(tracked.id);
      this.repository.updateOrderStatus(tracked.id, 'closed');
      this.repository.recordFill(tracked.id, this.pairConfig.symbol, tracked.price, tracked.amount, tracked.side);
      logger.info({ orderId: tracked.id, side: tracked.side, price: tracked.price }, 'Order filled');

      await this.placeOppositeOrder(tracked);
    }
  }

  private async placeOppositeOrder(filled: Order): Promise<void> {
    if (filled.side === 'buy') {
      const sellLevel = GridCalculator.getLevelAbove(this.levels, filled.price);
      if (!sellLevel) return;
      const order = await this.exchange.createLimitOrder(
        this.pairConfig.symbol,
        'sell',
        filled.amount,
        sellLevel,
      );
      this.repository.saveOrder(order, this.mode, this.pairConfig.symbol);
    } else {
      const buyLevel = GridCalculator.getLevelBelow(this.levels, filled.price);
      if (!buyLevel) return;
      const usdtPerGrid = GridCalculator.amountPerGrid(
        this.pairConfig.capital_usdt,
        GridCalculator.getBuyLevels(this.levels, filled.price).length || 1,
      );
      const amount = GridCalculator.baseAmount(usdtPerGrid, buyLevel);
      const order = await this.exchange.createLimitOrder(
        this.pairConfig.symbol,
        'buy',
        amount,
        buyLevel,
      );
      this.repository.saveOrder(order, this.mode, this.pairConfig.symbol);
    }
  }

  private async recordSnapshot(currentPrice: number): Promise<void> {
    const totalValue = this.getPortfolioValue(currentPrice);
    this.repository.saveSnapshot({
      pair: this.pairConfig.symbol,
      totalValueUsdt: totalValue,
      pnlUsdt: totalValue - this.initialCapital,
      recordedAt: Date.now(),
    });
  }
}
