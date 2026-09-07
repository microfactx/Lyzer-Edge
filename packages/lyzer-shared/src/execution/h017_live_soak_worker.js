/**
 * LYZER LABS — H017 PRODUCTION LIVE WALL-CLOCK SOAK WORKER
 * Module: h017_live_soak_worker.js
 * 
 * Purpose:
 * 1. Autonomous, continuous 7-day Wall-Clock Soak for H017 Productive Carry.
 * 2. Connects to Binance live public market feeds (perps, mark prices, funding rates, spot prices).
 * 3. Enforces Sovereign Veto: $0 real capital, 100% observational shadow execution.
 * 4. Generates daily signed SHA-256 forensic checkpoints in $DATA_DIR/h017_soak/.
 * 5. Exposes getStatus() for the Express /api/h017/status observability endpoint.
 */

import fs from 'fs';
import path from 'path';
import { H017ShadowSoakRunner } from './h017_shadow_soak_runner.js';

export class H017LiveSoakWorker {
  constructor(config = {}) {
    this.soakDir = config.soakDir || process.env.H017_SOAK_DIR || path.resolve(process.env.DATA_DIR || '/tmp/data', 'h017_soak');
    this.initialCapital = config.initialCapital || parseFloat(process.env.H017_SOAK_INITIAL_CAPITAL || '100000');
    this.pollIntervalMs = config.pollIntervalMs || parseInt(process.env.H017_SOAK_INTERVAL_MS || '60000', 10);
    
    this.targetAssets = config.targetAssets || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOGEUSDT'];
    this.corePerpAssets = ['ETHUSDT', 'SOLUSDT', 'AVAXUSDT'];

    this.runner = new H017ShadowSoakRunner({
      soakDir: this.soakDir,
      moduleConfig: {
        initialCapital: this.initialCapital,
        topK: 2,
        targetLeverage: 2.0,
        bufferPct: 2.0,
        hurdlePct: 3.0
      }
    });

    this.startTime = Date.now();
    this.pollTimer = null;
    this.isRunning = false;
    this.status = 'INITIALIZED';
    this.lastPollError = null;
    this.lastMarketData = null;
    this.trailingRatesCache = new Map();
    this.lastTrailingRatesFetch = 0;
    this.lastSettledFundingTime = new Map();
  }

  /**
   * Fetch Binance public spot price and mark/funding rates.
   */
  async fetchLiveMarketData() {
    const timestampMs = Date.now();

    // 1. Fetch Premium Index (Mark Price + Funding Rate)
    const premiumResp = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex');
    if (!premiumResp.ok) throw new Error(`Binance Futures API error: ${premiumResp.status} ${premiumResp.statusText}`);
    const premiumData = await premiumResp.json();

    const fundingRates = {};
    const perpMarkPrices = {};
    const nextFundingTimes = {};

    for (const item of premiumData) {
      if (this.targetAssets.includes(item.symbol)) {
        fundingRates[item.symbol] = parseFloat(item.lastFundingRate || '0');
        perpMarkPrices[item.symbol] = parseFloat(item.markPrice || '0');
        nextFundingTimes[item.symbol] = parseInt(item.nextFundingTime || '0', 10);
      }
    }

    // 2. Fetch Spot Prices
    const spotResp = await fetch('https://api.binance.com/api/v3/ticker/price');
    if (!spotResp.ok) throw new Error(`Binance Spot API error: ${spotResp.status} ${spotResp.statusText}`);
    const spotData = await spotResp.json();

    const spotPrices = {};
    for (const item of spotData) {
      if (this.targetAssets.includes(item.symbol)) {
        spotPrices[item.symbol] = parseFloat(item.price || '0');
      }
    }

    // Fallback for spot price if missing: use mark price
    for (const sym of this.targetAssets) {
      if (!spotPrices[sym] && perpMarkPrices[sym]) {
        spotPrices[sym] = perpMarkPrices[sym];
      }
    }

    // 3. Map LST synthetic prices (tracking peg against native spot)
    const prices = { ...spotPrices };
    prices['stETH'] = (spotPrices['ETHUSDT'] || 3000) * 0.9995;
    prices['JitoSOL'] = (spotPrices['SOLUSDT'] || 150) * 0.999;
    prices['sAVAX'] = (spotPrices['AVAXUSDT'] || 30) * 0.999;

    const nativePrices = {
      ETHUSDT: spotPrices['ETHUSDT'] || perpMarkPrices['ETHUSDT'] || 3000,
      SOLUSDT: spotPrices['SOLUSDT'] || perpMarkPrices['SOLUSDT'] || 150,
      AVAXUSDT: spotPrices['AVAXUSDT'] || perpMarkPrices['AVAXUSDT'] || 30
    };

    // 4. Trailing Gross Rates (refreshed every hour or on boot)
    if (this.trailingRatesCache.size === 0 || (timestampMs - this.lastTrailingRatesFetch > 3600000)) {
      await this.refreshTrailingGrossRates();
      this.lastTrailingRatesFetch = timestampMs;
    }

    const trailingGrossRates = {};
    for (const sym of this.targetAssets) {
      trailingGrossRates[sym] = this.trailingRatesCache.get(sym) || 12.0; // conservative default if cold
    }

    return {
      timestampMs,
      prices,
      nativePrices,
      fundingRates,
      trailingGrossRates,
      nextFundingTimes
    };
  }

