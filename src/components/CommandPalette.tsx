'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft, ArrowRight, Plus, Moon, Sun, X } from 'lucide-react';
import { applyTheme, currentTheme } from '@/components/ThemeToggle';

export interface PaletteItem {
  label: string;
  href: string;
}

/** Open the palette from anywhere (e.g. the header search button). */
export function openCommandPalette() {
  window.dispatchEvent(new Event('r2r:open-command'));
}

type Cmd = {
  id: string;
  label: string;
  hint?: string;
  group: 'Navigate' | 'Actions';
  icon: React.ReactNode;
  run: () => void;
};

/**
 * ⌘K / Ctrl-K command palette. Given the current user's role-filtered nav
 * destinations, offers fast keyboard navigation plus a few quick actions
 * (new property, theme toggle). Mounted once in the app shell.
 */
export function CommandPalette({ items, canAddProperty }: { items: PaletteItem[]; canAddProperty: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
  }, []);

  const commands = useMemo<Cmd[]>(() => {
    const nav: Cmd[] = items.map((it) => ({
      id: `nav:${it.href}`,
      label: it.label,
      hint: it.href,
      group: 'Navigate',
      icon: <ArrowRight className="h-4 w-4" />,
      run: () => {
        router.push(it.href);
        close();
      },
    }));

    const actions: Cmd[] = [];
    if (canAddProperty) {
      actions.push({
        id: 'action:new-property',
        label: 'Add property',
        group: 'Actions',
        icon: <Plus className="h-4 w-4" />,
        run: () => {
          router.push('/properties/new');
          close();
        },
      });
    }
    actions.push({
      id: 'action:theme',
      label: 'Toggle dark mode',
      group: 'Actions',
      icon: typeof document !== 'undefined' && currentTheme() === 'dark'
        ? <Sun className="h-4 w-4" />
        : <Moon className="h-4 w-4" />,
      run: () => {
        applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
        close();
      },
    });
    return [...nav, ...actions];
  }, [items, canAddProperty, router, close]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q),
    );
  }, [commands, query]);

  // Global ⌘K / Ctrl-K to toggle; a custom event lets a header button open it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('r2r:open-command', onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('r2r:open-command', onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[active]?.run();
    }
  }

  let lastGroup = '';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-sand-200 bg-surface shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onListKey}
      >
        <div className="flex items-center gap-2 border-b border-sand-100 px-4">
          <Search className="h-4 w-4 shrink-0 text-navy-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or jump to…"
            className="w-full bg-transparent py-3.5 text-sm text-navy-900 placeholder:text-navy-400 focus:outline-none"
          />
          <button
            onClick={close}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-navy-400 transition hover:bg-sand-100 hover:text-navy-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-navy-400">No matches for “{query}”.</p>
          )}
          {filtered.map((c, i) => {
            const showGroup = c.group !== lastGroup;
            lastGroup = c.group;
            return (
              <div key={c.id}>
                {showGroup && (
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-navy-400">
                    {c.group}
                  </p>
                )}
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => c.run()}
                  className={[
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition',
                    i === active ? 'bg-brand-50 text-brand-800' : 'text-navy-700 hover:bg-sand-100',
                  ].join(' ')}
                >
                  <span className={i === active ? 'text-brand-600' : 'text-navy-400'}>{c.icon}</span>
                  <span className="flex-1 font-medium">{c.label}</span>
                  {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-brand-500" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
