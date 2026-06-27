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
  Archive,
  BarChart3,
  LogOut,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOutAction } from '@/app/(app)/auth-actions';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
  primary?: boolean; // shown in the mobile bottom tab bar
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: <LayoutDashboard className="h-5 w-5" />, roles: [UserRole.OWNER, UserRole.ADMIN], primary: true },
  { href: '/jobs', label: 'Turnovers', icon: <CalendarDays className="h-5 w-5" />, roles: [UserRole.OWNER, UserRole.ADMIN], primary: true },
  { href: '/properties', label: 'Properties', icon: <Home className="h-5 w-5" />, roles: [UserRole.OWNER, UserRole.ADMIN], primary: true },
  { href: '/cleaner', label: 'My jobs', icon: <Sparkles className="h-5 w-5" />, roles: [UserRole.CLEANER, UserRole.ADMIN], primary: true },
  { href: '/cleaner/calendar', label: 'Calendar', icon: <CalendarDays className="h-5 w-5" />, roles: [UserRole.CLEANER, UserRole.ADMIN], primary: true },
  { href: '/cleaner/properties', label: 'Properties', icon: <Home className="h-5 w-5" />, roles: [UserRole.CLEANER, UserRole.ADMIN], primary: true },
  { href: '/archive', label: 'Archive', icon: <Archive className="h-5 w-5" />, roles: [UserRole.OWNER, UserRole.CLEANER, UserRole.ADMIN], primary: true },
  { href: '/analytics', label: 'Analytics', icon: <BarChart3 className="h-5 w-5" />, roles: [UserRole.OWNER] },
  { href: '/cleaner/analytics', label: 'Analytics', icon: <BarChart3 className="h-5 w-5" />, roles: [UserRole.CLEANER] },
  { href: '/admin/analytics', label: 'Analytics', icon: <BarChart3 className="h-5 w-5" />, roles: [UserRole.ADMIN] },
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const items = NAV.filter((i) => i.roles.includes(role));

  const activeHref = items
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  // Bottom tab bar: up to 4 primary items + a "More" tab opening the full drawer.
  const primary = items.filter((i) => i.primary).slice(0, 4);

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="sticky top-0 z-30 border-b border-navy-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 font-bold text-navy-900">
            <Waves className="h-5 w-5 text-brand-600" /> TurnReady
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/notifications" className="relative rounded-lg p-2 text-navy-600 hover:bg-navy-50">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral-500 px-1 text-[10px] font-bold text-white">
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
        {/* Sidebar — desktop static, mobile drawer (opened via "More"). */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 w-60 transform border-r border-navy-100 bg-white pt-4 transition-transform lg:static lg:z-0 lg:translate-x-0 lg:pt-0',
            drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          )}
        >
          <div className="flex items-center justify-between px-4 pb-2 lg:hidden">
            <span className="text-sm font-semibold text-navy-500">Menu</span>
            <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-1.5 text-navy-600 hover:bg-navy-50">
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex flex-col gap-1 p-3">
            {items.map((item) => {
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
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

        {drawerOpen && <div className="fixed inset-0 z-30 bg-navy-900/30 lg:hidden" onClick={() => setDrawerOpen(false)} />}

        {/* pb leaves room for the fixed bottom bar on mobile. */}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
      </div>

      {/* Mobile bottom tab bar. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-navy-100 bg-white/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
          {primary.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition',
                  active ? 'text-brand-700' : 'text-navy-400',
                )}
              >
                <span className={cn('rounded-lg px-3 py-0.5', active && 'bg-brand-50')}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium text-navy-400"
          >
            <span className="rounded-lg px-3 py-0.5"><MoreHorizontal className="h-5 w-5" /></span>
            More
          </button>
        </div>
      </nav>
    </div>
  );
}
