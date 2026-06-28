import type { Config } from '@netlify/functions';

/**
 * Netlify Scheduled Function — daily archive cleanup. Calls /api/cron/cleanup
 * (CRON_SECRET-protected), which archives completed jobs past the retention
 * window and prunes their photos. Job rows are preserved, so analytics are safe.
 */
export default async function handler() {
  const base = process.env.URL || process.env.AUTH_URL || 'https://ready2rent.netlify.app';
  const secret = process.env.CRON_SECRET;
  const res = await fetch(`${base}/api/cron/cleanup`, {
    method: 'POST',
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
  const body = await res.text();
  console.log(`[scheduled-cleanup] ${res.status} ${body.slice(0, 300)}`);
  if (!res.ok) return new Response(`Cleanup failed: ${res.status}`, { status: 500 });
  return new Response('ok');
}

export const config: Config = {
  // Daily at 04:10 UTC (off-peak).
  schedule: '10 4 * * *',
};
