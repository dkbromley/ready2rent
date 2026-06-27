import Link from 'next/link';
import Image from 'next/image';
import { Plus, Home, CalendarCheck, Sparkles, AlertTriangle } from 'lucide-react';
import { requireRole } from '@/lib/rbac';
import { UserRole } from '@prisma/client';
import { listProperties } from '@/server/queries';
import { PageHeader, LinkButton, EmptyState, Chip } from '@/components/ui';

export default async function PropertiesPage() {
  const user = await requireRole(UserRole.OWNER, UserRole.ADMIN);
  const properties = await listProperties(user);

  return (
    <div>
      <PageHeader
        title="Properties"
        subtitle="Manage your rentals and their connected calendars."
        action={
          <LinkButton href="/properties/new">
            <Plus className="h-4 w-4" /> Add property
          </LinkButton>
        }
      />

      {properties.length === 0 ? (
        <EmptyState
          title="No properties yet"
          description="Add your first rental, then connect its Airbnb or Vrbo calendar to start generating turnover jobs."
          action={<LinkButton href="/properties/new"><Plus className="h-4 w-4" /> Add property</LinkButton>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => {
            const activeFeeds = p.calendarFeeds.filter((f) => f.active);
            const hasFailure = activeFeeds.some((f) => f.lastSyncStatus === 'FAILED');
            const cleaner =
              p.assignedCleanerUser?.name ||
              p.assignedCleanerUser?.email ||
              p.assignedCleanerOrganization?.name;
            return (
              <Link key={p.id} href={`/properties/${p.id}`} className="card block p-5 transition hover:shadow-card-hover">
                {p.imageUrl && (
                  <div className="relative mb-3 aspect-[16/9] overflow-hidden rounded-xl bg-navy-100">
                    <Image src={p.imageUrl} alt={p.name} fill sizes="(max-width:640px) 100vw, 320px" className="object-cover" />
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <div className="rounded-xl bg-brand-50 p-2 text-brand-700">
                    <Home className="h-5 w-5" />
                  </div>
                  {hasFailure && (
                    <Chip className="bg-red-50 text-red-700 ring-red-600/20">
                      <AlertTriangle className="h-3 w-3" /> Sync error
                    </Chip>
                  )}
                </div>
                <h3 className="mt-3 truncate font-semibold text-navy-900">{p.name}</h3>
                <p className="truncate text-sm text-navy-500">
                  {[p.city, p.state].filter(Boolean).join(', ') || 'No address set'}
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-navy-500">
                  <span className="inline-flex items-center gap-1">
                    <CalendarCheck className="h-3.5 w-3.5" /> {activeFeeds.length} feed{activeFeeds.length !== 1 && 's'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {p._count.turnoverJobs} jobs
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {p.bedrooms} bd · {p.bathrooms} ba
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs">
                  <Sparkles className="h-3.5 w-3.5 text-navy-400" />
                  {cleaner ? (
                    <span className="text-navy-600">{cleaner}</span>
                  ) : (
                    <span className="font-medium text-amber-600">No cleaner assigned</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
