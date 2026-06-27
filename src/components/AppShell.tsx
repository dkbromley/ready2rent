'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { UserRole } from '@prisma/client';
import {
  Waves,
  LayoutDashboard,
  Home,
  CalendarDays,
  Sparkles,
  Activity,
  Users,
  Bell,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOutAction } from '@/app/(app)/auth-actions';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, roles: [UserRole.OWNER, UserRole.ADMIN] },
  { href: '/properties', label: 'Properties', icon: <Home className="h-5 w-5" />, roles: [UserRole.OWNER, UserRole.ADMIN] },
  { href: '/jobs', label: 'Turnovers', icon: <CalendarDays className="h-5 w-5" />, roles: [UserRole.OWNER, UserRole.ADMIN] },
  { href: '/cleaner', label: 'My jobs', icon: <Sparkles className="h-5 w-5" />, roles: [UserRole.CLEANER, UserRole.ADMIN] },
  { href: '/admin', label: 'Admin', icon: <Users className="h-5 w-5" />, roles: [UserRole.ADMIN] },
  { href: '/admin/sync', label: 'Sync health', icon: <Activity className="h-5 w-5" />, roles: [UserRole.ADMIN] },
];

export function AppShell({
  role,
  name,
  email,
  unread,
  children,
}: {
  role: UserRole;
  name: string | null | undefined;
  email: string | null | undefined;
  unread: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((i) => i.roles.includes(role));

  return (
    <div className="min-h-screen bg-sand-50">
      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-navy-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-1.5 text-navy-600 hover:bg-navy-50 lg:hidden" onClick={() => setOpen((v) => !v)}>
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link href="/dashboard" className="inline-flex items-center gap-2 font-bold text-navy-900">
              <Waves className="h-5 w-5 text-brand-600" /> TurnReady
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/notifications" className="relative rounded-lg p-2 text-navy-600 hover:bg-navy-50">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-problem px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-navy-800">{name ?? email}</p>
              <p className="text-xs capitalize text-navy-400">{role.toLowerCase()}</p>
            </div>
            <form action={signOutAction}>
              <button className="rounded-lg p-2 text-navy-600 hover:bg-navy-50" title="Sign out">
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-20 w-60 transform border-r border-navy-100 bg-white pt-16 transition-transform lg:static lg:translate-x-0 lg:pt-0',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <nav className="flex flex-col gap-1 p-3">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
                    active ? 'bg-brand-50 text-brand-800' : 'text-navy-600 hover:bg-navy-50',
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {open && <div className="fixed inset-0 z-10 bg-navy-900/20 lg:hidden" onClick={() => setOpen(false)} />}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
