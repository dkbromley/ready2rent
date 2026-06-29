'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { PROPERTY_PALETTE, fallbackPropertyColor } from '@/lib/colors';
import { cn } from '@/lib/utils';

/**
 * Property calendar-color picker. Submits a hidden `calendarColor` hex value.
 * Offers the preset palette plus a native color input for anything custom.
 */
export function ColorPicker({
  name,
  propertyId,
  defaultValue,
}: {
  name: string;
  propertyId: string;
  defaultValue?: string | null;
}) {
  const initial = defaultValue ?? fallbackPropertyColor(propertyId);
  const [color, setColor] = useState(initial);

  return (
    <div>
      <input type="hidden" name={name} value={color} />
      <div className="flex flex-wrap items-center gap-2">
        {PROPERTY_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Use color ${c}`}
            onClick={() => setColor(c)}
            style={{ backgroundColor: c }}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-offset-2 transition',
              color.toLowerCase() === c.toLowerCase() ? 'ring-navy-400' : 'ring-transparent hover:ring-navy-200',
            )}
          >
            {color.toLowerCase() === c.toLowerCase() && <Check className="h-4 w-4 text-white" />}
          </button>
        ))}
        <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-navy-200 px-2.5 text-xs font-medium text-navy-600 hover:bg-navy-50">
          <span
            className="h-4 w-4 rounded-full ring-1 ring-inset ring-black/10"
            style={{ backgroundColor: color }}
          />
          Custom
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-0 w-0 opacity-0"
          />
        </label>
      </div>
    </div>
  );
}
