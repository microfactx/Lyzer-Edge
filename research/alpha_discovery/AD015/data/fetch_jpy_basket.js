/**
 * ALPHA FACTORY — AD015 JPY BASKET DATA INGESTION ENGINE
 * Script: fetch_jpy_basket.js
 * 
 * Fetches, normalizes, and partitions 1H historical candles for the 4 JPY carry pairs:
 * 1. USDJPY (US Dollar / Japanese Yen) - reuses validated AD014 store
 * 2. GBPJPY=X (British Pound / Japanese Yen)
 * 3. AUDJPY=X (Australian Dollar / Japanese Yen)
 * 4. CADJPY=X (Canadian Dollar / Japanese Yen)
 * 
 * Partitions strictly:
 * - Discovery: 2023-11-21 -> 2024-12-31T23:59:59.999Z (58 weeks)
 * - Holdout Sealed: 2025-01-01T00:00:00.000Z -> Present (strictly sealed)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const rootDir = process.cwd();
const ad014DataDir = path.resolve(rootDir, 'research/alpha_discovery/AD014/data');
const ad014HoldoutDir = path.resolve(rootDir, 'research/alpha_discovery/AD014/holdout_sealed');

const outputDataDir = path.resolve(rootDir, 'research/alpha_discovery/AD015/data');
const holdoutDir = path.resolve(rootDir, 'research/alpha_discovery/AD015/holdout_sealed');

fs.mkdirSync(outputDataDir, { recursive: true });
fs.mkdirSync(holdoutDir, { recursive: true });

const DISCOVERY_END_MS = 1735689599999; // 2024-12-31T23:59:59.999Z

const NEW_YAHOO_PAIRS = [
  { id: 'GBPJPY', ticker: 'GBPJPY=X' },
  { id: 'AUDJPY', ticker: 'AUDJPY=X' },
  { id: 'CADJPY', ticker: 'CADJPY=X' }
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

function calculateSha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function run() {
  console.log('================================================================');
  console.log('🏛️ ALPHA FACTORY — AD015 JPY BASKET DATA INGESTION ENGINE');
  console.log('================================================================\n');

  const manifest = {
    program: 'ALPHA_DISCOVERY_AD015',
    createdDate: new Date().toISOString(),
    discoveryWindow: '2023-11-21T00:00:00.000Z -> 2024-12-31T23:59:59.999Z',
    holdoutWindow: '2025-01-01T00:00:00.000Z -> 2026-09-07T00:00:00.000Z',
    assets: {}
  };

  const allAssets = [];

  // 1. Reuse validated USDJPY from AD014
  console.log('[DATA_INGESTION] Reusing validated dataset for USDJPY from AD014 store...');
  const usdjpyDisc = JSON.parse(fs.readFileSync(path.join(ad014DataDir, 'USDJPY_1h_discovery.json'), 'utf8'));
  const usdjpyHold = JSON.parse(fs.readFileSync(path.join(ad014HoldoutDir, 'USDJPY_1h_holdout.json'), 'utf8'));
  allAssets.push({ id: 'USDJPY', candles: [...usdjpyDisc, ...usdjpyHold].sort((a, b) => a.timestamp - b.timestamp) });

  // 2. Fetch new JPY pairs
  for (const item of NEW_YAHOO_PAIRS) {
    const candles = await fetchYahoo1h(item.ticker);
    allAssets.push({ id: item.id, candles });
  }

  // 3. Partition and Save
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

  const manifestPath = path.join(outputDataDir, 'AD015_DATASET_MANIFEST.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n✔ Data Manifest saved to: ${manifestPath}`);
  console.log('\n================================================================');
  console.log('✅ AD015 BASKET INGESTION COMPLETE.');
  console.log('================================================================\n');
}

run().catch(err => {
  console.error('[FATAL ERROR IN BASKET INGESTION]:', err);
  process.exit(1);
});
