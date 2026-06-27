import { PageSkeleton } from '@/components/Skeletons';

// Shown instantly on navigation to any app route (the nav chrome stays put),
// while the server component fetches data. Detail routes override this.
export default function Loading() {
  return <PageSkeleton />;
}
