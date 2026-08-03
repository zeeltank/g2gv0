import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import { AuthProvider } from '@/components/auth/gtg-auth'
import { QueryProvider } from '@/components/providers/query-provider'
import '@mdi/font/css/materialdesignicons.min.css'
import './globals.css'

const systemSans = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const systemMono = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

export const metadata: Metadata = {
  title: 'GapstoGrowth — HRMS',
  description: 'GapstoGrowth enterprise HRMS application shell',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      data-brand="gaps-to-growth"
      style={{
        ['--font-inter' as string]: systemSans,
        ['--font-geist-mono' as string]: systemMono,
      }}
      className="bg-background"
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <AuthProvider>
          <QueryProvider>{children}</QueryProvider>
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </AuthProvider>
      </body>
    </html>
  )
}
