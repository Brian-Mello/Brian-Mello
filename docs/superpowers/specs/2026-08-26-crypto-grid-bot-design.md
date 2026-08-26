# Bot de Grid Trading Cripto — Design Spec

**Data:** 2026-08-26  
**Status:** Aprovada — MVP implementado  
**Autor:** Brian-Mello + Cursor Agent

---

## 1. Resumo

Bot automatizado de **grid trading spot** na **Binance**, operando **múltiplos pares** configuráveis (ex.: BTC/USDT, ETH/USDT). Controle via **CLI + arquivo YAML**. Modo **paper trading** primeiro; depois **live** com capital pequeno. Dashboard web fica fora do escopo do MVP.

**Objetivo de negócio:** capturar lucro em mercados laterais comprando em níveis baixos e vendendo em níveis altos, repetidamente.

**Aviso:** trading automatizado não garante lucro. O bot executa a estratégia; resultado depende de mercado, parâmetros e gestão de risco.

---

## 2. Decisões confirmadas

| Decisão | Escolha |
|---------|---------|
| Estratégia | Grid trading |
| Mercado | Spot (sem alavancagem) |
| Exchange | Binance |
| Pares | Vários (configurável; MVP inicia com BTC/USDT + ETH/USDT) |
| Interface | CLI + YAML agora; dashboard depois |
| Validação | Paper → capital real pequeno |
| Stack | Node.js + TypeScript + CCXT |

---

## 3. Arquitetura

### 3.1 Visão geral

Monolito Node.js/TypeScript em um único processo. Módulos com responsabilidade única, comunicando por interfaces TypeScript bem definidas.

```
┌─────────────────────────────────────────────────────────┐
│                      CLI (commander)                     │
│  start | stop | status | backtest-paper | config validate│
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    Bot Orchestrator                      │
│  - carrega config                                        │
│  - inicia/para loops por par                             │
│  - aplica kill-switch global                             │
└──────┬──────────────┬──────────────┬────────────────────┘
       │              │              │
┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼──────┐
│ GridEngine  │ │ Exchange  │ │  Storage   │
│ (por par)   │ │ (CCXT)    │ │ (SQLite)   │
└─────────────┘ └───────────┘ └────────────┘
```

### 3.2 Componentes

| Módulo | Responsabilidade |
|--------|------------------|
| `config/` | Carregar e validar YAML (Zod) |
| `exchange/BinanceAdapter` | Wrapper CCXT: preço, ordens, saldo, rate limit |
| `grid/GridCalculator` | Calcular níveis entre lower/upper com N grids |
| `grid/GridEngine` | Loop por par: monitorar ordens, recolocar opostas |
| `paper/PaperExchange` | Simula execução usando preços reais da API |
| `storage/TradeRepository` | Persistir ordens, fills, PnL em SQLite |
| `risk/RiskManager` | Limites de capital, stop-loss, max drawdown |
| `cli/` | Comandos de operação |
| `logger/` | Logs estruturados (pino) |

### 3.3 Fluxo de dados (grid)

1. **Inicialização:** para cada par, obtém preço atual via API.
2. **Cálculo:** divide faixa `[lower_price, upper_price]` em `grid_count` níveis equidistantes.
3. **Alocação:** divide `capital_usdt` do par igualmente entre grids de compra abaixo do preço atual.
4. **Ordens iniciais:** coloca limit buys nos níveis abaixo; limit sells nos níveis acima (se houver inventário).
5. **Loop (a cada 5–10s):**
   - Consulta ordens abertas e fills recentes.
   - Se buy executou → coloca sell no nível acima.
   - Se sell executou → coloca buy no nível abaixo.
   - Atualiza PnL e persiste no SQLite.
6. **Saída:** se preço sai da faixa ou kill-switch ativa → cancela ordens e para o par.

### 3.4 Modos de operação

| Modo | Comportamento |
|------|---------------|
| `paper` | Usa preços reais; simula fills quando preço cruza nível; saldo virtual |
| `live` | Ordens reais na Binance via CCXT |

Transição paper → live: mesma config, troca `mode: live` e credenciais API.

---

## 4. Configuração (YAML)

```yaml
mode: paper  # paper | live

binance:
  api_key: ${BINANCE_API_KEY}
  api_secret: ${BINANCE_API_SECRET}
  testnet: false  # true para testnet Binance (opcional)

global:
  poll_interval_ms: 5000
  max_total_capital_usdt: 500
  kill_switch_drawdown_pct: 10  # para tudo se perda > 10%

pairs:
  - symbol: BTC/USDT
    lower_price: 90000
    upper_price: 110000
    grid_count: 10
    capital_usdt: 300

  - symbol: ETH/USDT
    lower_price: 3000
    upper_price: 4500
    grid_count: 10
    capital_usdt: 200
```

Validação na inicialização:
- `lower_price < upper_price`
- `grid_count >= 2`
- `capital_usdt` respeita `max_total_capital_usdt`
- Soma de `capital_usdt` dos pares ≤ `max_total_capital_usdt`
- Valores mínimos de ordem da Binance (LOT_SIZE, MIN_NOTIONAL)

---

## 5. Gestão de risco

