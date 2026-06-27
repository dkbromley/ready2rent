import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/rbac';
import { getCleanerCalendarJobs } from '@/server/queries';
import { PageHeader, LinkButton } from '@/components/ui';
import { JobCalendar } from '@/components/JobCalendar';
import { Plus } from 'lucide-react';

export default async function CleanerCalendarPage() {
  const user = await requireRole(UserRole.CLEANER, UserRole.ADMIN);
  const jobs = await getCleanerCalendarJobs(user);

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Your turnovers — switch between month, week, and day."
        action={
          <LinkButton href="/cleaner/properties/new">
            <Plus className="h-4 w-4" /> Add property
          </LinkButton>
        }
      />
      <JobCalendar jobs={jobs} />
    </div>
  );
}
