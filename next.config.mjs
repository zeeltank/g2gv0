import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */
const __dirname = dirname(fileURLToPath(import.meta.url))

const nextConfig = {
  outputFileTracingRoot: __dirname,
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
