import { NextResponse } from 'next/server';
import { getCurrentUser, canAccessJob } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { storeJobPhoto } from '@/lib/storage';
import { MAX_PHOTOS_PER_JOB, MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from '@/lib/limits';
import { PhotoKind } from '@prisma/client';

export const runtime = 'nodejs';

/**
 * Job completion photo upload. Enforces a per-job cap so storage can't balloon,
 * stores via Supabase Storage (local FS fallback in dev), records a JobPhoto row.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canAccessJob(user, jobId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const form = await req.formData();
  const kindRaw = String(form.get('kind') ?? 'COMPLETION').toUpperCase();
  const kind = kindRaw === 'PROBLEM' ? PhotoKind.PROBLEM : PhotoKind.COMPLETION;

  // Cap per kind so problem evidence doesn't crowd out completion photos.
  const existing = await prisma.jobPhoto.count({ where: { jobId, kind } });
  if (existing >= MAX_PHOTOS_PER_JOB) {
    return NextResponse.json(
      { error: `Photo limit reached (${MAX_PHOTOS_PER_JOB}). Delete one to add another.` },
      { status: 409 },
    );
  }

  const file = form.get('photo');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'File too large (max 8MB)' }, { status: 400 });
  }
  if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type)) {
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
    data: { jobId, url: stored.url, uploadedByUserId: user.id, kind },
  });

  const count = existing + 1;
  return NextResponse.json({ ok: true, photo, count, remaining: MAX_PHOTOS_PER_JOB - count });
}
