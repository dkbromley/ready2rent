'use client';

import { useState } from 'react';
import { MemberRole } from '@prisma/client';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { updateTeamMemberRole, removeTeamMember } from '@/server/actions';
import { SubmitButton } from '@/components/SubmitButton';
import { inputClass } from '@/components/ui';
import { cn } from '@/lib/utils';

/** Compact "⋯" menu with the role picker + remove button, so member actions
 * fit a roster row. Rendered only for org owners; self only gets the role
 * picker (you can't remove yourself). */
export function MemberActions({
  memberId,
  memberName,
  currentRole,
  isSelf,
}: {
  memberId: string;
  memberName: string;
  currentRole: MemberRole;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${memberName}`}
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-1.5 text-navy-400 transition hover:bg-navy-50 hover:text-navy-700"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <>
          {/* Click-away backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
            tabIndex={-1}
          />
          <div className="card absolute right-0 z-20 mt-1 w-60 p-3 text-left shadow-card-hover">
            <p className="mb-2 truncate text-xs font-semibold text-navy-500">{memberName}</p>
            <form action={updateTeamMemberRole} className="flex items-center gap-2">
              <input type="hidden" name="memberId" value={memberId} />
              <select
                name="role"
                defaultValue={currentRole}
                className={cn(inputClass, 'flex-1 py-1.5 text-xs')}
                aria-label={`Role for ${memberName}`}
              >
                <option value="OWNER">Owner</option>
                <option value="MANAGER">Manager</option>
                <option value="MEMBER">Cleaner</option>
              </select>
              <SubmitButton pendingText="…" className="px-3 py-1.5 text-xs">
                Save
              </SubmitButton>
            </form>
            {!isSelf && (
              <form
                action={removeTeamMember.bind(null, memberId)}
                className="mt-2 border-t border-sand-100 pt-2"
                onSubmit={(e) => {
                  if (!confirm(`Remove ${memberName} from the team? Their open jobs go back to the pool.`)) {
                    e.preventDefault();
                  }
                }}
              >
                <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-coral-600 transition hover:bg-coral-50">
                  <Trash2 className="h-4 w-4" /> Remove from team
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
