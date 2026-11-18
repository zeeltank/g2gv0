import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */
const __dirname = dirname(fileURLToPath(import.meta.url))

const nextConfig = {
  outputFileTracingRoot: __dirname,
  // The shared AI core ships TypeScript source; Next must compile it.
  transpilePackages: ['darshana-ai-core'],
  logging: {
    fetches: {
      fullUrl: true,
      hmrRefreshes: true,
    },
  },
  experimental: {
    optimizePackageImports: [
      '@base-ui/react',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-slot',
      '@xyflow/react',
      'react-day-picker',
      'recharts',
    ],
    serverComponentsHmrCache: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // The Simulation Runtime (public/sim-runtime, vendored from the g2g-sim-runtime build) is embedded in a sandboxed frame WITHOUT
        // allow-same-origin, so it runs on an opaque origin ("null"): its module scripts, fonts and 3D models are fetched cross-origin and
        // need CORS and CORP. These are public static files - no cookies, no credentials, nothing per-user - so `*` exposes nothing.
        source: '/sim-runtime/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        // Vite names these by content hash, so a changed file is a new URL and the old one can be cached for good.
        source: '/sim-runtime/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // The page that names the hashed files must never be stale, or it would point at assets a newer build removed.
        source: '/sim-runtime/index.html',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/opportunities',
        destination: '/signals',
        permanent: false,
      },
      {
        source: '/opportunities/:path*',
        destination: '/signals',
        permanent: false,
      },
      {
        source: '/ingestion-engine',
        destination: '/ingestion',
        permanent: false,
      },
    ]
  },
}

export default nextConfig
