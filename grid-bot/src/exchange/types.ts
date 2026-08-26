export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'open' | 'closed' | 'canceled';

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  price: number;
  amount: number;
  status: OrderStatus;
  filled: number;
  createdAt: number;
}

export interface Ticker {
  last: number;
  bid?: number;
  ask?: number;
}

export interface ExchangeAdapter {
  readonly mode: 'paper' | 'live';
  fetchTicker(symbol: string): Promise<Ticker>;
  createLimitOrder(symbol: string, side: OrderSide, amount: number, price: number): Promise<Order>;
  cancelOrder(orderId: string, symbol: string): Promise<void>;
  cancelAllOrders(symbol: string): Promise<void>;
  fetchOpenOrders(symbol: string): Promise<Order[]>;
  getQuoteBalance(): number;
  getBaseBalance(symbol: string): number;
}
