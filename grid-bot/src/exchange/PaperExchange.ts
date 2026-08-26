import { randomUUID } from 'node:crypto';
import type { ExchangeAdapter, Order, OrderSide, Ticker } from './types.js';
import { PublicPriceFeed } from './BinanceAdapter.js';

interface PaperOrder extends Order {
  gridLevel: number;
}

export class PaperExchange implements ExchangeAdapter {
  readonly mode = 'paper' as const;
  private orders = new Map<string, PaperOrder>();
  private quoteBalance: number;
  private baseBalances = new Map<string, number>();
  private priceFeed: PublicPriceFeed;
  private lastPrices = new Map<string, number>();

  constructor(initialQuoteUsdt: number, priceFeed?: PublicPriceFeed) {
    this.quoteBalance = initialQuoteUsdt;
    this.priceFeed = priceFeed ?? new PublicPriceFeed();
  }

  async fetchTicker(symbol: string): Promise<Ticker> {
    const ticker = await this.priceFeed.fetchTicker(symbol);
    this.lastPrices.set(symbol, ticker.last);
    await this.processFills(symbol, ticker.last);
    return ticker;
  }

  async createLimitOrder(
    symbol: string,
    side: OrderSide,
    amount: number,
    price: number,
  ): Promise<Order> {
    const order: PaperOrder = {
      id: randomUUID(),
      symbol,
      side,
      price,
      amount,
      status: 'open',
      filled: 0,
      createdAt: Date.now(),
      gridLevel: price,
    };
    this.orders.set(order.id, order);
    return order;
  }

  async cancelOrder(orderId: string, _symbol: string): Promise<void> {
    const order = this.orders.get(orderId);
    if (order && order.status === 'open') {
      order.status = 'canceled';
    }
  }

  async cancelAllOrders(symbol: string): Promise<void> {
    for (const order of this.orders.values()) {
      if (order.symbol === symbol && order.status === 'open') {
        order.status = 'canceled';
      }
    }
  }

  async fetchOpenOrders(symbol: string): Promise<Order[]> {
    return [...this.orders.values()].filter(
      (o) => o.symbol === symbol && o.status === 'open',
    );
  }

  getQuoteBalance(): number {
    return this.quoteBalance;
  }

  getBaseBalance(symbol: string): number {
    const base = symbol.split('/')[0];
    return this.baseBalances.get(base) ?? 0;
  }

  getClosedOrders(symbol: string): Order[] {
    return [...this.orders.values()].filter(
      (o) => o.symbol === symbol && o.status === 'closed',
    );
  }

  getTotalValueUsdt(symbol: string, currentPrice: number): number {
    const base = symbol.split('/')[0];
    const baseBal = this.baseBalances.get(base) ?? 0;
    return this.quoteBalance + baseBal * currentPrice;
  }

  private async processFills(symbol: string, currentPrice: number): Promise<void> {
    for (const order of this.orders.values()) {
      if (order.symbol !== symbol || order.status !== 'open') continue;

      const filled =
        (order.side === 'buy' && currentPrice <= order.price) ||
        (order.side === 'sell' && currentPrice >= order.price);

      if (!filled) continue;

      const base = symbol.split('/')[0];
      const cost = order.amount * order.price;

      if (order.side === 'buy') {
        if (this.quoteBalance < cost) continue;
        this.quoteBalance -= cost;
        this.baseBalances.set(base, (this.baseBalances.get(base) ?? 0) + order.amount);
      } else {
        const baseBal = this.baseBalances.get(base) ?? 0;
        if (baseBal < order.amount) continue;
        this.baseBalances.set(base, baseBal - order.amount);
        this.quoteBalance += cost;
      }

      order.status = 'closed';
      order.filled = order.amount;
    }
  }
}
