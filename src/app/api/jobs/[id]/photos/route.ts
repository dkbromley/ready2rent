import { NextResponse } from 'next/server';
import { getCurrentUser, canAccessJob } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { storeJobPhoto } from '@/lib/storage';

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

/**
 * Job completion photo upload.
 * Stores via Supabase Storage in production (local FS fallback in dev) — see
 * src/lib/storage.ts — then records a JobPhoto row.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canAccessJob(user, jobId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get('photo');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 8MB)' }, { status: 400 });
  }
  if (file.type && !ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const bytes = Buffer.from(await file.arrayBuffer());

  let stored;
  try {
    stored = await storeJobPhoto(jobId, bytes, ext, file.type || 'image/jpeg');
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 502 },
    );
  }

  const photo = await prisma.jobPhoto.create({
    data: { jobId, url: stored.url, uploadedByUserId: user.id },
  });

  return NextResponse.json({ ok: true, photo });
}
