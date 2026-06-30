import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

// Geometric, modern sans for the coastal refresh. Self-hosted by next/font at
// build time and exposed as --font-sans (consumed by tailwind's font-sans).
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ready2Rent — Vacation rental turnovers, finally in sync',
  description:
    'Ready2Rent syncs your Airbnb and Vrbo calendars and turns reservations into scheduled cleaning jobs automatically. From checkout to clean — without the texts.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
