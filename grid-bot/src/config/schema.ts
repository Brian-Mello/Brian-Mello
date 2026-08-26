import { z } from 'zod';

export const pairConfigSchema = z.object({
  symbol: z.string().regex(/^[A-Z0-9]+\/[A-Z0-9]+$/),
  lower_price: z.number().positive(),
  upper_price: z.number().positive(),
  grid_count: z.number().int().min(2),
  capital_usdt: z.number().positive(),
}).refine((p) => p.lower_price < p.upper_price, {
  message: 'lower_price must be less than upper_price',
});

export const botConfigSchema = z.object({
  mode: z.enum(['paper', 'live']),
  binance: z.object({
    api_key: z.string().optional(),
    api_secret: z.string().optional(),
    testnet: z.boolean().default(false),
  }),
  global: z.object({
    poll_interval_ms: z.number().int().min(1000).default(5000),
    max_total_capital_usdt: z.number().positive(),
    kill_switch_drawdown_pct: z.number().min(0).max(100).default(10),
  }),
  pairs: z.array(pairConfigSchema).min(1),
}).superRefine((config, ctx) => {
  const totalCapital = config.pairs.reduce((sum, p) => sum + p.capital_usdt, 0);
  if (totalCapital > config.global.max_total_capital_usdt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Total capital (${totalCapital}) exceeds max_total_capital_usdt (${config.global.max_total_capital_usdt})`,
      path: ['pairs'],
    });
  }

  if (config.mode === 'live') {
    if (!config.binance.api_key || !config.binance.api_secret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'API key and secret are required for live mode',
        path: ['binance'],
      });
    }
  }
});

export type PairConfig = z.infer<typeof pairConfigSchema>;
export type BotConfig = z.infer<typeof botConfigSchema>;
