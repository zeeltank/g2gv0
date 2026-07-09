'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/gtg-auth'
import { GtgBrandMark } from '@/components/shell/gtg-brand-mark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertCircle,
  BarChart3,
  BriefcaseBusiness,
  CalendarCheck,
  ChevronDown,
  Eye,
  Globe2,
  Headset,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react'

function FeatureTile({
  className,
  icon,
  label,
}: {
  className: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <div
      className={`absolute z-10 flex w-32 flex-col items-center gap-2 rounded-2xl bg-surface/90 px-4 py-4 text-center text-xs font-bold leading-tight text-brand-navy shadow-xl shadow-blue-400/20 backdrop-blur ${className}`}
    >
      {icon}
      <span>{label}</span>
    </div>
  )
}

function BrandIllustrationSection() {
  return (
    <section className="relative hidden h-[100dvh] min-h-0 flex-1 overflow-hidden g2g-login-hero-gradient px-6 py-4 text-brand-navy sm:px-10 sm:py-6 lg:flex">
      <div className="pointer-events-none absolute left-[69%] top-[8%] grid grid-cols-5 gap-3 opacity-35">
        {Array.from({ length: 25 }).map((_, index) => (
          <span key={index} className="size-2 rounded-full bg-blue-200" />
        ))}
      </div>
      <div className="pointer-events-none absolute -bottom-28 -left-20 size-[520px] rounded-full border border-white/80" />
      <div className="pointer-events-none absolute bottom-16 right-14 size-72 rounded-full bg-white/25 blur-sm" />

      <div className="relative z-10 flex min-h-0 h-full w-full flex-col">
        <GtgBrandMark className="[&>div:first-child]:size-14 [&>div:first-child]:rounded-xl [&>div:first-child_span]:text-base [&>div:last-child_span:first-child]:text-2xl [&>div:last-child_span:first-child]:text-brand-navy [&>div:last-child_span:last-child]:text-lg [&>div:last-child_span:last-child]:font-bold [&>div:last-child_span:last-child]:text-orange-500" />

        <div className="relative z-20 mt-6 max-w-lg">
          <h1 className="text-3xl font-bold leading-tight text-brand-navy sm:text-4xl lg:text-4xl">
            Close Every Gap.
            <span className="block text-primary">Transform Talent,</span>
            Unlock Growth.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
            A complete HRMS solution to streamline your workforce, empower your
            people and drive your organization forward.
          </p>
        </div>

        <div className="relative mt-auto flex min-h-[250px] items-end justify-center pb-6 sm:min-h-[280px] sm:pb-8 lg:min-h-[300px]">
          <div className="absolute bottom-8 left-4 right-4 h-40 rounded-[50%] border border-white/90 shadow-[0_0_34px_rgba(255,255,255,0.9)]" />
          <div className="absolute bottom-24 left-[17%] h-px w-[56%] rotate-[18deg] bg-blue-300/70" />
          <div className="absolute bottom-28 left-[21%] h-px w-[62%] -rotate-[10deg] bg-blue-300/70" />
          <div className="absolute bottom-14 left-[31%] h-px w-[40%] rotate-[-2deg] bg-blue-300/70" />

          <FeatureTile
            className="left-8 top-16 rotate-[-12deg] sm:top-20"
            icon={<Users className="size-8 text-primary" />}
            label="People Management"
          />
          <FeatureTile
            className="bottom-16 left-0 rotate-[-14deg]"
            icon={<CalendarCheck className="size-8 text-green-500" />}
            label="Attendance & Leave"
          />
          <FeatureTile
            className="bottom-4 left-[37%] rotate-[-15deg]"
            icon={<Wallet className="size-8 text-amber-500" />}
            label="Payroll & Compliance"
          />
          <FeatureTile
            className="bottom-16 right-3 rotate-[-13deg]"
            icon={<BarChart3 className="size-8 text-purple-500" />}
            label="Analytics & Reports"
          />

          <div className="relative mb-16 w-[390px]">
            <div className="absolute -right-14 bottom-0 h-28 w-20 rounded-t-full bg-gradient-to-b from-lime-500 to-green-700 shadow-xl">
              <div className="absolute -left-8 top-8 h-14 w-20 -rotate-45 rounded-full bg-lime-500" />
              <div className="absolute left-6 top-4 h-16 w-24 -rotate-12 rounded-full bg-green-500" />
              <div className="absolute -right-5 top-10 h-14 w-20 rotate-45 rounded-full bg-lime-600" />
            </div>
            <div className="absolute -right-16 bottom-[-18px] h-20 w-20 rounded-b-2xl rounded-t-md bg-gradient-to-b from-white to-blue-100 shadow-lg" />
            <div className="relative z-10 rotate-[-9deg] rounded-xl g2g-login-card-gradient p-2 shadow-2xl shadow-blue-500/30">
              <div className="rounded-lg bg-gradient-to-br from-blue-50 to-white p-5">
                <div className="mb-5 flex gap-2">
                  <span className="size-2 rounded-full bg-white sha000dow" />
                  <span className="size-2 rounded-full bg-white shadow" />
                  <span className="size-2 rounded-full bg-white shadow" />
                </div>
                <div className="grid grid-cols-[1fr_0.85fr] gap-5">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                        <BriefcaseBusiness className="size-8 text-primary" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="h-3 rounded-full bg-primary/10" />
                        <div className="h-3 w-4/5 rounded-full bg-primary/10" />
                      </div>
                    </div>
                    <div className="flex h-24 items-end gap-3">
                      {[34, 54, 78, 98].map((height, index) => (
                        <span
                          key={index}
                          className="w-7 rounded-t-lg bg-primary/80"
                          style={{ height }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg bg-surface p-4 shadow-sm">
                    <div className="mx-auto mt-3 size-24 rounded-full bg-[conic-gradient(#2563eb_0_72%,#dbeafe_72%_100%)] p-5">
                      <div className="size-full rounded-full bg-surface" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mx-auto h-5 w-[84%] rounded-b-2xl bg-gradient-to-r from-blue-200 via-muted to-blue-300 shadow-lg" />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          (c) 2025 Gaps to Growth. All rights reserved.
        </p>
      </div>
    </section>
  )
}

export function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login(email, password)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setIsLoading(true)
    try {
      await login('hr@gtg.local', 'password')
      router.push('/dashboard')
    } catch {
      setError('Google sign-in failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden g2g-login-gradient text-brand-navy">
      <BrandIllustrationSection />

      <main className="relative flex min-h-[100dvh] flex-1 flex-col items-center justify-center overflow-hidden px-4 py-4 sm:px-8">
        <div className="absolute left-4 right-4 top-4 flex justify-between lg:justify-end">
          <div className="lg:hidden">
            <GtgBrandMark />
          </div>
          <button
            type="button"
            className="inline-flex h-12 items-center gap-3 rounded-xl bg-surface px-5 text-base font-semibold text-brand-navy shadow-lg shadow-primary/10 ring-1 ring-primary/10"
          >
            <Globe2 className="size-5 text-brand-navy" />
            English
            <ChevronDown className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-[660px] overflow-hidden rounded-2xl border border-primary/20 bg-surface/95 px-4 py-4 shadow-2xl shadow-foreground/5 backdrop-blur max-[640px]:px-3 max-[640px]:py-3 sm:px-7 sm:py-6 md:px-10 md:py-7">
            <div className="mb-4 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10 sm:size-14">
                <Headset className="size-7 text-primary sm:size-8" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-brand-navy max-[640px]:text-xl sm:text-3xl">
                Welcome Back!
              </h2>
              <p className="mt-1 max-w-md text-xs text-muted-foreground max-[640px]:text-[11px] sm:text-sm">
                Sign in to continue to your account
              </p>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-3">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label
                  htmlFor="email"
                  className="text-base font-bold text-brand-navy"
                >
                  Email or Employee ID
                </Label>
                <div className="relative mt-2">
                  <Mail className="pointer-events-none absolute left-5 top-1/2 size-6 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={isLoading}
                    className="h-14 rounded-xl border-input bg-surface pl-14 pr-5 text-base shadow-sm placeholder:text-muted-foreground focus-visible:ring-primary/20 max-[640px]:h-12"
                  />
                </div>
              </div>

              <div>
                <Label
                  htmlFor="password"
                  className="text-base font-bold text-brand-navy"
                >
                  Password
                </Label>
                <div className="relative mt-2">
                  <LockKeyhole className="pointer-events-none absolute left-5 top-1/2 size-6 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="********"
                    disabled={isLoading}
                    className="h-14 rounded-xl border-input bg-surface pl-14 pr-12 text-base shadow-sm placeholder:text-muted-foreground focus-visible:ring-primary/20 max-[640px]:h-12"
                  />
                  <Eye className="pointer-events-none absolute right-5 top-1/2 size-6 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked: boolean) => setRememberMe(checked)}
                    disabled={isLoading}
                    className="size-5 rounded-md"
                  />
                  <Label
                    htmlFor="remember"
                    className="cursor-pointer text-base font-medium text-muted-foreground"
                  >
                    Remember me
                  </Label>
                </div>
                <a
                  href="#"
                  className="text-base font-semibold text-primary hover:text-primary/80"
                >
                  Forgot password?
                </a>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-14 w-full rounded-xl text-base font-bold shadow-lg shadow-primary/20 max-[640px]:h-12"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>

              <div className="flex items-center gap-6 py-1 text-base text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                variant="outline"
                className="h-14 w-full rounded-xl border-input bg-surface text-base font-bold text-brand-navy shadow-sm hover:bg-muted max-[640px]:h-12"
              >
                <span className="text-2xl font-bold text-primary" aria-hidden="true">
                  G
                </span>
                Sign in with Google
              </Button>
            </form>

            <div className="mt-3 hidden border-t border-border pt-3 text-[11px] leading-4 text-muted-foreground sm:block">
              <p className="text-center">Demo accounts (any password works):</p>
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-center font-mono">
                <p>admin@gtg.local</p>
                <p>hr@gtg.local</p>
                <p>depthead@gtg.local</p>
                <p>employee@gtg.local</p>
              </div>
            </div>

            <div className="mt-5 hidden items-center justify-center gap-3 text-sm text-muted-foreground sm:flex">
              <ShieldCheck className="size-6 text-muted-foreground" />
              <span>Your data is secure with enterprise-grade protection</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}