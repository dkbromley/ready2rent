import Link from 'next/link';
import { UserRole, MemberRole } from '@prisma/client';
import { Mail, UserPlus, Users, HandCoins, CircleCheck, Circle, Building2, ChevronDown, X, ClipboardList } from 'lucide-react';
import { requireRole } from '@/lib/rbac';
import { getCleanerTeam } from '@/server/queries';
import {
  inviteTeamMember,
  assignJobToMember,
  revokeInvitation,
  updateBusinessProfile,
  addTeamOnboardingItem,
  deleteTeamOnboardingItem,
  addStarterOnboardingItems,
  toggleTeamOnboardingCheck,
} from '@/server/actions';
import { PageHeader, Card, SectionTitle, EmptyState, inputClass, Field } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { JobStatusBadge, SameDayBadge } from '@/components/StatusBadge';
import { MemberActions } from './MemberActions';
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
  const isOwner = team.myRole === MemberRole.OWNER;

  const setupSteps = [
    { done: team.setup.hasDetails, label: 'Fill in your business details', href: '#business' },
    { done: team.setup.hasPayout, label: 'Set how you get paid', href: '/settings/payments' },
    { done: team.setup.hasTeammate, label: 'Invite your first teammate', href: '#invite' },
    { done: team.setup.hasAssignment, label: 'Hand a job to a teammate', href: '#worklist' },
  ];
  const setupDone = setupSteps.filter((s) => s.done).length;

  return (
    <div>
      <PageHeader
        eyebrow={team.org.name}
        title="Your team"
        subtitle="Who's on the crew, what they've done this month, and who's taking each clean."
      />

      {/* Crew setup — hides itself once every step is done. */}
      {canManage && setupDone < setupSteps.length && (
        <Card className="mb-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-500">
              Crew setup
            </h2>
            <span className="text-xs font-bold text-brand-700">{setupDone}/{setupSteps.length} done</span>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {setupSteps.map((s) => (
              <li key={s.label}>
                {s.done ? (
                  <span className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-navy-400">
                    <CircleCheck className="h-4 w-4 shrink-0 text-brand-500" />
                    <span className="line-through">{s.label}</span>
                  </span>
                ) : (
                  <Link
                    href={s.href}
                    className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold text-navy-800 transition hover:bg-brand-50 hover:text-brand-800"
                  >
                    <Circle className="h-4 w-4 shrink-0 text-navy-300" />
                    {s.label} →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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

                  {/* Per-member new-hire onboarding progress */}
                  {team.onboardingItems.length > 0 && (
                    <details className="group mt-3 border-t border-sand-100 pt-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold [&::-webkit-details-marker]:hidden">
                        <span
                          className={cn(
                            m.checkedItemIds.size === team.onboardingItems.length
                              ? 'text-brand-700'
                              : 'text-amber-700',
                          )}
                        >
                          Onboarding {m.checkedItemIds.size}/{team.onboardingItems.length}
                          {m.checkedItemIds.size === team.onboardingItems.length && ' ✓'}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 text-navy-400 transition-transform group-open:rotate-180" />
                      </summary>
                      <ul className="mt-2 space-y-0.5">
                        {team.onboardingItems.map((item) => {
                          const done = m.checkedItemIds.has(item.id);
                          const row = (
                            <>
                              {done ? (
                                <CircleCheck className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                              ) : (
                                <Circle className="h-3.5 w-3.5 shrink-0 text-navy-300" />
                              )}
                              <span className={cn('text-xs', done ? 'text-navy-400 line-through' : 'text-navy-700')}>
                                {item.text}
                              </span>
                            </>
                          );
                          return (
                            <li key={item.id}>
                              {canManage ? (
                                <form action={toggleTeamOnboardingCheck}>
                                  <input type="hidden" name="itemId" value={item.id} />
                                  <input type="hidden" name="memberId" value={m.id} />
                                  <button className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-sand-50">
                                    {row}
                                  </button>
                                </form>
                              ) : (
                                <span className="flex items-center gap-2 px-1.5 py-1">{row}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  )}
                  {isOwner && (
                    <MemberActions
                      memberId={m.id}
                      memberName={m.user.name ?? m.user.email}
                      currentRole={m.role}
                      isSelf={m.user.id === user.id}
                    />
                  )}
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
          <div id="worklist" className="scroll-mt-24">
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
            <Card className="scroll-mt-24" id="business">
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex rounded-xl bg-brand-50 p-2 text-brand-700 ring-1 ring-inset ring-brand-600/15">
                  <Building2 className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-500">Business details</h2>
              </div>
              <form action={updateBusinessProfile} className="space-y-3">
                <Field label="Business name">
                  <input name="name" required maxLength={160} defaultValue={team.org.name} className={inputClass} />
                </Field>
                <Field label="Phone (optional)">
                  <input name="phone" maxLength={40} defaultValue={team.profile?.phone ?? ''} className={inputClass} placeholder="(910) 555-0134" />
                </Field>
                <Field label="Service areas" hint="Comma-separated — shown to hosts (and on your business page later).">
                  <input
                    name="serviceAreas"
                    maxLength={400}
                    defaultValue={team.profile?.serviceAreas.join(', ') ?? ''}
                    className={inputClass}
                    placeholder="Sunset Beach, Ocean Isle Beach, Holden Beach"
                  />
                </Field>
                <Field label="About your business (optional)">
                  <textarea name="bio" rows={3} maxLength={1000} defaultValue={team.profile?.bio ?? ''} className={inputClass} placeholder="Family-run crew serving the Brunswick Islands since 2019…" />
                </Field>
                <SubmitButton pendingText="Saving…">Save details</SubmitButton>
              </form>
            </Card>
          )}

          {canManage && (
            <Card className="scroll-mt-24" id="invite">
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

          {canManage && (
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex rounded-xl bg-brand-50 p-2 text-brand-700 ring-1 ring-inset ring-brand-600/15">
                  <ClipboardList className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-500">New-hire checklist</h2>
              </div>
              <p className="mb-3 text-sm text-navy-500">
                The steps every new teammate completes — tick them off on each member&rsquo;s card.
              </p>
              {team.onboardingItems.length === 0 ? (
                <form action={addStarterOnboardingItems} className="mb-3">
                  <SubmitButton variant="secondary" pendingText="Adding…">
                    Add starter checklist
                  </SubmitButton>
                </form>
              ) : (
                <ul className="mb-3 space-y-1">
                  {team.onboardingItems.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-sm text-navy-700 hover:bg-sand-50">
                      <span className="min-w-0 truncate">{item.text}</span>
                      <form action={deleteTeamOnboardingItem.bind(null, item.id)}>
                        <button
                          className="rounded p-1 text-navy-300 transition hover:text-coral-600"
                          title={`Remove "${item.text}"`}
                          aria-label={`Remove onboarding item: ${item.text}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <form action={addTeamOnboardingItem} className="flex gap-2">
                <input
                  name="text"
                  required
                  maxLength={200}
                  placeholder="Add an item…"
                  className={cn(inputClass, 'flex-1 py-1.5 text-sm')}
                />
                <SubmitButton variant="secondary" pendingText="…" className="px-3 py-1.5 text-xs">
                  Add
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