| Regra | Descrição |
|-------|-----------|
| Capital por par | Limite fixo em USDT; nunca excede config |
| Kill-switch drawdown | Para bot se PnL acumulado cair abaixo do limite % |
| Fora da faixa | Se preço > upper ou < lower: cancela ordens, alerta, aguarda reconfig manual |
| API key | Permissão **apenas spot trade**; **sem withdraw** |
| Rate limit | CCXT `enableRateLimit: true`; backoff exponencial em 429 |
| Ordem mínima | Valida MIN_NOTIONAL antes de enviar |

---

## 6. Persistência (SQLite)

Tabelas:

- `orders` — id, pair, side, price, amount, status, mode, created_at
- `fills` — order_id, price, amount, fee, filled_at
- `snapshots` — pair, total_value_usdt, pnl_usdt, recorded_at
- `events` — type, message, metadata_json, created_at

CLI `status` lê essas tabelas para exibir PnL, ordens abertas e último evento.

---

## 7. CLI (MVP)

| Comando | Descrição |
|---------|-----------|
| `grid-bot validate --config config.yaml` | Valida config sem iniciar |
| `grid-bot start --config config.yaml` | Inicia bot (foreground) |
| `grid-bot status` | PnL, ordens abertas, uptime |
| `grid-bot stop` | Envia SIGTERM graceful (cancela ordens se live) |

Logs em stdout + arquivo rotativo `logs/bot.log`.

---

## 8. Tratamento de erros

| Cenário | Ação |
|---------|------|
| API indisponível | Retry 3x com backoff; se falhar, pausa par e loga |
| Ordem rejeitada (MIN_NOTIONAL) | Loga warning, pula nível, continua |
| Saldo insuficiente | Para par, alerta no log |
| Preço fora da faixa | Cancela ordens do par, estado `OUT_OF_RANGE` |
| Crash do processo | Ordens ficam na exchange (live); restart manual com `start` |
| SIGTERM/SIGINT | Cancela ordens abertas (live), flush SQLite, exit 0 |

---

## 9. Testes

| Tipo | Escopo |
|------|--------|
| Unit | `GridCalculator`, validação config, `RiskManager` |
| Integration | `PaperExchange` com preços mockados |
| Manual | Paper trading 24–48h antes de live |

Framework: **Vitest**.

Cobertura mínima MVP: cálculo de grid, recolocação de ordens opostas, kill-switch.

---

## 10. Estrutura de pastas

```
grid-bot/
├── package.json
├── tsconfig.json
├── config.example.yaml
├── src/
│   ├── index.ts              # entry CLI
│   ├── cli/
│   │   └── commands.ts
│   ├── config/
│   │   ├── schema.ts         # Zod
│   │   └── loader.ts
│   ├── exchange/
│   │   ├── types.ts
│   │   ├── BinanceAdapter.ts
│   │   └── PaperExchange.ts
│   ├── grid/
│   │   ├── GridCalculator.ts
│   │   └── GridEngine.ts
│   ├── risk/
│   │   └── RiskManager.ts
│   ├── storage/
│   │   ├── db.ts
│   │   └── TradeRepository.ts
│   └── logger.ts
├── tests/
│   ├── grid-calculator.test.ts
│   ├── config.test.ts
│   └── paper-exchange.test.ts
└── docs/
    └── SETUP.md
```

---

## 11. Escopo MVP vs. futuro

### MVP (esta entrega)

- [x] Spec completa
- [ ] Projeto TS + CCXT + Vitest
- [ ] Grid engine multi-par
- [ ] Modo paper
- [ ] Modo live Binance spot
- [ ] CLI (start/stop/status/validate)
- [ ] SQLite + logs
- [ ] Gestão de risco básica
- [ ] README + SETUP.md

### Fase 2 (dashboard)

- API REST (Fastify) expondo status/PnL
- Frontend Next.js: gráfico de grid, toggle pares, histórico
- Notificações (Telegram/Discord webhook)
- Auto-ajuste de faixa (opcional, avançado)

---

## 12. Dependências principais

| Pacote | Uso |
|--------|-----|
| `ccxt` | API Binance |
| `commander` | CLI |
| `zod` | Validação config |
| `better-sqlite3` | Persistência |
| `pino` | Logs |
| `yaml` | Parse config |
| `vitest` | Testes |
| `typescript` | Linguagem |

---

## 13. Segurança

- API keys via variáveis de ambiente (nunca no YAML commitado)
- `.env` no `.gitignore`
- Permissões mínimas na Binance
- Sem lógica de withdraw no código

---

## 14. Critérios de sucesso do MVP

1. `grid-bot validate` passa com config de exemplo
2. Paper mode roda 1h+ sem crash, recolocando ordens simuladas
3. `status` mostra PnL e ordens corretamente
4. Live mode coloca e cancela ordens reais (teste com capital mínimo)
5. Kill-switch para bot quando drawdown atinge limite

---

## 15. Riscos conhecidos

| Risco | Mitigação |
|-------|-----------|
| Mercado tendencial (não lateral) | Grid perde vs. buy-and-hold; documentar limitação |
| Taxas comem lucro | Usar BNB para desconto; grids com spacing > 2× taxa |
| Bug cancela ordens erradas | Paper extensivo; capital pequeno no live |
| Regulatório (Brasil) | Uso pessoal; não custodiar fundos de terceiros no MVP |

---

*Spec pronta para review. Após aprovação, seguir para plano de implementação.*
