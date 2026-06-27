/**
 * Standalone cron worker for local/self-hosted recurring sync.
 *
 *   npm run sync:worker
 *
 * In production on Vercel, prefer the cron route at /api/cron/sync triggered by
 * Vercel Cron (see vercel.json). This worker is the zero-infra alternative and
 * the swap-in point if you later move to Inngest/Trigger.dev/BullMQ — only this
 * file (and the cron route) change; the sync service stays put.
 */
import { syncAllActiveFeeds } from './sync-service';

const INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS ?? 15 * 60 * 1000); // 15 min

async function runOnce() {
  const startedAt = new Date().toISOString();
  console.log(`[sync-worker] cycle start ${startedAt}`);
  try {
    const results = await syncAllActiveFeeds();
    const ok = results.filter((r) => r.status === 'SUCCESS').length;
    const failed = results.filter((r) => r.status === 'FAILED').length;
    console.log(`[sync-worker] done: ${ok} ok, ${failed} failed, ${results.length} feeds`);
  } catch (err) {
    console.error('[sync-worker] cycle error', err);
  }
}

async function main() {
  await runOnce();
  setInterval(runOnce, INTERVAL_MS);
  console.log(`[sync-worker] polling every ${Math.round(INTERVAL_MS / 60000)} min`);
}

main();
