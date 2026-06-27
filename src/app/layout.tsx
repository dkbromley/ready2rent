import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TurnReady — Vacation rental turnovers, finally in sync',
  description:
    'TurnReady syncs your Airbnb and Vrbo calendars and turns reservations into scheduled cleaning jobs automatically. From checkout to clean — without the texts.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
