# Setup — Grid Bot Binance

## 1. Criar API Key na Binance

1. Acesse [Binance API Management](https://www.binance.com/en/my/settings/api-management)
2. Crie uma nova API key
3. Permissões necessárias:
   - ✅ Enable Spot & Margin Trading
   - ❌ Enable Withdrawals (NUNCA habilite)
4. Restrinja IP se possível

## 2. Variáveis de ambiente

```bash
export BINANCE_API_KEY="sua_api_key"
export BINANCE_API_SECRET="seu_api_secret"
```

Ou crie `.env` (não commite):

```
BINANCE_API_KEY=sua_api_key
BINANCE_API_SECRET=seu_api_secret
```

## 3. Configurar pares

Edite `config.yaml` baseado em `config.example.yaml`:

- `lower_price` / `upper_price`: faixa onde o grid opera
- `grid_count`: mais grids = mais trades, menos lucro por trade
- `capital_usdt`: capital por par

**Regra:** spacing entre grids deve ser > 2× a taxa da Binance (~0.2%) para ser lucrativo.

## 4. Paper trading primeiro

```bash
# mode: paper no config — não precisa de API key
npm run dev start -- --config config.yaml
```

Rode 24–48h observando logs e PnL simulado.

## 5. Live com capital pequeno

```yaml
mode: live
```

Comece com capital mínimo (ex.: 50–100 USDT total) para validar execução real.

## 6. Monitoramento

- Logs em stdout (pino-pretty em dev)
- SQLite em `data/grid-bot.db`
- `grid-bot status` mostra PnL e ordens abertas

## Troubleshooting

| Problema | Solução |
|----------|---------|
| MIN_NOTIONAL error | Aumente capital ou reduza grid_count |
| OUT_OF_RANGE | Preço saiu da faixa; ajuste lower/upper |
| Kill switch | Drawdown atingiu limite; revise parâmetros |
