# Grid Bot — Trading Cripto

Bot de **grid trading spot** multi-par na Binance. Compra em níveis baixos e vende em níveis altos automaticamente.

## Quickstart

```bash
cd grid-bot
npm install
npm run validate   # valida config.example.yaml
npm test           # roda testes
npm run dev start -- --config config.example.yaml
```

## Modos

| Modo | Descrição |
|------|-----------|
| `paper` | Simula ordens com preços reais da Binance (sem API key) |
| `live` | Ordens reais — requer `BINANCE_API_KEY` e `BINANCE_API_SECRET` |

## Configuração

Copie `config.example.yaml` e ajuste:

```yaml
mode: paper
pairs:
  - symbol: BTC/USDT
    lower_price: 90000    # preço mínimo do grid
    upper_price: 110000   # preço máximo do grid
    grid_count: 10        # número de níveis
    capital_usdt: 300     # capital alocado neste par
```

## Comandos CLI

```bash
grid-bot validate --config config.yaml
grid-bot start --config config.yaml
grid-bot status
grid-bot stop
```

## Gestão de risco

- Kill-switch por drawdown configurável
- Cancelamento automático se preço sair da faixa
- API key **sem permissão de saque**

## Aviso

Trading automatizado **não garante lucro**. Grid funciona melhor em mercados laterais. Teste extensivamente em paper antes de usar capital real.

Veja [docs/SETUP.md](docs/SETUP.md) para configurar API da Binance.
