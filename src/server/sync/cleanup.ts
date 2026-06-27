import { JobStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { deleteStoredFiles } from '@/lib/storage';
import { ARCHIVE_AFTER_DAYS } from '@/lib/limits';

/**
 * Archive cleanup.
 *
 * Completed jobs are visible in the Archive for ARCHIVE_AFTER_DAYS. After that
 * this routine:
 *   1) deletes their PHOTOS (storage objects + JobPhoto rows) to reclaim space,
 *   2) stamps `archivedAt`, which removes them from every dashboard/list.
 *
 * The TurnoverJob row itself is NEVER deleted — so completion analytics (counts,
 * timing, same-day rates, per-property history) remain fully intact. Only the
 * heavy, redundant photo blobs are reclaimed.
 */
export interface CleanupResult {
  archived: number;
  photosDeleted: number;
}

export async function archiveCompletedJobs(): Promise<CleanupResult> {
  const cutoff = new Date(Date.now() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000);

  const jobs = await prisma.turnoverJob.findMany({
    where: { status: JobStatus.COMPLETED, completedAt: { lt: cutoff }, archivedAt: null },
    select: { id: true, photos: { select: { id: true, url: true } } },
  });
  if (jobs.length === 0) return { archived: 0, photosDeleted: 0 };

  const photoUrls = jobs.flatMap((j) => j.photos.map((p) => p.url));
  const photoIds = jobs.flatMap((j) => j.photos.map((p) => p.id));
  const jobIds = jobs.map((j) => j.id);

  // Reclaim storage first, then drop the photo rows, then stamp archivedAt.
  await deleteStoredFiles(photoUrls);
  if (photoIds.length) await prisma.jobPhoto.deleteMany({ where: { id: { in: photoIds } } });
  await prisma.turnoverJob.updateMany({ where: { id: { in: jobIds } }, data: { archivedAt: new Date() } });

  return { archived: jobs.length, photosDeleted: photoUrls.length };
}
