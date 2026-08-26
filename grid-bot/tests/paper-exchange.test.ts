import { describe, it, expect, beforeEach } from 'vitest';
import { PaperExchange } from '../src/exchange/PaperExchange.js';
import type { Ticker } from '../src/exchange/types.js';

class MockPriceFeed {
  private prices = new Map<string, number>();

  setPrice(symbol: string, price: number): void {
    this.prices.set(symbol, price);
  }

  async fetchTicker(symbol: string): Promise<Ticker> {
    return { last: this.prices.get(symbol) ?? 0 };
  }
}

describe('PaperExchange', () => {
  let feed: MockPriceFeed;
  let exchange: PaperExchange;

  beforeEach(() => {
    feed = new MockPriceFeed();
    exchange = new PaperExchange(1000, feed as unknown as import('../src/exchange/BinanceAdapter.js').PublicPriceFeed);
    feed.setPrice('BTC/USDT', 100000);
  });

  it('creates and tracks open orders', async () => {
    const order = await exchange.createLimitOrder('BTC/USDT', 'buy', 0.001, 99000);
    const open = await exchange.fetchOpenOrders('BTC/USDT');
    expect(open).toHaveLength(1);
    expect(open[0].id).toBe(order.id);
  });

  it('fills buy order when price drops to level', async () => {
    await exchange.createLimitOrder('BTC/USDT', 'buy', 0.001, 99000);
    feed.setPrice('BTC/USDT', 98000);
    await exchange.fetchTicker('BTC/USDT');

    const open = await exchange.fetchOpenOrders('BTC/USDT');
    expect(open).toHaveLength(0);
    expect(exchange.getBaseBalance('BTC/USDT')).toBeCloseTo(0.001, 6);
  });

  it('fills sell order when price rises to level', async () => {
    exchange = new PaperExchange(1000, feed as unknown as import('../src/exchange/BinanceAdapter.js').PublicPriceFeed);
    feed.setPrice('BTC/USDT', 100000);

    await exchange.createLimitOrder('BTC/USDT', 'buy', 0.001, 100000);
    feed.setPrice('BTC/USDT', 100000);
    await exchange.fetchTicker('BTC/USDT');

    await exchange.createLimitOrder('BTC/USDT', 'sell', 0.001, 101000);
    feed.setPrice('BTC/USDT', 101000);
    await exchange.fetchTicker('BTC/USDT');

    const open = await exchange.fetchOpenOrders('BTC/USDT');
    expect(open).toHaveLength(0);
  });

  it('cancels all orders for symbol', async () => {
    await exchange.createLimitOrder('BTC/USDT', 'buy', 0.001, 99000);
    await exchange.createLimitOrder('BTC/USDT', 'buy', 0.001, 98000);
    await exchange.cancelAllOrders('BTC/USDT');
    const open = await exchange.fetchOpenOrders('BTC/USDT');
    expect(open).toHaveLength(0);
  });
});
