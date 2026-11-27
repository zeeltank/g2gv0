import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */
const __dirname = dirname(fileURLToPath(import.meta.url))

/*
 * The headers of every public page that a secret link opens: the client presentation at /present (a signed link) and the Sales Kit share page at /share (a token). The address carries the secret, so:
 * never indexed, cached, archived or sent on in a Referer; never framed by another site; nothing to sniff; no device features. Written once so the two cannot drift apart.
 */
const PUBLIC_LINK_PAGE_HEADERS = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
  { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
]

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
      {
        // The public share page for a client presentation (app/present). The address carries a signed link. Sent on every response
        // under the path, which includes the plain 404 a refused link gets.
        source: '/present/:path*',
        headers: PUBLIC_LINK_PAGE_HEADERS,
      },
      {
        // The public page of a Sales Kit link (app/share/kit/<token>): the same rules, for the same reason, on every response under the path, the plain 404 of a refused link included.
        source: '/share/:path*',
        headers: PUBLIC_LINK_PAGE_HEADERS,
      },
      {
        // The two product websites are served exactly as authored (public/learning/product-learning). They are for signed-in learners, so
        // keep them out of search results by header rather than by editing the documents.
        source: '/learning/product-learning/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
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
