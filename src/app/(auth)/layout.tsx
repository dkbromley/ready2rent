import Link from 'next/link';
import { Waves } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ocean-hero flex min-h-screen flex-col">
      <header className="px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-white">
          <Waves className="h-6 w-6 text-brand-300" />
          Ready2Rent
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
