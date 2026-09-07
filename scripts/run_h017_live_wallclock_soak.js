/**
 * LYZER LABS — H017 LIVE WALL-CLOCK SOAK RUNNER (CLI / BACKGROUND DAEMON)
 * Script: run_h017_live_wallclock_soak.js
 * 
 * Usage:
 *   node scripts/run_h017_live_wallclock_soak.js
 * 
 * Objectives:
 * 1. Runs the 7-day wall-clock soak connected to live Binance market data.
 * 2. Enforces Sovereign Veto: $0 live capital.
 * 3. Records daily cryptographic SHA-256 checkpoints in knowledge/operations/live_shadow/h017_soak/.
 * 4. Prints periodic status every 10 minutes.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { H017LiveSoakWorker } from '../packages/lyzer-shared/src/execution/h017_live_soak_worker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const soakDir = process.env.H017_SOAK_DIR || path.resolve(rootDir, 'knowledge/operations/live_shadow/h017_soak');
const pollIntervalMs = parseInt(process.env.H017_SOAK_INTERVAL_MS || '60000', 10);
const initialCapital = parseFloat(process.env.H017_SOAK_INITIAL_CAPITAL || '100000');

console.log('======================================================================');
console.log('  LYZER LABS — H017 LIVE WALL-CLOCK SOAK (7-DAY CONTINUOUS SOAK)');
console.log('======================================================================');

const worker = new H017LiveSoakWorker({
  soakDir,
  pollIntervalMs,
  initialCapital
});

worker.start();

// Status logging every 10 minutes
const statusLogger = setInterval(() => {
  const status = worker.getStatus();
  console.log(`\n📊 [H017 SOAK STATUS @ ${new Date().toISOString()}]`);
  console.log(`   Uptime: ${Math.floor(status.uptimeSeconds / 3600)}h ${Math.floor((status.uptimeSeconds % 3600) / 60)}m (${status.wallClockDaysElapsed.toFixed(4)} / ${status.targetSoakDays} days)`);
  console.log(`   Ticks Processed: ${status.ticksProcessed} | Checkpoints: ${status.dayCheckpointsRecorded}`);
  console.log(`   Simulated Equity: $${status.equity.toFixed(2)} (${status.pnlPct >= 0 ? '+' : ''}${status.pnlPct.toFixed(4)}%)`);
  console.log(`   Active Positions: ${status.positions.join(', ') || 'None'}`);
  console.log(`   Kill-Switches Halted: ${status.killSwitchesHalted ? 'YES (' + status.activeKillSwitch + ')' : 'NO (Healthy)'}`);
  console.log(`   Sovereign Veto: STRICTLY ENFORCED ($0 real capital at risk)\n`);
}, 10 * 60 * 1000);

// Graceful Shutdown
const shutdown = () => {
  console.log('\n🛑 [SHUTDOWN] Interruption signal received. Stopping H017 live soak...');
  clearInterval(statusLogger);
  worker.stop();
  const finalStatus = worker.getStatus();
  console.log('Final Soak Summary:', finalStatus);
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
