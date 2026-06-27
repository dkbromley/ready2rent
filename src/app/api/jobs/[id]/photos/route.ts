import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getCurrentUser, canAccessJob } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

/**
 * Job completion photo upload.
 *
 * Dev/MVP: writes to /public/uploads and stores the public path. Swap the
 * storage block for Supabase Storage / S3 in production (see SUPABASE_* env).
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

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const filename = `${jobId}-${randomUUID()}.${ext}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, filename), bytes);

  const url = `/uploads/${filename}`;
  const photo = await prisma.jobPhoto.create({
    data: { jobId, url, uploadedByUserId: user.id },
  });

  return NextResponse.json({ ok: true, photo });
}
