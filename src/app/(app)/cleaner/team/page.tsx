import Link from 'next/link';
import { differenceInCalendarDays, format } from 'date-fns';
import { UserRole, MemberRole } from '@prisma/client';
import {
  Mail,
  UserPlus,
  Users,
  HandCoins,
  CircleCheck,
  Circle,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Send,
  X,
} from 'lucide-react';
import { requireRole } from '@/lib/rbac';
import { getCleanerTeam } from '@/server/queries';
import {
  inviteTeamMember,
  assignJobToMember,
  revokeInvitation,
  resendInvitation,
  updateBusinessProfile,
  addTeamOnboardingItem,
  deleteTeamOnboardingItem,
  moveTeamOnboardingItem,
  addStarterOnboardingItems,
  toggleTeamOnboardingCheck,
} from '@/server/actions';
import { PageHeader, Card, SectionTitle, EmptyState, inputClass, Field, StatTile, Chip } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { JobStatusBadge, SameDayBadge } from '@/components/StatusBadge';
import { MemberActions } from './MemberActions';
import { AssignSelect } from './AssignSelect';
import { formatMoney, PAYMENT_METHOD_LABEL } from '@/lib/money';
import { formatInTz } from '@/lib/datetime';
import { cn } from '@/lib/utils';

const ROLE_LABEL: Record<MemberRole, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  MEMBER: 'Cleaner',
};

function daysAgoLabel(date: Date): string {
  const days = differenceInCalendarDays(new Date(), date);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

function RoleChip({ role }: { role: MemberRole }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset',
        role === MemberRole.OWNER
          ? 'bg-brand-50 text-brand-700 ring-brand-600/20'
          : 'bg-navy-50 text-navy-600 ring-navy-600/10',
      )}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

