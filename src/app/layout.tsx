import type { Metadata, Viewport } from 'next';
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
  title: {
    default: 'Ready2Rent — Vacation rental turnovers, finally in sync',
    template: '%s · Ready2Rent',
  },
  description:
    'Ready2Rent syncs your Airbnb and Vrbo calendars and turns reservations into scheduled cleaning jobs automatically. From checkout to clean — without the texts.',
  applicationName: 'Ready2Rent',
  openGraph: {
    title: 'Ready2Rent — Vacation rental turnovers, finally in sync',
    description:
      'Calendar-synced turnover jobs, checklists and photo proof, problem reports, inventory, and payment tracking — for hosts and cleaning crews.',
    siteName: 'Ready2Rent',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf9f4' },
    { media: '(prefers-color-scheme: dark)', color: '#091d1c' },
  ],
};

// Runs before paint: applies the stored theme (or system preference) so there
// is no flash of the wrong mode. Kept dependency-free and tiny on purpose.
const themeInit = `
try {
  var t = localStorage.getItem('theme');
  var dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
