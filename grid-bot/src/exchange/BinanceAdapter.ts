import ccxt, { type Exchange as CcxtExchange, type Order as CcxtOrder } from 'ccxt';
import type { BotConfig } from '../config/schema.js';
import type { ExchangeAdapter, Order, OrderSide, Ticker } from './types.js';

export class BinanceAdapter implements ExchangeAdapter {
  readonly mode = 'live' as const;
  private exchange: CcxtExchange;

  constructor(config: BotConfig) {
    this.exchange = new ccxt.binance({
      apiKey: config.binance.api_key,
      secret: config.binance.api_secret,
      enableRateLimit: true,
      options: {
        defaultType: 'spot',
      },
    });

    if (config.binance.testnet) {
      this.exchange.setSandboxMode(true);
    }
  }

  async fetchTicker(symbol: string): Promise<Ticker> {
    const ticker = await this.exchange.fetchTicker(symbol);
    return {
      last: ticker.last ?? 0,
      bid: ticker.bid,
      ask: ticker.ask,
    };
  }

  async createLimitOrder(
    symbol: string,
    side: OrderSide,
    amount: number,
    price: number,
  ): Promise<Order> {
    const result = await this.exchange.createOrder(symbol, 'limit', side, amount, price);
    return this.mapOrder(result);
  }

  async cancelOrder(orderId: string, symbol: string): Promise<void> {
    await this.exchange.cancelOrder(orderId, symbol);
  }

  async cancelAllOrders(symbol: string): Promise<void> {
    const open = await this.fetchOpenOrders(symbol);
    await Promise.all(open.map((o) => this.cancelOrder(o.id, symbol)));
  }

  async fetchOpenOrders(symbol: string): Promise<Order[]> {
    const orders = await this.exchange.fetchOpenOrders(symbol);
    return orders.map((o: CcxtOrder) => this.mapOrder(o));
  }

  getQuoteBalance(): number {
    throw new Error('Use fetchBalances() for live mode');
  }

  getBaseBalance(_symbol: string): number {
    throw new Error('Use fetchBalances() for live mode');
  }

  async fetchBalances(): Promise<{ quote: number; base: number; symbol: string }[]> {
    const balance = await this.exchange.fetchBalance();
    const totals = balance.total as unknown as Record<string, number>;
    return Object.keys(totals)
      .filter((asset) => (totals[asset] ?? 0) > 0)
      .map((asset) => ({
        symbol: asset,
        quote: totals[asset] ?? 0,
        base: totals[asset] ?? 0,
      }));
  }

  private mapOrder(raw: CcxtOrder): Order {
    return {
      id: String(raw.id ?? ''),
      symbol: String(raw.symbol ?? ''),
      side: raw.side as OrderSide,
      price: raw.price ?? 0,
      amount: raw.amount ?? 0,
      status: raw.status === 'open' ? 'open' : raw.status === 'canceled' ? 'canceled' : 'closed',
      filled: raw.filled ?? 0,
      createdAt: raw.timestamp ?? Date.now(),
    };
  }
}

export class PublicPriceFeed {
  private exchange: CcxtExchange;

  constructor() {
    this.exchange = new ccxt.binance({ enableRateLimit: true });
  }

  async fetchTicker(symbol: string): Promise<Ticker> {
    const ticker = await this.exchange.fetchTicker(symbol);
    return {
      last: ticker.last ?? 0,
      bid: ticker.bid,
      ask: ticker.ask,
    };
  }
}
