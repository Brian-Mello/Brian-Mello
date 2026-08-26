# Crypto Grid Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar bot CLI de grid trading spot multi-par na Binance com modos paper e live.

**Architecture:** Monolito TypeScript; CCXT para Binance; PaperExchange simula fills; GridEngine gerencia loop por par; SQLite persiste estado; RiskManager aplica kill-switch.

**Tech Stack:** Node.js 20+, TypeScript, CCXT, Commander, Zod, better-sqlite3, Pino, Vitest

## Global Constraints

- Spot only, sem alavancagem
- API keys via env (`BINANCE_API_KEY`, `BINANCE_API_SECRET`)
- Modo padrão: `paper`
- Pares iniciais: BTC/USDT, ETH/USDT (configurável)
- Poll interval: 5000ms
- Sem permissão withdraw na API key

---

### Task 1: Project scaffold

**Files:**
- Create: `grid-bot/package.json`, `grid-bot/tsconfig.json`, `grid-bot/vitest.config.ts`, `grid-bot/.gitignore`, `grid-bot/config.example.yaml`

- [ ] Init npm project with dependencies
- [ ] TypeScript strict config + vitest
- [ ] Example config YAML
- [ ] Commit scaffold

### Task 2: Config loader + schema

**Files:**
- Create: `grid-bot/src/config/schema.ts`, `grid-bot/src/config/loader.ts`
- Test: `grid-bot/tests/config.test.ts`

- [ ] Zod schema for full config
- [ ] YAML loader with env var substitution
- [ ] Tests for valid/invalid config
- [ ] Commit

### Task 3: Grid calculator

**Files:**
- Create: `grid-bot/src/grid/GridCalculator.ts`
- Test: `grid-bot/tests/grid-calculator.test.ts`

- [ ] `calculateLevels(lower, upper, count)` equidistant
- [ ] `getBuyLevels`, `getSellLevels`, `getLevelAbove`, `getLevelBelow`
- [ ] Unit tests
- [ ] Commit

### Task 4: Exchange adapters

**Files:**
- Create: `grid-bot/src/exchange/types.ts`, `grid-bot/src/exchange/BinanceAdapter.ts`, `grid-bot/src/exchange/PaperExchange.ts`
- Test: `grid-bot/tests/paper-exchange.test.ts`

- [ ] Common ExchangeAdapter interface
- [ ] BinanceAdapter via CCXT
- [ ] PaperExchange with virtual balance + fill simulation
- [ ] Tests for paper fills
- [ ] Commit

### Task 5: Storage + risk

**Files:**
- Create: `grid-bot/src/storage/db.ts`, `grid-bot/src/storage/TradeRepository.ts`, `grid-bot/src/risk/RiskManager.ts`, `grid-bot/src/logger.ts`

- [ ] SQLite schema (orders, fills, snapshots, events)
- [ ] TradeRepository CRUD
- [ ] RiskManager drawdown + capital limits
- [ ] Commit

### Task 6: Grid engine + orchestrator

**Files:**
- Create: `grid-bot/src/grid/GridEngine.ts`, `grid-bot/src/BotOrchestrator.ts`

- [ ] Per-pair engine: init grid, poll, replace opposite orders
- [ ] Orchestrator manages multiple pairs + kill-switch
- [ ] Commit

### Task 7: CLI

**Files:**
- Create: `grid-bot/src/cli/commands.ts`, `grid-bot/src/index.ts`
- Create: `grid-bot/docs/SETUP.md`

- [ ] Commands: validate, start, status, stop
- [ ] Graceful shutdown cancels live orders
- [ ] SETUP.md with Binance API setup
- [ ] Commit

### Task 8: Integration test + README

**Files:**
- Create: `grid-bot/README.md`

- [ ] Run vitest all green
- [ ] README with quickstart
- [ ] Final commit + push
