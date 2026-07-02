'use client';

import Image from 'next/image';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { setPropertyImageFromForm, removePropertyImage } from '@/server/actions';

/**
 * Property hero image: shows the current image (or a placeholder) and lets an
 * authorized user upload/replace or remove it. Replacing deletes the old object
 * server-side so storage doesn't accumulate orphans.
 */
export function PropertyImageUpload({
  propertyId,
  imageUrl,
  canManage,
}: {
  propertyId: string;
  imageUrl: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('propertyId', propertyId);
      fd.append('image', file);
      await setPropertyImageFromForm(fd);
      router.refresh();
    } catch {
      setError('Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function onRemove() {
    startTransition(async () => {
      await removePropertyImage(propertyId);
      router.refresh();
    });
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-navy-100 bg-navy-50">
      <div className="relative aspect-[16/9] w-full sm:aspect-[21/9]">
        {imageUrl ? (
          <Image src={imageUrl} alt="Property" fill sizes="(max-width:768px) 100vw, 900px" className="object-cover" priority />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-navy-300">
            <ImagePlus className="h-10 w-10" />
          </div>
        )}
      </div>

      {canManage && (
        <div className="absolute bottom-2 right-2 flex gap-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-70"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            {imageUrl ? 'Replace' : 'Add photo'}
          </button>
          {imageUrl && !busy && (
            <button
              onClick={onRemove}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-status-problem disabled:opacity-70"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      )}
      {error && <p className="px-3 py-1 text-xs text-status-problem">{error}</p>}
    </div>
  );
}
