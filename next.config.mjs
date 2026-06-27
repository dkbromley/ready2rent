/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['node-ical'],
  images: {
    remotePatterns: [
      // Allow Supabase storage public buckets for job photos.
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

export default nextConfig;