function ProgressBar({ done, total, className }: { done: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <span
      className={cn('block h-1.5 overflow-hidden rounded-full bg-sand-100', className)}
      role="img"
      aria-label={`${done} of ${total} onboarding steps complete`}
    >
      <span
        className={cn('block h-full rounded-full', done >= total ? 'bg-brand-500' : 'bg-amber-500')}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}

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

  // Onboarding pipeline: pending invites → members mid-checklist → fully onboarded.
  const totalItems = team.onboardingItems.length;
  const membersWithProgress = team.members.map((m) => ({
    ...m,
    doneCount: team.onboardingItems.filter((i) => m.checks.has(i.id)).length,
  }));
  const stillOnboarding = totalItems > 0 ? membersWithProgress.filter((m) => m.doneCount < totalItems) : [];
  const fullyOnboarded =
    totalItems > 0 ? membersWithProgress.filter((m) => m.doneCount >= totalItems) : membersWithProgress;

  const unassignedUpcoming = team.upcoming.filter((j) => !j.assignedUser).length;
  // pendingInvites are newest-first, so the last one is the oldest.
  const oldestInvite = team.pendingInvites[team.pendingInvites.length - 1];
  const hasStaleInvite = Boolean(
    oldestInvite && differenceInCalendarDays(new Date(), oldestInvite.createdAt) >= 7,
  );

  const activeNames = fullyOnboarded.map((m) => m.user.name ?? m.user.email);
  const activeLine =
    totalItems === 0
      ? `All ${team.members.length} member${team.members.length === 1 ? ' is' : 's are'} active`
      : fullyOnboarded.length === team.members.length
        ? 'Everyone is fully onboarded'
        : fullyOnboarded.length > 3
          ? `${fullyOnboarded.length} teammates are fully onboarded`
          : `${joinNames(activeNames)} ${fullyOnboarded.length === 1 ? 'is' : 'are'} fully onboarded`;

  // Worklist grouped by checkout day (in each property's timezone). Jobs are
  // sorted by checkout time, so consecutive grouping preserves order.
  const days: { label: string; jobs: typeof team.upcoming }[] = [];
  for (const job of team.upcoming) {
    const label = formatInTz(job.checkoutDateTime, job.property.timezone, 'EEEE, MMM d');
    const last = days[days.length - 1];
    if (last && last.label === label) last.jobs.push(job);
    else days.push({ label, jobs: [job] });
  }

  const memberOptions = team.members.map((m) => ({
    value: m.user.id,
    label: m.user.name ?? m.user.email,
  }));

  return (
    <div>
      <PageHeader
        eyebrow={team.org.name}
        title="Your team"
        subtitle="Who's ready to work, who's still onboarding, and who's taking each clean."
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

      {/* Summary strip — the four numbers a manager scans first. */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          icon={<Users className="h-5 w-5" />}
          label="Members"
          value={team.members.length}
          tone="teal"
          hint={totalItems > 0 ? `${fullyOnboarded.length} ready to work` : undefined}
        />
        <StatTile
          icon={<ClipboardList className="h-5 w-5" />}
          label="Still onboarding"
          value={totalItems === 0 ? '—' : stillOnboarding.length}
          tone={stillOnboarding.length > 0 ? 'amber' : 'green'}
          href="#onboarding"
          hint={
            totalItems === 0
              ? 'No checklist yet'
              : stillOnboarding.length === 1
                ? `${(stillOnboarding[0].user.name ?? stillOnboarding[0].user.email).split(/\s+/)[0]} — ${
                    totalItems - stillOnboarding[0].doneCount
                  } step${totalItems - stillOnboarding[0].doneCount === 1 ? '' : 's'} left`
                : stillOnboarding.length === 0
                  ? 'Everyone is ready'
                  : undefined
          }
        />
        <StatTile
          icon={<Mail className="h-5 w-5" />}
          label="Pending invites"
          value={team.pendingInvites.length}
          tone={hasStaleInvite ? 'amber' : 'neutral'}
          href="#onboarding"
          hint={oldestInvite ? `Oldest sent ${daysAgoLabel(oldestInvite.createdAt)}` : undefined}
        />
        <StatTile
          icon={<CalendarClock className="h-5 w-5" />}
          label="Unassigned cleans"
          value={unassignedUpcoming}
          tone={unassignedUpcoming > 0 ? 'coral' : 'green'}
          href="#worklist"
          hint={unassignedUpcoming > 0 ? 'Next 14 days — assign below' : 'Next 14 days — all covered'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          {/* Onboarding pipeline: Invited → Onboarding → Active. */}
          <div id="onboarding" className="scroll-mt-24">
            <SectionTitle>Onboarding</SectionTitle>
            <Card className="divide-y divide-sand-100 p-0">
              {team.pendingInvites.map((inv) => {
                const stale = differenceInCalendarDays(new Date(), inv.createdAt) >= 7;
                return (
                  <div key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-4">
                    <Chip className="bg-navy-50 text-navy-600 ring-navy-600/10">Invited</Chip>
                    <span className="min-w-0 truncate text-sm font-semibold text-navy-900">{inv.email}</span>
                    <span className={cn('text-xs', stale ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-navy-400')}>
                      Sent {daysAgoLabel(inv.createdAt)}
                      {stale && ' — no response'}
                    </span>
                    {canManage && (
                      <span className="ml-auto flex items-center gap-2">
                        <form action={resendInvitation.bind(null, inv.id)}>
                          <SubmitButton variant="secondary" pendingText="Sending…" className="px-3 py-1.5 text-xs">
                            <Send className="h-3.5 w-3.5" /> Resend
                          </SubmitButton>
                        </form>
                        <form action={revokeInvitation.bind(null, inv.id)}>
                          <button className="text-xs font-medium text-navy-400 hover:text-coral-600">Revoke</button>
                        </form>
                      </span>
                    )}
                  </div>
                );
              })}

              {stillOnboarding.map((m) => {
                // Remaining steps first — they're what the manager acts on.
                const orderedItems = [...team.onboardingItems].sort(
                  (a, b) => Number(m.checks.has(a.id)) - Number(m.checks.has(b.id)),
                );
                return (
                  <div key={m.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Chip className="bg-amber-50 text-amber-700 ring-amber-600/20">Onboarding</Chip>
                      <span className="text-sm font-semibold text-navy-900">{m.user.name ?? m.user.email}</span>
                      <span className="ml-auto text-xs tabular-nums text-navy-400">
                        {m.doneCount} of {totalItems} done · joined {format(m.joinedAt, 'MMM d')}
                      </span>
                    </div>
                    <ProgressBar done={m.doneCount} total={totalItems} className="mb-3 mt-2" />
                    <ul className="space-y-0.5">
                      {orderedItems.map((item) => {
                        const check = m.checks.get(item.id);
                        const row = (
                          <>
                            {check ? (
                              <CircleCheck className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 shrink-0 text-navy-300" />
                            )}
                            <span className={cn('min-w-0 truncate text-xs', check ? 'text-navy-400 line-through' : 'text-navy-700')}>
                              {item.text}
                            </span>
                            {check && (
                              <span className="ml-auto shrink-0 text-[11px] text-navy-300">
                                {check.checkedByName ? `${check.checkedByName} · ` : ''}
                                {format(check.checkedAt, 'MMM d')}
                              </span>
                            )}
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
                  </div>
                );
              })}

              {(fullyOnboarded.length > 0 || totalItems === 0) && (
                <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <Chip className="bg-brand-50 text-brand-700 ring-brand-600/20">Active</Chip>
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-brand-700 dark:text-brand-400">
                    <CircleCheck className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">{activeLine}</span>
                  </span>
                </div>
              )}

              {canManage && (
                <details className="group px-5 py-4" open={totalItems === 0}>
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-navy-500 [&::-webkit-details-marker]:hidden">
                    <ClipboardList className="h-4 w-4 text-navy-400" />
                    Manage the new-hire checklist
                    <span className="text-xs font-bold tabular-nums text-navy-400">
                      ({totalItems} {totalItems === 1 ? 'item' : 'items'})
                    </span>
                    <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-navy-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-3">
                    <p className="mb-3 text-xs text-navy-400">
                      The steps every new teammate completes — tick them off above as each person gets through them.
                    </p>
                    {totalItems === 0 ? (
                      <form action={addStarterOnboardingItems} className="mb-3">
                        <SubmitButton variant="secondary" pendingText="Adding…">
                          Add starter checklist
                        </SubmitButton>
                      </form>
                    ) : (
                      <ul className="mb-3 space-y-1">
                        {team.onboardingItems.map((item, idx) => (
                          <li
                            key={item.id}
                            className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm text-navy-700 hover:bg-sand-50"
                          >
                            <span className="flex flex-col">
                              <form action={moveTeamOnboardingItem}>
                                <input type="hidden" name="itemId" value={item.id} />
                                <input type="hidden" name="direction" value="up" />
                                <button
                                  disabled={idx === 0}
                                  className="block rounded p-0.5 text-navy-300 transition hover:text-navy-700 disabled:opacity-30 disabled:hover:text-navy-300"
                                  aria-label={`Move "${item.text}" up`}
                                >
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </button>
                              </form>
                              <form action={moveTeamOnboardingItem}>
                                <input type="hidden" name="itemId" value={item.id} />
                                <input type="hidden" name="direction" value="down" />
                                <button
                                  disabled={idx === team.onboardingItems.length - 1}
                                  className="block rounded p-0.5 text-navy-300 transition hover:text-navy-700 disabled:opacity-30 disabled:hover:text-navy-300"
                                  aria-label={`Move "${item.text}" down`}
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                              </form>
                            </span>
                            <span className="min-w-0 flex-1 truncate">{item.text}</span>
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
                        placeholder="Add a step…"
                        className={cn(inputClass, 'flex-1 py-1.5 text-sm')}
                      />
                      <SubmitButton variant="secondary" pendingText="…" className="px-3 py-1.5 text-xs">
                        Add
                      </SubmitButton>
                    </form>
                  </div>
                </details>
              )}
            </Card>
          </div>

          {/* Roster — table on desktop, cards on mobile. */}
          <div>
            <SectionTitle
              action={<span className="text-xs text-navy-400">Cleans &amp; value — this month</span>}
            >
              Roster
            </SectionTitle>

            <Card className="hidden md:block">
              <div className="-mx-5 overflow-x-auto px-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-sand-100 text-left text-[11px] font-semibold uppercase tracking-wider text-navy-400">
                      <th className="pb-2 pr-3 font-semibold">Teammate</th>
                      <th className="pb-2 pr-3 font-semibold">Onboarding</th>
                      <th className="pb-2 pr-3 text-right font-semibold">Cleans</th>
                      <th className="pb-2 pr-3 text-right font-semibold">Value</th>
                      <th className="pb-2 pr-3 font-semibold">Payout</th>
                      {isOwner && (
                        <th className="pb-2">
                          <span className="sr-only">Actions</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-100">
                    {membersWithProgress.map((m) => (
                      <tr key={m.id}>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-navy-900">{m.user.name ?? m.user.email}</span>
                            <RoleChip role={m.role} />
                          </div>
                          <p className="text-xs text-navy-400">{m.user.email}</p>
                        </td>
                        <td className="py-3 pr-3">
                          {totalItems === 0 ? (
                            <span className="text-xs text-navy-300">—</span>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <ProgressBar done={m.doneCount} total={totalItems} className="w-14" />
                              <span
                                className={cn(
                                  'text-xs font-bold tabular-nums',
                                  m.doneCount >= totalItems
                                    ? 'text-brand-700 dark:text-brand-400'
                                    : 'text-amber-700 dark:text-amber-300',
                                )}
                              >
                                {m.doneCount >= totalItems ? '✓' : `${m.doneCount}/${totalItems}`}
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-right font-bold tabular-nums text-navy-900">
                          {m.thisMonth.cleans}
                        </td>
                        <td className="py-3 pr-3 text-right font-bold tabular-nums text-navy-900">
                          {formatMoney(m.thisMonth.value)}
                        </td>
                        <td className="py-3 pr-3">
                          {m.user.payoutMethod && m.user.payoutHandle ? (
                            <span className="text-xs text-navy-500">
                              {PAYMENT_METHOD_LABEL[m.user.payoutMethod]}: {m.user.payoutHandle}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                              No payout profile
                            </span>
                          )}
                        </td>
                        {isOwner && (
                          <td className="py-3 text-right">
                            <MemberActions
                              memberId={m.id}
                              memberName={m.user.name ?? m.user.email}
                              currentRole={m.role}
                              isSelf={m.user.id === user.id}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="grid gap-3 md:hidden">
              {membersWithProgress.map((m) => (
                <Card key={m.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-navy-900">{m.user.name ?? m.user.email}</p>
                        <RoleChip role={m.role} />
                      </div>
                      <p className="truncate text-xs text-navy-400">{m.user.email}</p>
                    </div>
                    {isOwner && (
                      <MemberActions
                        memberId={m.id}
                        memberName={m.user.name ?? m.user.email}
                        currentRole={m.role}
                        isSelf={m.user.id === user.id}
                      />
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="text-navy-600">
                      <strong className="font-bold text-navy-900">{m.thisMonth.cleans}</strong> cleans
                    </span>
                    <span className="font-bold tabular-nums text-navy-900">{formatMoney(m.thisMonth.value)}</span>
                    {totalItems > 0 && (
                      <span
                        className={cn(
                          'text-xs font-bold tabular-nums',
                          m.doneCount >= totalItems
                            ? 'text-brand-700 dark:text-brand-400'
                            : 'text-amber-700 dark:text-amber-300',
                        )}
                      >
                        Onboarding {m.doneCount >= totalItems ? '✓' : `${m.doneCount}/${totalItems}`}
                      </span>
                    )}
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

          {/* Assignment worklist, grouped by day */}
          <div id="worklist" className="scroll-mt-24">
            <SectionTitle>Next two weeks — who&rsquo;s taking what</SectionTitle>
            {team.upcoming.length === 0 ? (
              <Card className="text-sm text-navy-500">No upcoming jobs assigned to your company.</Card>
            ) : (
              <div className="space-y-4">
                {days.map((day) => {
                  const dayUnassigned = day.jobs.filter((j) => !j.assignedUser).length;
                  return (
                    <div key={day.label}>
                      <div className="mb-2 flex flex-wrap items-baseline gap-2 px-1">
                        <p className="text-sm font-bold text-navy-700">{day.label}</p>
                        <span className="text-xs text-navy-400">
                          · {day.jobs.length} clean{day.jobs.length === 1 ? '' : 's'}
                        </span>
                        {dayUnassigned > 0 && (
                          <span className="ml-auto text-xs font-bold text-coral-600 dark:text-coral-300">
                            {dayUnassigned} unassigned
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {day.jobs.map((job) => (
                          <Card
                            key={job.id}
                            className={cn(
                              'p-4',
                              !job.assignedUser && canManage && 'ring-1 ring-inset ring-coral-500/25',
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold text-navy-900">{job.property.name}</p>
                                  {job.sameDayTurnover && <SameDayBadge />}
                                  <JobStatusBadge status={job.status} />
                                </div>
                                <p className="mt-0.5 text-xs text-navy-500">
                                  Checkout {formatInTz(job.checkoutDateTime, job.property.timezone, 'h:mm a')}
                                </p>
                              </div>
                              {canManage ? (
                                <form action={assignJobToMember}>
                                  <input type="hidden" name="jobId" value={job.id} />
                                  <AssignSelect
                                    defaultValue={job.assignedUser?.id ?? ''}
                                    ariaLabel={`Assign ${job.property.name}`}
                                    options={memberOptions}
                                  />
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Right rail — invite first, business details tucked away. */}
        <div className="space-y-6">
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
            <Card className="scroll-mt-24" id="business">
              <details className="group" open={!team.setup.hasDetails}>
                <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex rounded-xl bg-brand-50 p-2 text-brand-700 ring-1 ring-inset ring-brand-600/15">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-500">Business details</h2>
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-navy-400 transition-transform group-open:rotate-180" />
                </summary>
                <form action={updateBusinessProfile} className="mt-4 space-y-3">
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
              </details>
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
