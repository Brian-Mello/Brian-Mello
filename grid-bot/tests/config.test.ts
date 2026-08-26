import { describe, it, expect } from 'vitest';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig, validateConfig } from '../src/config/loader.js';

describe('Config loader', () => {
  const validYaml = `
mode: paper
binance:
  api_key: ""
  api_secret: ""
  testnet: false
global:
  poll_interval_ms: 5000
  max_total_capital_usdt: 500
  kill_switch_drawdown_pct: 10
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
`;

  it('loads valid config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'grid-bot-'));
    const path = join(dir, 'config.yaml');
    writeFileSync(path, validYaml);
    const config = loadConfig(path);
    expect(config.mode).toBe('paper');
    expect(config.pairs).toHaveLength(2);
    unlinkSync(path);
  });

  it('rejects capital exceeding max', () => {
    const dir = mkdtempSync(join(tmpdir(), 'grid-bot-'));
    const path = join(dir, 'config.yaml');
    writeFileSync(path, validYaml.replace('max_total_capital_usdt: 500', 'max_total_capital_usdt: 100'));
    const result = validateConfig(path);
    expect(result.valid).toBe(false);
    unlinkSync(path);
  });

  it('requires API keys for live mode', () => {
    const dir = mkdtempSync(join(tmpdir(), 'grid-bot-'));
    const path = join(dir, 'config.yaml');
    writeFileSync(path, validYaml.replace('mode: paper', 'mode: live'));
    const result = validateConfig(path);
    expect(result.valid).toBe(false);
    unlinkSync(path);
  });
});