  /**
   * Refreshes 30-day historical trailing funding rates from Binance public endpoint.
   */
  async refreshTrailingGrossRates() {
    for (const sym of this.corePerpAssets) {
      try {
        const resp = await fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&limit=90`);
        if (resp.ok) {
          const records = await resp.json();
          if (Array.isArray(records) && records.length > 0) {
            const sumRates = records.reduce((acc, r) => acc + parseFloat(r.fundingRate || '0'), 0);
            const avgRate = sumRates / records.length;
            const annFundPct = avgRate * (365 * 3) * 100;
            const stakingYield = this.runner.module.stakingYields[sym] || 0;
            this.trailingRatesCache.set(sym, annFundPct + stakingYield);
          }
        }
      } catch (err) {
        console.warn(`[H017 SOAK] Warning: Failed to refresh historical rates for ${sym}: ${err.message}`);
      }
    }
  }

  /**
   * Processes a single tick from live market data.
   */
  async pollTick() {
    try {
      const marketData = await this.fetchLiveMarketData();
      this.lastMarketData = marketData;
      this.lastPollError = null;

      // Ingest into shadow soak runner
      const tickResult = this.runner.processTick({
        timestampMs: marketData.timestampMs,
        prices: marketData.prices,
        nativePrices: marketData.nativePrices,
        fundingRates: marketData.fundingRates,
        trailingGrossRates: marketData.trailingGrossRates
      });

      return tickResult;
    } catch (err) {
      this.lastPollError = {
        timestampUTC: new Date().toISOString(),
        message: err.message
      };
      console.error(`[H017 SOAK] Poll tick warning: ${err.message}`);
      return null;
    }
  }

  /**
   * Starts the autonomous Wall-Clock Soak loop.
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.status = 'ACTIVE_SOAK';
    this.startTime = Date.now();

    console.log(`🚀 [H017 SOAK] Autonomous Wall-Clock Soak started.`);
    console.log(`   Initial Capital: $${this.initialCapital} (SHADOW/SIMULATED)`);
    console.log(`   Poll Interval: ${this.pollIntervalMs / 1000}s`);
    console.log(`   Forensic Checkpoints Directory: ${this.soakDir}`);
    console.log(`   Sovereign Veto: STRICTLY ENFORCED ($0 real capital at risk).`);

    // First tick immediately
    this.pollTick().catch(e => console.error('[H017 SOAK] Boot tick error:', e.message));

    // Schedule regular polling
    this.pollTimer = setInterval(async () => {
      if (!this.isRunning) return;
      await this.pollTick();
    }, this.pollIntervalMs);
  }

  /**
   * Stops the soak loop gracefully.
   */
  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isRunning = false;
    this.status = 'STOPPED';
    console.log(`🛑 [H017 SOAK] Wall-Clock Soak stopped.`);
  }

  /**
   * Returns current operational status for /api/h017/status.
   */
  getStatus() {
    const elapsedMs = Date.now() - this.startTime;
    const wallClockDaysElapsed = elapsedMs / 86400000;
    const currentEquity = this.runner.module.equity;
    const initialCap = this.runner.module.initialCapital;
    const pnlUSD = currentEquity - initialCap;
    const pnlPct = (pnlUSD / initialCap) * 100;

    return {
      status: this.status,
      mode: 'WALL_CLOCK_SHADOW_SOAK',
      sovereignVetoEnforced: true,
      realCapitalAtRiskUSD: 0,
      startTimeISO: new Date(this.startTime).toISOString(),
      uptimeSeconds: Math.floor(elapsedMs / 1000),
      wallClockDaysElapsed: Number(wallClockDaysElapsed.toFixed(4)),
      targetSoakDays: 7,
      ticksProcessed: this.runner.ticksProcessed,
      dayCheckpointsRecorded: this.runner.dayCount,
      equity: Number(currentEquity.toFixed(2)),
      initialCapital: initialCap,
      pnlUSD: Number(pnlUSD.toFixed(2)),
      pnlPct: Number(pnlPct.toFixed(4)),
      killSwitchesHalted: this.runner.module.halted,
      activeKillSwitch: this.runner.module.activeKillSwitch,
      killSwitchTripsCount: this.runner.killSwitchTrips.length,
      positions: Array.from(this.runner.module.positions.keys()),
      lastMarketDataTimestamp: this.lastMarketData?.timestampMs || null,
      lastFundingRates: this.lastMarketData?.fundingRates || {},
      lastSpotPrices: this.lastMarketData?.prices || {},
      lastPollError: this.lastPollError
    };
  }
}
