/**
 * ALPHA FACTORY — AD014 DATA SETUP
 * Script: setup_ad014_data.js
 * 
 * Links the validated 1H discovery and holdout datasets for AD014:
 * - USDJPY
 * - EURUSD
 * - GBPUSD
 * - BTCUSDT
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const rootDir = process.cwd();
const ad013DataDir = path.resolve(rootDir, 'research/alpha_discovery/AD013/data');
const ad013HoldoutDir = path.resolve(rootDir, 'research/alpha_discovery/AD013/holdout_sealed');

const outputDataDir = path.resolve(rootDir, 'research/alpha_discovery/AD014/data');
const outputHoldoutDir = path.resolve(rootDir, 'research/alpha_discovery/AD014/holdout_sealed');

fs.mkdirSync(outputDataDir, { recursive: true });
fs.mkdirSync(outputHoldoutDir, { recursive: true });

const targetAssets = ['USDJPY', 'EURUSD', 'GBPUSD', 'BTCUSDT'];

const manifest = {
  program: 'ALPHA_DISCOVERY_AD014',
  createdDate: new Date().toISOString(),
  discoveryWindow: '2023-11-21T00:00:00.000Z -> 2024-12-31T23:59:59.999Z',
  holdoutWindow: '2025-01-01T00:00:00.000Z -> 2026-09-07T00:00:00.000Z',
  assets: {}
};

for (const asset of targetAssets) {
  const discSrc = path.join(ad013DataDir, `${asset}_1h_discovery.json`);
  const holdSrc = path.join(ad013HoldoutDir, `${asset}_1h_holdout.json`);

  const discDst = path.join(outputDataDir, `${asset}_1h_discovery.json`);
  const holdDst = path.join(outputHoldoutDir, `${asset}_1h_holdout.json`);

  fs.copyFileSync(discSrc, discDst);
  fs.copyFileSync(holdSrc, holdDst);

  const discBuf = fs.readFileSync(discDst);
  const holdBuf = fs.readFileSync(holdDst);

  const discSha = crypto.createHash('sha256').update(discBuf).digest('hex');
  const holdSha = crypto.createHash('sha256').update(holdBuf).digest('hex');

  const discData = JSON.parse(discBuf);
  const holdData = JSON.parse(holdBuf);

  manifest.assets[asset] = {
    discoveryCount: discData.length,
    discoverySha256: discSha,
    discoveryStart: new Date(discData[0].timestamp).toISOString(),
    discoveryEnd: new Date(discData[discData.length - 1].timestamp).toISOString(),
    holdoutCount: holdData.length,
    holdoutSha256: holdSha
  };

  console.log(`✔ [${asset}] Discovery: ${discData.length} bars (SHA: ${discSha.slice(0, 10)}...) | Holdout: ${holdData.length} bars (Sealed)`);
}

const manifestPath = path.join(outputDataDir, 'AD014_DATASET_MANIFEST.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`\n✔ Manifest saved to: ${manifestPath}`);
