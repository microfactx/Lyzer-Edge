/**
 * ALPHA FACTORY — AD016 DATA INGESTION ENGINE
 * Script: fetch_ad016_datasets.js
 * 
 * Ingests, normalizes, and partitions 1H historical candles for 12 currency pairs:
 * 
 * Track A (Dual-Funding G10 Basket):
 * - JPY Funding: USDJPY=X, GBPJPY=X, AUDJPY=X, CADJPY=X
 * - CHF Funding: USDCHF=X, GBPCHF=X, AUDCHF=X, CADCHF=X
 * 
 * Track B (High-Yield Emerging Markets):
 * - USDMXN=X (Mexican Peso)
 * - USDBRL=X (Brazilian Real)
 * - USDZAR=X (South African Rand)
 * - USDPLN=X (Polish Zloty)
 * 
 * Partitions strictly into:
 * - Discovery: 2023-11-21 -> 2024-12-31T23:59:59.999Z (58 weeks)
 * - Holdout Sealed: 2025-01-01T00:00:00.000Z -> Present (strictly sealed)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const rootDir = process.cwd();
const outputDataDir = path.resolve(rootDir, 'research/alpha_discovery/AD016/data');
const holdoutDir = path.resolve(rootDir, 'research/alpha_discovery/AD016/holdout_sealed');
const ad015DataDir = path.resolve(rootDir, 'research/alpha_discovery/AD015/data');
const ad015HoldoutDir = path.resolve(rootDir, 'research/alpha_discovery/AD015/holdout_sealed');

fs.mkdirSync(outputDataDir, { recursive: true });
fs.mkdirSync(holdoutDir, { recursive: true });

const DISCOVERY_START_MS = 1700524800000; // 2023-11-21T00:00:00.000Z
const DISCOVERY_END_MS = 1735689599999;   // 2024-12-31T23:59:59.999Z

const TARGET_PAIRS = [
  // G10 JPY Funding
  { id: 'USDJPY', ticker: 'USDJPY=X', existingAd015: true },
  { id: 'GBPJPY', ticker: 'GBPJPY=X', existingAd015: true },
  { id: 'AUDJPY', ticker: 'AUDJPY=X', existingAd015: true },
  { id: 'CADJPY', ticker: 'CADJPY=X', existingAd015: true },
  // G10 CHF Funding
  { id: 'USDCHF', ticker: 'USDCHF=X', existingAd015: false },
  { id: 'GBPCHF', ticker: 'GBPCHF=X', existingAd015: false },
  { id: 'AUDCHF', ticker: 'AUDCHF=X', existingAd015: false },
  { id: 'CADCHF', ticker: 'CADCHF=X', existingAd015: false },
  // High-Yield Emerging Markets
  { id: 'USDMXN', ticker: 'USDMXN=X', existingAd015: false },
  { id: 'USDBRL', ticker: 'USDBRL=X', existingAd015: false },
  { id: 'USDZAR', ticker: 'USDZAR=X', existingAd015: false },
  { id: 'USDPLN', ticker: 'USDPLN=X', existingAd015: false }
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

function computeSha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function main() {
  console.log('================================================================');
  console.log('🏛️  LYZER QUANT LAB — AD016 MULTI-ASSET DATASET INGESTION');
  console.log('================================================================\n');

  const manifest = {
    programId: 'AD016',
    generatedAt: new Date().toISOString(),
    discoveryWindow: {
      start: '2023-11-21T00:00:00.000Z',
      end: '2024-12-31T23:59:59.999Z',
      durationWeeks: 58
    },
    holdoutWindow: {
      start: '2025-01-01T00:00:00.000Z',
      status: 'SEALED_AND_RESTRICTED'
    },
    pairs: {}
  };

  for (const item of TARGET_PAIRS) {
    let allCandles = [];

    // Check if we can reuse AD015 discovery and holdout directly
    const ad015DiscFile = path.resolve(ad015DataDir, `${item.id}_1h_discovery.json`);
    const ad015HoldFile = path.resolve(ad015HoldoutDir, `${item.id}_1h_holdout_sealed.json`);

    if (item.existingAd015 && fs.existsSync(ad015DiscFile) && fs.existsSync(ad015HoldFile)) {
      console.log(`[DATA_INGESTION] Reusing validated AD015 files for ${item.id}...`);
      const discCandles = JSON.parse(fs.readFileSync(ad015DiscFile, 'utf8'));
      const holdCandles = JSON.parse(fs.readFileSync(ad015HoldFile, 'utf8'));

      const discPath = path.resolve(outputDataDir, `${item.id}_1h_discovery.json`);
      const holdPath = path.resolve(holdoutDir, `${item.id}_1h_holdout_sealed.json`);

      fs.writeFileSync(discPath, JSON.stringify(discCandles, null, 2));
      fs.writeFileSync(holdPath, JSON.stringify(holdCandles, null, 2));

      manifest.pairs[item.id] = {
        discoveryFile: path.basename(discPath),
        discoveryCandles: discCandles.length,
        discoverySha256: computeSha256(discPath),
        holdoutCandles: holdCandles.length,
        holdoutSha256: computeSha256(holdPath)
      };
      continue;
    }

    // Fetch fresh from Yahoo
    try {
      allCandles = await fetchYahoo1h(item.ticker);
      console.log(`[DATA_INGESTION] Successfully fetched ${allCandles.length} candles for ${item.id}`);

      const discoveryCandles = allCandles.filter(c => c.timestamp >= DISCOVERY_START_MS && c.timestamp <= DISCOVERY_END_MS);
      const holdoutCandles = allCandles.filter(c => c.timestamp > DISCOVERY_END_MS);

      const discPath = path.resolve(outputDataDir, `${item.id}_1h_discovery.json`);
      const holdPath = path.resolve(holdoutDir, `${item.id}_1h_holdout_sealed.json`);

      fs.writeFileSync(discPath, JSON.stringify(discoveryCandles, null, 2));
      fs.writeFileSync(holdPath, JSON.stringify(holdoutCandles, null, 2));

      manifest.pairs[item.id] = {
        discoveryFile: path.basename(discPath),
        discoveryCandles: discoveryCandles.length,
        discoverySha256: computeSha256(discPath),
        holdoutCandles: holdoutCandles.length,
        holdoutSha256: computeSha256(holdPath)
      };

      console.log(`[DATA_INGESTION] ${item.id}: Discovery=${discoveryCandles.length}, Holdout=${holdoutCandles.length}`);
    } catch (err) {
      console.error(`[DATA_INGESTION] ERROR fetching ${item.id}:`, err.message);
      throw err;
    }

    // Pause briefly to be courteous to API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const manifestPath = path.resolve(outputDataDir, 'AD016_DATASET_MANIFEST.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n[DATA_INGESTION] Dataset manifest written to ${manifestPath}`);
  console.log('✅ Ingestion and sealed partition completed successfully.');
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
