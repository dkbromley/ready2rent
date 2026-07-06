'use client';

import { MemberRole } from '@prisma/client';
import { Trash2 } from 'lucide-react';
import { updateTeamMemberRole, removeTeamMember } from '@/server/actions';
import { SubmitButton } from '@/components/SubmitButton';
import { inputClass } from '@/components/ui';
import { cn } from '@/lib/utils';

/** Role picker + remove button for a member card. Rendered only for org
 * owners; self only gets the role picker (you can't remove yourself). */
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
  return (
    <div className="mt-3 flex items-center gap-2 border-t border-sand-100 pt-3">
      <form action={updateTeamMemberRole} className="flex flex-1 items-center gap-2">
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
          onSubmit={(e) => {
            if (!confirm(`Remove ${memberName} from the team? Their open jobs go back to the pool.`)) {
              e.preventDefault();
            }
          }}
        >
          <button
            className="rounded-lg p-2 text-navy-400 transition hover:bg-coral-50 hover:text-coral-600"
            title={`Remove ${memberName}`}
            aria-label={`Remove ${memberName} from the team`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </form>
      )}
    </div>
  );
}
