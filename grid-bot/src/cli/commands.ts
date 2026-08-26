import { Command } from 'commander';
import { loadConfig, validateConfig } from '../config/loader.js';
import { startBot, stopBot, getActiveOrchestrator } from '../BotOrchestrator.js';
import { logger } from '../logger.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('grid-bot')
    .description('Bot de grid trading spot multi-par na Binance')
    .version('0.1.0');

  program
    .command('validate')
    .description('Valida arquivo de configuração')
    .requiredOption('-c, --config <path>', 'Caminho do config YAML')
    .action((options: { config: string }) => {
      const result = validateConfig(options.config);
      if (result.valid && result.config) {
        console.log('✓ Config válida');
        console.log(`  Modo: ${result.config.mode}`);
        console.log(`  Pares: ${result.config.pairs.map((p) => p.symbol).join(', ')}`);
        console.log(`  Capital total: ${result.config.pairs.reduce((s, p) => s + p.capital_usdt, 0)} USDT`);
        process.exit(0);
      } else {
        console.error('✗ Config inválida:');
        for (const err of result.errors ?? []) {
          console.error(`  - ${err}`);
        }
        process.exit(1);
      }
    });

  program
    .command('start')
    .description('Inicia o bot de grid trading')
    .requiredOption('-c, --config <path>', 'Caminho do config YAML')
    .action(async (options: { config: string }) => {
      const config = loadConfig(options.config);
      logger.info({ mode: config.mode, pairs: config.pairs.length }, 'Starting grid bot');

      const orchestrator = await startBot(config);

      const shutdown = async (signal: string) => {
        logger.info({ signal }, 'Shutdown signal received');
        await orchestrator.stop();
        process.exit(0);
      };

      process.on('SIGINT', () => void shutdown('SIGINT'));
      process.on('SIGTERM', () => void shutdown('SIGTERM'));
    });

  program
    .command('status')
    .description('Mostra status do bot (requer bot em execução neste processo)')
    .action(() => {
      const orchestrator = getActiveOrchestrator();
      if (!orchestrator) {
        console.log('Bot não está em execução neste processo.');
        console.log('Use "start" para iniciar o bot.');
        process.exit(1);
      }

      const status = orchestrator.getStatus();
      const uptimeMin = Math.floor(status.uptimeMs / 60000);

      console.log('\n=== Grid Bot Status ===');
      console.log(`Uptime: ${uptimeMin} min`);
      console.log(`PnL: ${status.pnl.toFixed(2)} USDT`);
      console.log(`Drawdown: ${status.drawdownPct.toFixed(2)}%`);
      console.log(`Ordens abertas: ${status.openOrders.length}`);

      if (status.snapshots.length > 0) {
        console.log('\nSnapshots por par:');
        for (const snap of status.snapshots) {
          console.log(`  ${snap.pair}: ${snap.totalValueUsdt.toFixed(2)} USDT (PnL: ${snap.pnlUsdt.toFixed(2)})`);
        }
      }

      if (status.latestEvent) {
        console.log(`\nÚltimo evento: [${status.latestEvent.type}] ${status.latestEvent.message}`);
      }
    });

  program
    .command('stop')
    .description('Para o bot em execução neste processo')
    .action(async () => {
      if (!getActiveOrchestrator()) {
        console.log('Nenhum bot em execução.');
        process.exit(1);
      }
      await stopBot();
      console.log('Bot parado.');
    });

  return program;
}
