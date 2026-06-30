import Link from 'next/link';
import Image from 'next/image';
import { Plus, Home, CalendarCheck, Mail, AlertTriangle, Trash2 } from 'lucide-react';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/rbac';
import { listCleanerProperties } from '@/server/queries';
import { removeProperty } from '@/server/actions';
import { PageHeader, LinkButton, EmptyState, Chip } from '@/components/ui';

export default async function CleanerPropertiesPage() {
  const user = await requireRole(UserRole.CLEANER, UserRole.ADMIN);
  const properties = await listCleanerProperties(user);

  return (
    <div>
      <PageHeader
        title="My properties"
        subtitle="Properties you clean. Add one with the host's calendar link — no host account needed."
        action={
          <LinkButton href="/cleaner/properties/new">
            <Plus className="h-4 w-4" /> Add property
          </LinkButton>
        }
      />

      {properties.length === 0 ? (
        <EmptyState
          title="No properties yet"
          description="Get the Airbnb or Vrbo iCal link from a host you work for, paste it here, and the turnover schedule imports automatically."
          action={<LinkButton href="/cleaner/properties/new"><Plus className="h-4 w-4" /> Add your first property</LinkButton>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => {
            const activeFeeds = p.calendarFeeds.filter((f) => f.active);
            const hasFailure = activeFeeds.some((f) => f.lastSyncStatus === 'FAILED');
            return (
              <div key={p.id} className="card flex flex-col p-5">
                <Link href={`/properties/${p.id}`} className="flex-1">
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
                    <span>{p._count.turnoverJobs} turnovers</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs">
                    <Mail className="h-3.5 w-3.5 text-navy-400" />
                    {p.ownerContact?.email ? (
                      <span className="text-navy-600">Host notified: {p.ownerContact.email}</span>
                    ) : (
                      <span className="text-navy-400">No host contact</span>
                    )}
                  </div>
                </Link>
                <form action={removeProperty.bind(null, p.id)} className="mt-3 border-t border-navy-50 pt-3">
                  <button className="inline-flex items-center gap-1 text-xs text-navy-400 hover:text-status-problem">
                    <Trash2 className="h-3 w-3" /> Remove property
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
