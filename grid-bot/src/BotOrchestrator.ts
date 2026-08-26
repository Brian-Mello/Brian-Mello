import type { BotConfig } from './config/schema.js';
import { BinanceAdapter } from './exchange/BinanceAdapter.js';
import { PaperExchange } from './exchange/PaperExchange.js';
import type { ExchangeAdapter } from './exchange/types.js';
import { GridEngine } from './grid/GridEngine.js';
import { logger } from './logger.js';
import { RiskManager } from './risk/RiskManager.js';
import { closeDb } from './storage/db.js';
import { TradeRepository } from './storage/TradeRepository.js';

export class BotOrchestrator {
  private engines: GridEngine[] = [];
  private exchanges: ExchangeAdapter[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private riskManager: RiskManager;
  private repository: TradeRepository;
  private startedAt: number | null = null;

  constructor(private readonly config: BotConfig) {
    this.riskManager = new RiskManager(config);
    this.repository = new TradeRepository();
  }

  async start(): Promise<void> {
    this.startedAt = Date.now();
    this.exchanges = this.createExchanges();
    this.engines = this.config.pairs.map((pair, index) =>
      new GridEngine(pair, this.exchanges[index] ?? this.exchanges[0], this.repository, this.config.mode),
    );

    for (const engine of this.engines) {
      await engine.start();
    }

    this.intervalId = setInterval(() => {
      void this.tick();
    }, this.config.global.poll_interval_ms);

    logger.info({ pairs: this.config.pairs.map((p) => p.symbol) }, 'Bot orchestrator started');
  }

  async tick(): Promise<void> {
    for (const engine of this.engines) {
      await engine.tick();
    }

    await this.updateRisk();
    if (this.riskManager.checkKillSwitch()) {
      logger.error({ drawdown: this.riskManager.getDrawdownPct() }, 'Kill switch triggered');
      this.repository.logEvent('KILL_SWITCH', 'Drawdown limit reached', {
        drawdownPct: this.riskManager.getDrawdownPct(),
      });
      await this.stop();
    }
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    for (const engine of this.engines) {
      await engine.stop();
    }

    closeDb();
    logger.info('Bot orchestrator stopped');
  }

  getStatus(): {
    uptimeMs: number;
    pnl: number;
    drawdownPct: number;
    snapshots: ReturnType<TradeRepository['getLatestSnapshots']>;
    latestEvent: ReturnType<TradeRepository['getLatestEvent']>;
    openOrders: ReturnType<TradeRepository['getOpenOrders']>;
  } {
    return {
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
      pnl: this.riskManager.getPnl(),
      drawdownPct: this.riskManager.getDrawdownPct(),
      snapshots: this.repository.getLatestSnapshots(),
      latestEvent: this.repository.getLatestEvent(),
      openOrders: this.repository.getOpenOrders(),
    };
  }

  private createExchanges(): ExchangeAdapter[] {
    if (this.config.mode === 'live') {
      const adapter = new BinanceAdapter(this.config);
      return this.config.pairs.map(() => adapter);
    }

    return this.config.pairs.map((pair) =>
      new PaperExchange(pair.capital_usdt),
    );
  }

  private async updateRisk(): Promise<void> {
    let totalValue = 0;
    for (let i = 0; i < this.engines.length; i++) {
      const pair = this.config.pairs[i];
      const exchange = this.exchanges[i];
      if (!pair || !exchange) continue;
      const ticker = await exchange.fetchTicker(pair.symbol);
      totalValue += this.engines[i].getPortfolioValue(ticker.last);
    }
    this.riskManager.updatePortfolioValue(totalValue);
  }
}

let activeOrchestrator: BotOrchestrator | null = null;

export function getActiveOrchestrator(): BotOrchestrator | null {
  return activeOrchestrator;
}

export function setActiveOrchestrator(orchestrator: BotOrchestrator | null): void {
  activeOrchestrator = orchestrator;
}

export async function startBot(config: BotConfig): Promise<BotOrchestrator> {
  const orchestrator = new BotOrchestrator(config);
  setActiveOrchestrator(orchestrator);
  await orchestrator.start();
  return orchestrator;
}

export async function stopBot(): Promise<void> {
  if (activeOrchestrator) {
    await activeOrchestrator.stop();
    setActiveOrchestrator(null);
  }
}
