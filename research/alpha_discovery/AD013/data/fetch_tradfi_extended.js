/**
 * ALPHA FACTORY — AD013 EXTENDED TRADFI DATA INGESTION ENGINE
 * Script: fetch_tradfi_extended.js
 * 
 * Ingests, normalizes, and partitions 1H historical candles for:
 * 1. SPY (S&P 500 ETF)
 * 2. QQQ (Nasdaq 100 ETF)
 * 3. GLD (SPDR Gold Trust)
 * 4. EURUSD=X (Euro / US Dollar)
 * 5. GBPUSD=X (British Pound / US Dollar)
 * 6. USDJPY=X (US Dollar / Japanese Yen)
 * 7. BTCUSDT (Crypto Benchmark Control from internal store)
 * 
 * Partitions strictly into:
 * - Discovery: 2023-11-21 -> 2024-12-31T23:59:59.999Z (58 weeks)
 * - Holdout Sealed: 2025-01-01T00:00:00.000Z -> Present (strictly sealed)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const rootDir = process.cwd();
const outputDataDir = path.resolve(rootDir, 'research/alpha_discovery/AD013/data');
const holdoutDir = path.resolve(rootDir, 'research/alpha_discovery/AD013/holdout_sealed');
const ad011DataDir = path.resolve(rootDir, 'research/alpha_discovery/AD011/data');
const ad011HoldoutDir = path.resolve(rootDir, 'research/alpha_discovery/AD011/holdout_sealed');

fs.mkdirSync(outputDataDir, { recursive: true });
fs.mkdirSync(holdoutDir, { recursive: true });

const DISCOVERY_END_MS = 1735689599999; // 2024-12-31T23:59:59.999Z

const YAHOO_SYMBOLS = [
  { id: 'SPY', yahooTicker: 'SPY' },
  { id: 'QQQ', yahooTicker: 'QQQ' },
  { id: 'GLD', yahooTicker: 'GLD' },
  { id: 'EURUSD', yahooTicker: 'EURUSD=X' },
  { id: 'GBPUSD', yahooTicker: 'GBPUSD=X' },
  { id: 'USDJPY', yahooTicker: 'USDJPY=X' }
];

async function fetchYahoo1h(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1h&range=730d`;
  console.log(`[DATA_INGESTION] Fetching 1H data for ${ticker} from Yahoo Finance...`);
  
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${ticker}: HTTP ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result || !result.timestamp) {
    throw new Error(`Invalid response for ${ticker}: ${JSON.stringify(data.chart?.error)}`);
  }

  const timestamps = result.timestamp;
  const quote = result.indicators.quote[0];
  const opens = quote.open;
  const highs = quote.high;
  const lows = quote.low;
  const closes = quote.close;
  const volumes = quote.volume || [];

  const candles = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = opens[i];
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    const v = volumes[i] !== null && volumes[i] !== undefined ? volumes[i] : 0;

    if (o === null || h === null || l === null || c === null) continue;
    if (isNaN(o) || isNaN(h) || isNaN(l) || isNaN(c)) continue;

    const tsMs = timestamps[i] * 1000;
    candles.push({
      openTime: tsMs,
      timestamp: tsMs,
      open: Number(o.toFixed(5)),
      high: Number(h.toFixed(5)),
      low: Number(l.toFixed(5)),
      close: Number(c.toFixed(5)),
      volume: Number(v.toFixed(2)),
      closeTime: tsMs + 3600000 - 1
    });
  }

  candles.sort((a, b) => a.timestamp - b.timestamp);
  return candles;
}

function loadInternalBtcCandles() {
  const btcPath = path.resolve(rootDir, 'research/datasets/BTCUSDT_1h_multiyear_2023_2026.json');
  console.log(`[DATA_INGESTION] Loading internal BTC benchmark from ${btcPath}...`);
  const raw = JSON.parse(fs.readFileSync(btcPath, 'utf8'));
  return raw.map(c => ({
    openTime: c.openTime || c.timestamp,
    timestamp: c.timestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    closeTime: c.closeTime || (c.timestamp + 3600000 - 1)
  })).sort((a, b) => a.timestamp - b.timestamp);
}

function calculateSha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function run() {
  console.log('================================================================');
  console.log('🏛️ ALPHA FACTORY — AD013 EXTENDED TRADFI DATA INGESTION ENGINE');
  console.log('================================================================\n');

  const manifest = {
    program: 'ALPHA_DISCOVERY_AD013',
    createdDate: new Date().toISOString(),
    discoveryWindow: '2023-11-21T00:00:00.000Z -> 2024-12-31T23:59:59.999Z',
    holdoutWindow: '2025-01-01T00:00:00.000Z -> 2026-09-07T00:00:00.000Z',
    assets: {}
  };

  const allAssets = [];

  for (const item of YAHOO_SYMBOLS) {
    const ad011DiscFile = path.join(ad011DataDir, `${item.id}_1h_discovery.json`);
    const ad011HoldFile = path.join(ad011HoldoutDir, `${item.id}_1h_holdout.json`);
    
    if (fs.existsSync(ad011DiscFile) && fs.existsSync(ad011HoldFile) && item.id !== 'USDJPY') {
      console.log(`[DATA_INGESTION] Reusing validated dataset for ${item.id} from AD011 store...`);
      const discCandles = JSON.parse(fs.readFileSync(ad011DiscFile, 'utf8'));
      const holdCandles = JSON.parse(fs.readFileSync(ad011HoldFile, 'utf8'));
      const combined = [...discCandles, ...holdCandles].sort((a, b) => a.timestamp - b.timestamp);
      allAssets.push({ id: item.id, candles: combined });
    } else {
      const candles = await fetchYahoo1h(item.yahooTicker);
      allAssets.push({ id: item.id, candles });
    }
  }

  // BTC Benchmark
  const btcCandles = loadInternalBtcCandles();
  const earliestTs = allAssets[0].candles[0].timestamp;
  const filteredBtc = btcCandles.filter(c => c.timestamp >= earliestTs);
  allAssets.push({ id: 'BTCUSDT', candles: filteredBtc });

  // Partition and Save
  for (const asset of allAssets) {
    const discoveryCandles = asset.candles.filter(c => c.timestamp <= DISCOVERY_END_MS);
    const holdoutCandles = asset.candles.filter(c => c.timestamp > DISCOVERY_END_MS);

    const discPath = path.join(outputDataDir, `${asset.id}_1h_discovery.json`);
    fs.writeFileSync(discPath, JSON.stringify(discoveryCandles, null, 2), 'utf8');

    const holdPath = path.join(holdoutDir, `${asset.id}_1h_holdout.json`);
    fs.writeFileSync(holdPath, JSON.stringify(holdoutCandles, null, 2), 'utf8');

    const discSha = calculateSha256(discPath);
    const holdSha = calculateSha256(holdPath);

    console.log(`✔ [${asset.id}] Discovery: ${discoveryCandles.length} bars (SHA: ${discSha.slice(0, 10)}...) | Holdout: ${holdoutCandles.length} bars (Sealed)`);

    manifest.assets[asset.id] = {
      discoveryCount: discoveryCandles.length,
      discoverySha256: discSha,
      discoveryStart: new Date(discoveryCandles[0].timestamp).toISOString(),
      discoveryEnd: new Date(discoveryCandles[discoveryCandles.length - 1].timestamp).toISOString(),
      holdoutCount: holdoutCandles.length,
      holdoutSha256: holdSha,
      holdoutStart: new Date(holdoutCandles[0].timestamp).toISOString(),
      holdoutEnd: new Date(holdoutCandles[holdoutCandles.length - 1].timestamp).toISOString()
    };
  }

  const manifestPath = path.join(outputDataDir, 'AD013_DATASET_MANIFEST.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n✔ Data Manifest saved to: ${manifestPath}`);
  console.log('\n================================================================');
  console.log('✅ AD013 INGESTION & ISOLATED PARTITION COMPLETE.');
  console.log('================================================================\n');
}

run().catch(err => {
  console.error('[FATAL ERROR IN INGESTION]:', err);
  process.exit(1);
});
