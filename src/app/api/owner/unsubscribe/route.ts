import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * One-click unsubscribe for owner notifications (CAN-SPAM). Linked from every
 * owner email via the contact's claimToken: /api/owner/unsubscribe?c=<token>.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('c');
  if (token) {
    await prisma.propertyOwnerContact
      .updateMany({ where: { claimToken: token }, data: { unsubscribed: true } })
      .catch(() => undefined);
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title></head>
  <body style="font-family:ui-sans-serif,system-ui,sans-serif;background:#fbf9f4;color:#1d2748;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
    <div style="text-align:center;max-width:420px;padding:24px">
      <h1 style="font-size:20px">You're unsubscribed</h1>
      <p style="color:#526dac">You won't receive any more turnover update emails for this property. Your cleaner can re-enable them if you change your mind.</p>
    </div>
  </body></html>`;
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
