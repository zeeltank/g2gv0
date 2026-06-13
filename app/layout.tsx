import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { AuthProvider } from '@/lib/gtg-auth'
import './globals.css'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

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
      className={`${inter.variable} ${geistMono.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        <AuthProvider>
          {children}
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </AuthProvider>
      </body>
    </html>
  )
}
