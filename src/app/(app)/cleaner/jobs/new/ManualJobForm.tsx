'use client';

import { useState } from 'react';
import { Home, UserPlus } from 'lucide-react';
import { createManualJob } from '@/server/actions';
import { Card, Field, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { cn } from '@/lib/utils';

const TYPES = [
  { value: 'ONE_OFF', label: 'One-off clean', desc: 'A single scheduled clean' },
  { value: 'MOVE_OUT', label: 'Move-out', desc: 'Photo proof protects deposits' },
  { value: 'DEEP_CLEAN', label: 'Deep clean', desc: 'The big periodic reset' },
] as const;

export function ManualJobForm({ properties }: { properties: { id: string; name: string }[] }) {
  const [mode, setMode] = useState<'existing' | 'new'>(properties.length > 0 ? 'existing' : 'new');
  const [type, setType] = useState<string>('ONE_OFF');

  return (
    <Card>
      <form action={createManualJob} className="space-y-5">
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="type" value={type} />

        {/* Job kind */}
        <div className="grid gap-3 sm:grid-cols-3">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={cn(
                'rounded-xl border p-3 text-left transition',
                type === t.value
                  ? 'border-brand-500 bg-brand-50 ring-1 ring-inset ring-brand-500'
                  : 'border-sand-200 hover:border-brand-300',
              )}
            >
              <p className="text-sm font-bold text-navy-900">{t.label}</p>
              <p className="mt-0.5 text-xs text-navy-500">{t.desc}</p>
            </button>
          ))}
        </div>

        {/* Where */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode('existing')}
            disabled={properties.length === 0}
            className={cn(
              'flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold transition disabled:opacity-50',
              mode === 'existing'
                ? 'border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-500'
                : 'border-sand-200 text-navy-700 hover:border-brand-300',
            )}
          >
            <Home className="h-4 w-4" /> A property I service
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={cn(
              'flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold transition',
              mode === 'new'
                ? 'border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-500'
                : 'border-sand-200 text-navy-700 hover:border-brand-300',
            )}
          >
            <UserPlus className="h-4 w-4" /> A new client
          </button>
        </div>

        {mode === 'existing' ? (
          <Field label="Property">
            <select name="propertyId" required className={inputClass}>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Client / job name" hint="e.g. “Smith move-out” — this is how it appears on your schedule.">
                <input name="clientName" required maxLength={160} className={inputClass} placeholder="Smith move-out" />
              </Field>
            </div>
            <Field label="Address (optional)">
              <input name="clientAddress" maxLength={240} className={inputClass} placeholder="123 Pelican St" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City">
                <input name="clientCity" maxLength={120} className={inputClass} placeholder="Ocean Isle Beach" />
              </Field>
              <Field label="State">
                <input name="clientState" maxLength={60} className={inputClass} placeholder="NC" />
              </Field>
            </div>
          </div>
        )}

        {/* When & how much */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Date">
            <input name="date" type="date" required className={inputClass} />
          </Field>
          <Field label="Start time">
            <input name="startTime" type="time" defaultValue="10:00" className={inputClass} />
          </Field>
          <Field label="Price ($)" hint="Logged as a payment due on completion.">
            <input name="price" type="number" min={0} max={100000} className={inputClass} placeholder="150" />
          </Field>
        </div>

        <Field label="Notes (optional)">
          <textarea name="notes" rows={3} maxLength={2000} className={inputClass} placeholder="Gate code, focus areas, what the client asked for…" />
        </Field>

        <SubmitButton pendingText="Scheduling…">Schedule job</SubmitButton>
      </form>
    </Card>
  );
}
