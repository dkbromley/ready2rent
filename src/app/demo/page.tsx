import type { Metadata } from 'next';
import { DemoApp } from './DemoApp';

export const metadata: Metadata = {
  title: 'Live demo',
  description:
    'Explore Ready2Rent on sample data — tick checklists, add photo proof, complete a turnover, and watch the host dashboard update. Nothing to set up.',
};

export default function DemoPage() {
  return <DemoApp />;
}
