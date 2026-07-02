import Link from 'next/link';
import { ShieldCheck, Bell, ChevronRight } from 'lucide-react';
import { requireUser } from '@/lib/rbac';
import { PageHeader } from '@/components/ui';

export default async function SettingsPage() {
  const user = await requireUser();

  const items = [
    {
      href: '/settings/security',
      icon: <ShieldCheck className="h-5 w-5" />,
      title: 'Account & security',
      desc: 'Change your password.',
    },
    {
      href: '/settings/notifications',
      icon: <Bell className="h-5 w-5" />,
      title: 'Notifications',
      desc: 'Choose which alerts you receive.',
    },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Settings" title="Settings" subtitle={`Signed in as ${user.email ?? ''}`} />
      <div className="space-y-3">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="card flex items-center gap-4 p-5 transition duration-150 hover:-translate-y-0.5 hover:shadow-card-hover"
          >
            <span className="inline-flex rounded-xl bg-brand-50 p-2.5 text-brand-700 ring-1 ring-inset ring-brand-600/15">
              {it.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-navy-900">{it.title}</span>
              <span className="block text-sm text-navy-500">{it.desc}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-navy-400" />
          </Link>
        ))}
      </div>
    </div>
  );
}
