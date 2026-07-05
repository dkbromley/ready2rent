import { UserRole, MemberRole } from '@prisma/client';
import { Mail, UserPlus, Users, HandCoins, CircleCheck } from 'lucide-react';
import { requireRole } from '@/lib/rbac';
import { getCleanerTeam } from '@/server/queries';
import { inviteTeamMember, assignJobToMember, revokeInvitation } from '@/server/actions';
import { PageHeader, Card, SectionTitle, EmptyState, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { JobStatusBadge, SameDayBadge } from '@/components/StatusBadge';
import { formatMoney, PAYMENT_METHOD_LABEL } from '@/lib/money';
import { formatInTz } from '@/lib/datetime';
import { cn } from '@/lib/utils';

const ROLE_LABEL: Record<MemberRole, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  MEMBER: 'Cleaner',
};

export default async function TeamPage() {
  const user = await requireRole(UserRole.CLEANER, UserRole.ADMIN);
  const team = await getCleanerTeam(user);

  if (!team) {
    return (
      <div>
        <PageHeader title="Team" subtitle="Run your cleaning crew from one place." />
        <EmptyState
          title="No cleaning company on this account"
          description="Team features live on your cleaning company. This account isn't a member of one yet."
        />
      </div>
    );
  }

  const canManage = team.myRole !== MemberRole.MEMBER;

  return (
    <div>
      <PageHeader
        eyebrow={team.org.name}
        title="Your team"
        subtitle="Who's on the crew, what they've done this month, and who's taking each clean."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          {/* Members */}
          <div>
            <SectionTitle>Members</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {team.members.map((m) => (
                <Card key={m.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy-900">{m.user.name ?? m.user.email}</p>
                      <p className="truncate text-xs text-navy-400">{m.user.email}</p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset',
                        m.role === MemberRole.OWNER
                          ? 'bg-brand-50 text-brand-700 ring-brand-600/20'
                          : 'bg-navy-50 text-navy-600 ring-navy-600/10',
                      )}
                    >
                      {ROLE_LABEL[m.role]}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <span className="inline-flex items-center gap-1.5 text-navy-600">
                      <CircleCheck className="h-4 w-4 text-brand-500" />
                      <strong className="font-bold text-navy-900">{m.thisMonth.cleans}</strong> cleans this month
                    </span>
                    <span className="font-bold text-navy-900">{formatMoney(m.thisMonth.value)}</span>
                  </div>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-navy-400">
                    <HandCoins className="h-3.5 w-3.5" />
                    {m.user.payoutMethod && m.user.payoutHandle
                      ? `${PAYMENT_METHOD_LABEL[m.user.payoutMethod]}: ${m.user.payoutHandle}`
                      : 'No payout profile yet'}
                  </p>
                </Card>
              ))}
            </div>
            {team.unassignedThisMonth.cleans > 0 && (
              <p className="mt-2 text-xs text-navy-400">
                Plus {team.unassignedThisMonth.cleans} completed clean
                {team.unassignedThisMonth.cleans === 1 ? '' : 's'} ({formatMoney(team.unassignedThisMonth.value)})
                not attributed to a specific member.
              </p>
            )}
          </div>

          {/* Assignment worklist */}
          <div>
            <SectionTitle>Next two weeks — who&rsquo;s taking what</SectionTitle>
            {team.upcoming.length === 0 ? (
              <Card className="text-sm text-navy-500">No upcoming jobs assigned to your company.</Card>
            ) : (
              <div className="space-y-2">
                {team.upcoming.map((job) => (
                  <Card key={job.id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-navy-900">{job.property.name}</p>
                          {job.sameDayTurnover && <SameDayBadge />}
                          <JobStatusBadge status={job.status} />
                        </div>
                        <p className="mt-0.5 text-xs text-navy-500">
                          {formatInTz(job.checkoutDateTime, job.property.timezone)}
                        </p>
                      </div>
                      {canManage ? (
                        <form action={assignJobToMember} className="flex items-center gap-2">
                          <input type="hidden" name="jobId" value={job.id} />
                          <select
                            name="memberUserId"
                            defaultValue={job.assignedUser?.id ?? ''}
                            className={cn(inputClass, 'w-44 py-1.5')}
                            aria-label={`Assign ${job.property.name}`}
                          >
                            <option value="">Unassigned (pool)</option>
                            {team.members.map((m) => (
                              <option key={m.user.id} value={m.user.id}>
                                {m.user.name ?? m.user.email}
                              </option>
                            ))}
                          </select>
                          <SubmitButton pendingText="…">Save</SubmitButton>
                        </form>
                      ) : (
                        <span className="text-sm text-navy-500">
                          {job.assignedUser ? (job.assignedUser.name ?? job.assignedUser.email) : 'Unassigned'}
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Invite rail */}
        <div className="space-y-6">
          {canManage && (
            <Card>
              <SectionTitle>Invite a teammate</SectionTitle>
              <p className="mb-3 text-sm text-navy-500">
                They join {team.org.name}, see the jobs you hand them, and track their own schedule —
                free, always.
              </p>
              <form action={inviteTeamMember} className="space-y-3">
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="teammate@email.com"
                  className={inputClass}
                />
                <SubmitButton pendingText="Sending…">
                  <UserPlus className="h-4 w-4" /> Send invite
                </SubmitButton>
              </form>
            </Card>
          )}

          {team.pendingInvites.length > 0 && (
            <Card>
              <SectionTitle>Pending invites</SectionTitle>
              <ul className="space-y-2">
                {team.pendingInvites.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="inline-flex min-w-0 items-center gap-2 text-navy-700">
                      <Mail className="h-4 w-4 shrink-0 text-navy-400" />
                      <span className="truncate">{inv.email}</span>
                    </span>
                    {canManage && (
                      <form action={revokeInvitation.bind(null, inv.id)}>
                        <button className="text-xs font-medium text-navy-400 hover:text-coral-600">Revoke</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <div className="flex items-start gap-3">
              <span className="inline-flex rounded-xl bg-brand-50 p-2 text-brand-700 ring-1 ring-inset ring-brand-600/15">
                <Users className="h-5 w-5" />
              </span>
              <p className="text-sm leading-relaxed text-navy-600">
                Jobs assigned to <span className="font-semibold">{team.org.name}</span> land in the
                shared pool; hand each one to a teammate here and it appears on their schedule with
                the checklist and photo upload.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
