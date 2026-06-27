import type { Config } from '@netlify/functions';

/**
 * Netlify Scheduled Function — recurring calendar sync.
 *
 * Runs every 15 minutes and calls the app's internal cron endpoint
 * (/api/cron/sync), authenticated with CRON_SECRET. The endpoint runs the
 * provider sync for every active feed. Keeping the work in the Next route means
 * the same code path serves manual triggers, Vercel Cron, and this scheduler.
 */
export default async function handler() {
  const base = process.env.URL || process.env.AUTH_URL || 'https://turnready.netlify.app';
  const secret = process.env.CRON_SECRET;

  const res = await fetch(`${base}/api/cron/sync`, {
    method: 'POST',
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });

  const body = await res.text();
  console.log(`[scheduled-sync] ${res.status} ${body.slice(0, 300)}`);

  if (!res.ok) {
    return new Response(`Sync failed: ${res.status}`, { status: 500 });
  }
  return new Response('ok');
}

export const config: Config = {
  schedule: '*/15 * * * *',
};
