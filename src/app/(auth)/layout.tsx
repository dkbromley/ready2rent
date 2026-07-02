import Link from 'next/link';
import { Waves } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="coastal-gradient flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-navy-900">
          <Waves className="h-6 w-6 text-brand-600" />
          Ready2Rent
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
