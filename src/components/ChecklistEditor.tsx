'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ChevronUp, ChevronDown, Loader2, Pencil, Check, X } from 'lucide-react';
import {
  addChecklistItem,
  deleteChecklistItem,
  moveChecklistItem,
  updateChecklistItem,
} from '@/server/actions';
import { inputClass } from '@/components/ui';

export interface ChecklistItem {
  id: string;
  text: string;
}

/**
 * Host-facing editor for a property's cleaning checklist: add, rename, reorder,
 * and delete the lines cleaners will tick off on each turnover.
 */
export function ChecklistEditor({
  propertyId,
  items,
}: {
  propertyId: string;
  items: ChecklistItem[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  function onAdd(formData: FormData) {
    startTransition(async () => {
      await addChecklistItem(propertyId, formData);
      formRef.current?.reset();
      refresh();
    });
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-navy-500">
          No checklist yet. Add the steps a cleaner should follow for this property.
        </p>
      ) : (
        <ol className="space-y-2">
          {items.map((item, i) => (
            <li key={item.id} className="flex items-start gap-2 rounded-xl bg-navy-50 p-2.5">
              <span className="mt-0.5 text-xs font-semibold text-navy-400">{i + 1}.</span>
              {editingId === item.id ? (
                <EditRow
                  item={item}
                  onDone={() => {
                    setEditingId(null);
                    refresh();
                  }}
                />
              ) : (
                <>
                  <span className="flex-1 text-sm text-navy-800">{item.text}</span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconBtn
                      label="Move up"
                      disabled={pending || i === 0}
                      onClick={() => startTransition(async () => { await moveChecklistItem(item.id, 'up'); refresh(); })}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn
                      label="Move down"
                      disabled={pending || i === items.length - 1}
                      onClick={() => startTransition(async () => { await moveChecklistItem(item.id, 'down'); refresh(); })}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn label="Edit" onClick={() => setEditingId(item.id)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn
                      label="Delete"
                      disabled={pending}
                      onClick={() => startTransition(async () => { await deleteChecklistItem(item.id); refresh(); })}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-status-problem" />
                    </IconBtn>
                  </div>
                </>
              )}
            </li>
          ))}
        </ol>
      )}

      <form ref={formRef} action={onAdd} className="flex items-center gap-2">
        <input
          name="text"
          required
          maxLength={280}
          placeholder="e.g. Stage 4 towels, fan-folded"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </form>
    </div>
  );
}

function EditRow({ item, onDone }: { item: ChecklistItem; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  function save(formData: FormData) {
    startTransition(async () => {
      await updateChecklistItem(item.id, formData);
      onDone();
    });
  }
  return (
    <form action={save} className="flex flex-1 items-center gap-2">
      <input name="text" defaultValue={item.text} maxLength={280} autoFocus className={inputClass} />
      <button type="submit" disabled={pending} aria-label="Save" className="rounded-lg p-1.5 text-status-completed hover:bg-white">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </button>
      <button type="button" onClick={onDone} aria-label="Cancel" className="rounded-lg p-1.5 text-navy-400 hover:bg-white">
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg p-1.5 text-navy-500 transition hover:bg-white disabled:opacity-30"
    >
      {children}
    </button>
  );
}
