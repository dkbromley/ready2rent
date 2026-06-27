import { NextResponse } from 'next/server';
import { syncAllActiveFeeds } from '@/server/sync/sync-service';

export const runtime = 'nodejs';
// Allow up to 60s for the batch on platforms that honor this (e.g. Vercel).
export const maxDuration = 60;

/**
 * Recurring calendar sync entry point.
 *
 * Triggered by Vercel Cron (see vercel.json) or any external scheduler. Protect
 * with CRON_SECRET via `Authorization: Bearer <secret>`. Vercel Cron sends this
 * header automatically when CRON_SECRET is set as an env var.
 *
 * Swap point for Inngest/Trigger.dev/BullMQ later: enqueue per-feed jobs instead
 * of running the batch inline. The sync service itself stays unchanged.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  const results = await syncAllActiveFeeds();
  const ok = results.filter((r) => r.status === 'SUCCESS').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;

  return NextResponse.json({
    ok: true,
    feeds: results.length,
    succeeded: ok,
    failed,
    durationMs: Date.now() - startedAt,
  });
}

// Allow POST too, for schedulers that prefer it.
export const POST = GET;
