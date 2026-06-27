/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['node-ical'],
  // Client-side router cache: revisiting a recently-viewed route reuses the
  // cached render instantly (no refetch). Mutations call revalidatePath, which
  // busts it, so data stays correct. Big win for tab-switching latency.
  experimental: {
    staleTimes: { dynamic: 30, static: 180 },
  },
  images: {
    remotePatterns: [
      // Allow Supabase storage public buckets for job photos.
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

export default nextConfig;
