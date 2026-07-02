'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Minus, Trash2, Loader2, SprayCan, BedDouble, AlertTriangle } from 'lucide-react';
import {
  addInventoryItem,
  adjustInventoryQuantity,
  deleteInventoryItem,
} from '@/server/actions';
import { inputClass } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface InventoryItemView {
  id: string;
  category: 'SUPPLY' | 'LINEN';
  name: string;
  size: string | null;
  unit: string | null;
  quantity: number;
  parLevel: number | null;
}

/**
 * Per-property inventory: cleaning supplies and linens (by size). Hosts and the
 * assigned cleaner can add items, adjust counts with +/- steppers, and delete.
 * Items at/under their par level are flagged low.
 */
export function InventoryManager({
  propertyId,
  items,
}: {
  propertyId: string;
  items: InventoryItemView[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState<'SUPPLY' | 'LINEN'>('SUPPLY');

  function refresh() {
    router.refresh();
  }

  function onAdd(formData: FormData) {
    startTransition(async () => {
      await addInventoryItem(propertyId, formData);
      formRef.current?.reset();
      setCategory('SUPPLY');
      refresh();
    });
  }

  const supplies = items.filter((i) => i.category === 'SUPPLY');
  const linens = items.filter((i) => i.category === 'LINEN');

  return (
    <div className="space-y-5">
      <Group title="Cleaning supplies" icon={<SprayCan className="h-4 w-4" />} items={supplies} onRefresh={refresh} pending={pending} startTransition={startTransition} />
      <Group title="Linens" icon={<BedDouble className="h-4 w-4" />} items={linens} onRefresh={refresh} pending={pending} startTransition={startTransition} />

      <form ref={formRef} action={onAdd} className="space-y-2 border-t border-navy-100 pt-4">
        <p className="text-xs font-medium text-navy-400">Add an item</p>
        <div className="flex gap-2">
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as 'SUPPLY' | 'LINEN')}
            className={cn(inputClass, 'w-32 shrink-0')}
          >
            <option value="SUPPLY">Supply</option>
            <option value="LINEN">Linen</option>
          </select>
          <input name="name" required placeholder={category === 'LINEN' ? 'Bath towels' : 'Dish soap'} className={inputClass} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input name="size" placeholder={category === 'LINEN' ? 'Size (Queen)' : 'Size'} className={inputClass} />
          <input name="unit" placeholder="Unit (sets)" className={inputClass} />
          <input name="quantity" type="number" min={0} defaultValue={0} placeholder="Qty" className={inputClass} />
        </div>
        <div className="flex items-center gap-2">
          <input name="parLevel" type="number" min={0} placeholder="Par level (low-stock alert)" className={inputClass} />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </button>
        </div>
      </form>
    </div>
  );
}

function Group({
  title,
  icon,
  items,
  onRefresh,
  pending,
  startTransition,
}: {
  title: string;
  icon: React.ReactNode;
  items: InventoryItemView[];
  onRefresh: () => void;
  pending: boolean;
  startTransition: React.TransitionStartFunction;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-navy-400">
        {icon} {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => {
          const low = item.parLevel != null && item.quantity <= item.parLevel;
          return (
            <li key={item.id} className="flex items-center gap-2 rounded-xl bg-navy-50 p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-navy-800">
                  {item.name}
                  {item.size && <span className="ml-1 text-xs font-normal text-navy-500">· {item.size}</span>}
                </p>
                {low && (
                  <p className="flex items-center gap-1 text-xs font-medium text-status-problem">
                    <AlertTriangle className="h-3 w-3" /> Low (par {item.parLevel})
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Stepper
                  disabled={pending}
                  onClick={() => startTransition(async () => { await adjustInventoryQuantity(item.id, -1); onRefresh(); })}
                  label="Decrease"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Stepper>
                <span className={cn('w-12 text-center text-sm font-semibold tabular-nums', low ? 'text-status-problem' : 'text-navy-900')}>
                  {item.quantity}
                  {item.unit && <span className="ml-0.5 text-[10px] font-normal text-navy-400">{item.unit}</span>}
                </span>
                <Stepper
                  disabled={pending}
                  onClick={() => startTransition(async () => { await adjustInventoryQuantity(item.id, 1); onRefresh(); })}
                  label="Increase"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Stepper>
                <button
                  type="button"
                  aria-label="Delete item"
                  disabled={pending}
                  onClick={() => startTransition(async () => { await deleteInventoryItem(item.id); onRefresh(); })}
                  className="ml-1 rounded-lg p-1.5 text-navy-400 transition hover:bg-sand-100 hover:text-status-problem disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stepper({
  children,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-surface p-1.5 text-navy-600 ring-1 ring-inset ring-navy-200 transition hover:bg-navy-50 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
