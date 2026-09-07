/**
 * LYZER LABS — H017 TESTNET SHADOW SOAK RUNNER (PHASE 1)
 * Module: h017_shadow_soak_runner.js
 * 
 * Objectives:
 * 1. Operational live shadow execution for confirmed hypothesis H017.
 * 2. Absolute Fail-Closed Sovereign Veto against live capital order transmission.
 * 3. Continuous tick processing for multi-asset prices, native assets (depeg check), and funding rates.
 * 4. Periodic evaluation of the 5 production kill-switches (K1-K5).
 * 5. Forensic daily checkpoints stored in knowledge/operations/live_shadow/h017_soak/.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { H017ProductionCarryModule } from './h017_production_carry_module.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class H017ShadowSoakRunner {
  constructor(config = {}) {
    this.module = new H017ProductionCarryModule(config.moduleConfig || {});
    this.soakDir = config.soakDir || path.resolve(process.cwd(), 'knowledge/operations/live_shadow/h017_soak');
    
    if (!fs.existsSync(this.soakDir)) {
      fs.mkdirSync(this.soakDir, { recursive: true });
    }

    this.checkpointsFile = path.join(this.soakDir, 'h017_daily_checkpoints.jsonl');
    this.eventsFile = path.join(this.soakDir, 'h017_soak_events.jsonl');

    this.ticksProcessed = 0;
    this.lastCheckpointTimestamp = 0;
    this.startTime = Date.now();
    this.dayCount = 0;

    this.shadowOrdersLog = [];
    this.killSwitchTrips = [];
  }

  /**
   * Sovereign Veto against any real live capital execution.
   */
  executeRealOrder(orderIntent) {
    const vetoError = `🚨 [SOVEREIGN VETO] Tentativa ilegal de envio de ordem real para exchange! H017 está estritamente em Fase 1 de Shadow Soak (permissão somente observacional). Capital autorizado em risco: $0.`;
    console.error(vetoError);
    throw new Error(vetoError);
  }

  /**
   * Ingest and process a market data tick.
   * @param {Object} tickData
   * @param {number} tickData.timestampMs
   * @param {Object} tickData.prices - Map of symbol -> current spot price
   * @param {Object} tickData.nativePrices - Map of symbol -> native price (for depeg check)
   * @param {Object} tickData.fundingRates - Map of symbol -> 8h funding rate
   * @param {Object} tickData.trailingGrossRates - Map of symbol -> 30d trailing gross yield %
   * @returns {Object} Tick processing result
   */
  processTick(tickData) {
    this.ticksProcessed++;
    const { timestampMs, prices, nativePrices, fundingRates, trailingGrossRates } = tickData;

    // 1. Evaluate rebalancing if trailing rates provided
    let rebalanceResult = null;
    if (trailingGrossRates) {
      rebalanceResult = this.module.evaluateRebalance(timestampMs, trailingGrossRates, prices);
      if (rebalanceResult.triggered && rebalanceResult.atomicOrdersCount > 0) {
        for (const order of rebalanceResult.atomicOrders) {
          const shadowRecord = {
            timestampMs,
            orderId: order.orderId,
            symbol: order.symbol,
            action: order.action,
            notionalUSD: order.notionalUSD,
            deltaNeutral: order.deltaNeutral,
            executedInShadow: true
          };
          this.shadowOrdersLog.push(shadowRecord);
          this.logEvent('SHADOW_REBALANCE_ORDER', shadowRecord);
        }
      }
    }

    // 2. Check 5 Kill Switches
    const killCheck = this.module.checkKillSwitches(prices, nativePrices || {});
    if (killCheck.tripped) {
      const tripEvent = {
        timestampMs,
        switchCode: killCheck.activeKillSwitch,
        reason: killCheck.reason,
        emergencyOrdersCount: killCheck.emergencyOrders?.length || 0
      };
      this.killSwitchTrips.push(tripEvent);
      this.logEvent('KILL_SWITCH_TRIPPED', tripEvent);
    }

    // 3. Accrue settlements if applicable
    if (fundingRates) {
      this.module.applyFundingSettlement(fundingRates, 8);
    }
    this.module.applyStakingYield(1 / 3); // 8h fraction of day
    this.module.applyBorrowingCost(8 * 3600); // 8h in seconds

    // 4. Daily Checkpoint Check (every 24h = 86,400,000 ms)
    if (this.lastCheckpointTimestamp === 0 || (timestampMs - this.lastCheckpointTimestamp >= 86400000)) {
      this.dayCount++;
      this.lastCheckpointTimestamp = timestampMs;
      this.recordDailyCheckpoint(timestampMs);
    }

    return {
      ticksProcessed: this.ticksProcessed,
      equity: this.module.equity,
      activePositions: Array.from(this.module.positions.keys()),
      rebalanceTriggered: rebalanceResult?.triggered || false,
      killSwitchActive: this.module.halted,
      activeKillSwitch: this.module.activeKillSwitch
    };
  }

  /**
   * Record daily forensic state checkpoint.
   */
  recordDailyCheckpoint(timestampMs) {
    const checkpoint = {
      day: this.dayCount,
      timestampMs,
      timestampUTC: new Date(timestampMs).toISOString(),
      equity: Number(this.module.equity.toFixed(2)),
      maxEquity: Number(this.module.maxEquity.toFixed(2)),
      drawdownPct: Number((((this.module.maxEquity - this.module.equity) / this.module.maxEquity) * 100).toFixed(2)),
      activePositionsCount: this.module.positions.size,
      activeAssets: Array.from(this.module.positions.keys()),
      cumulativeFundingUSD: Number(this.module.cumulativeFundingCollectedUSD.toFixed(2)),
      cumulativeStakingUSD: Number(this.module.cumulativeStakingYieldUSD.toFixed(2)),
      cumulativeFeesUSD: Number(this.module.cumulativeFeesPaidUSD.toFixed(2)),
      cumulativeBorrowCostUSD: Number(this.module.cumulativeBorrowCostUSD.toFixed(2)),
      turnoverEventsCount: this.module.turnoverEventsCount,
      killSwitchHalted: this.module.halted,
      activeKillSwitch: this.module.activeKillSwitch
    };

    const line = JSON.stringify(checkpoint);
    const hash = crypto.createHash('sha256').update(line).digest('hex');
    const signedLine = JSON.stringify({ ...checkpoint, sha256: hash }) + '\n';

    fs.appendFileSync(this.checkpointsFile, signedLine);
    return checkpoint;
  }

  logEvent(eventType, payload) {
    const event = {
      eventType,
      timestampUTC: new Date().toISOString(),
      payload
    };
    fs.appendFileSync(this.eventsFile, JSON.stringify(event) + '\n');
  }

  getMetricsSummary() {
    return {
      ticksProcessed: this.ticksProcessed,
      dayCount: this.dayCount,
      initialCapital: this.module.initialCapital,
      currentEquity: Number(this.module.equity.toFixed(2)),
      totalProfitPct: Number((((this.module.equity - this.module.initialCapital) / this.module.initialCapital) * 100).toFixed(2)),
      activePositions: Array.from(this.module.positions.keys()),
      killSwitchTripsCount: this.killSwitchTrips.length,
      shadowOrdersCount: this.shadowOrdersLog.length,
      isHalted: this.module.halted
    };
  }
}
