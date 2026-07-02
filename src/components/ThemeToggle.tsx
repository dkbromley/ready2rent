'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

/** Apply + persist a theme choice. Exported for the command palette. */
export function applyTheme(next: 'light' | 'dark') {
  try {
    localStorage.setItem('theme', next);
  } catch {
    // localStorage unavailable (private mode) — still toggle for this page.
  }
  document.documentElement.classList.toggle('dark', next === 'dark');
}

export function currentTheme(): 'light' | 'dark' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** Sun/moon toggle. Renders a stable placeholder until mounted (theme is
 * applied pre-paint by the inline script in the root layout). */
export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setMounted(true);
    setTheme(currentTheme());
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      title={mounted && theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle dark mode"
      className={className ?? 'rounded-lg p-2 text-navy-600 transition hover:bg-brand-50 hover:text-brand-700'}
    >
      {mounted && theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
