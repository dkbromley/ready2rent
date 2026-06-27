import { NextResponse } from 'next/server';
import { archiveCompletedJobs } from '@/server/sync/cleanup';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Daily archive cleanup endpoint. Protect with CRON_SECRET via
 * `Authorization: Bearer <secret>`. Archives completed jobs older than the
 * retention window and prunes their photos (job rows preserved for analytics).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  const result = await archiveCompletedJobs();
  return NextResponse.json({ ok: true, ...result });
}

export const POST = GET;
