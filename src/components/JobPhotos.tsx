'use client';

import Image from 'next/image';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { deleteJobPhoto } from '@/server/actions';
import { MAX_PHOTOS_PER_JOB } from '@/lib/limits';

export interface JobPhotoItem {
  id: string;
  url: string;
  caption?: string | null;
}

/**
 * Job completion photos: view, add (capped at MAX_PHOTOS_PER_JOB), and
 * delete/retake. Read-only when the viewer can't manage the job.
 */
export function JobPhotos({
  jobId,
  photos,
  canManage,
  kind = 'COMPLETION',
}: {
  jobId: string;
  photos: JobPhotoItem[];
  canManage: boolean;
  kind?: 'COMPLETION' | 'PROBLEM';
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const atLimit = photos.length >= MAX_PHOTOS_PER_JOB;

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      fd.append('kind', kind);
      const res = await fetch(`/api/jobs/${jobId}/photos`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'Upload failed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function onDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      try {
        await deleteJobPhoto(id);
        router.refresh();
      } finally {
        setDeletingId(null);
      }
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-navy-400">
          {photos.length} / {MAX_PHOTOS_PER_JOB} photos
        </p>
        {canManage && (
          <>
            <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onUpload} />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading || atLimit}
              className="inline-flex items-center gap-2 rounded-xl bg-surface px-3 py-1.5 text-sm font-medium text-navy-800 ring-1 ring-inset ring-navy-200 transition hover:bg-navy-50 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {atLimit ? 'Limit reached' : uploading ? 'Uploading…' : 'Add photo'}
            </button>
          </>
        )}
      </div>

      {error && <p className="mb-2 text-xs text-status-problem">{error}</p>}

      {photos.length === 0 ? (
        <p className="text-sm text-navy-500">No photos uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl bg-navy-100">
              <a href={photo.url} target="_blank" rel="noreferrer">
                <Image src={photo.url} alt={photo.caption ?? 'Completion photo'} fill sizes="(max-width:640px) 33vw, 160px" className="object-cover" />
              </a>
              {canManage && (
                <button
                  onClick={() => onDelete(photo.id)}
                  disabled={isPending && deletingId === photo.id}
                  aria-label="Delete photo"
                  className="absolute right-1 top-1 rounded-lg bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100 disabled:opacity-100"
                >
                  {isPending && deletingId === photo.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
