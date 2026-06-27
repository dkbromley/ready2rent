import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOwnerDashboard } from '@/server/queries';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const now = () => performance.now();
  const marks: Record<string, unknown> = {};

  let s = now();
  await prisma.$queryRaw`SELECT 1`;
  marks.dbPingMs = Math.round(now() - s);

  const user = await prisma.user.findUnique({
    where: { email: 'owner@turnready.app' },
    select: { id: true, role: true },
  });
  if (user) {
    s = now();
    const d = await getOwnerDashboard({ id: user.id, role: user.role });
    marks.dashboardQueriesMs = Math.round(now() - s);
    marks.counts = { properties: d.propertyCount, activity: d.activity.length };
  }
  marks.region = process.env.AWS_REGION ?? '?';
  return NextResponse.json(marks);
}
