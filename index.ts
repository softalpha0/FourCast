import 'dotenv/config';
import { PAPER_TRADING, PORT } from './src/config.js';
import { bootstrap, startPolling, pruneInactiveCurves, onGraduation } from './src/indexer.js';
import { scoreAllCurves } from './src/scorer.js';
import { refreshAllYields } from './src/oracle.js';
import { evaluateEntries, handleGraduation, monitorOpenPositions } from './src/positions.js';
import { startApiServer } from './src/api.js';
import { getSystemStats, upsertHotRankings } from './src/store.js';
import { startHotRankingsRefresh } from './src/fourmeme-api.js';

const startedAt = Date.now();

async function main(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║          FourCast v1.0.0             ║');
  console.log('║  Four.meme DeFi Intelligence Agent   ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log(`Mode:  ${PAPER_TRADING ? 'PAPER TRADING (no real execution)' : 'LIVE'}`);
  console.log(`API:   http://localhost:${PORT}`);
  console.log('');

  await bootstrap();

  onGraduation(handleGraduation);

  const stopPolling = startPolling();
  console.log('[Main] HTTP polling active (5s interval).');

  const stopHotRankings = startHotRankingsRefresh(upsertHotRankings, 60_000);
  console.log('[Main] Four.meme hot rankings refresh active (60s interval).');

  startApiServer();

  scoreAllCurves();
  await refreshAllYields();

  const scoringLoop = setInterval(async () => {
    try {
      scoreAllCurves();
      await evaluateEntries();
      await pruneInactiveCurves();
    } catch (err) {
      console.error('[Main] Scoring loop error:', (err as Error).message);
    }
  }, 30_000);

  const oracleLoop = setInterval(async () => {
    try {
      await refreshAllYields();
    } catch (err) {
      console.error('[Main] Oracle loop error:', (err as Error).message);
    }
  }, 15 * 60_000);

  const positionMonitor = setInterval(async () => {
    try {
      await monitorOpenPositions();
    } catch (err) {
      console.error('[Main] Position monitor error:', (err as Error).message);
    }
  }, 5 * 60_000);

  setInterval(() => {
    const stats = getSystemStats();
    console.log(
      `[Stats] uptime=${Math.round(stats.uptimeMs / 60_000)}m | ` +
      `curves=${stats.activeCurves} | ` +
      `graduated=${stats.graduatedTotal} | ` +
      `positions=${stats.openPositions} | ` +
      `block=${stats.lastIndexedBlock}`,
    );
  }, 5 * 60_000);

  const shutdown = (signal: string) => {
    console.log(`\n[Main] ${signal} received — shutting down…`);
    clearInterval(scoringLoop);
    clearInterval(oracleLoop);
    clearInterval(positionMonitor);
    stopPolling();
    stopHotRankings();
    process.exit(0);
  };

  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  console.log('[Main] FourCast running. Press Ctrl+C to stop.\n');
}

main().catch(err => {
  console.error('[Main] Fatal error:', err);
  process.exit(1);
});
