'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/gtg-auth'
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
      className={`absolute z-10 flex w-32 flex-col items-center gap-2 rounded-2xl bg-white/90 px-4 py-4 text-center text-xs font-bold leading-tight text-[#071943] shadow-xl shadow-blue-400/20 backdrop-blur ${className}`}
    >
      {icon}
      <span>{label}</span>
    </div>
  )
}

function BrandIllustrationSection() {
  return (
    <section className="relative hidden h-[100dvh] min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_70%_24%,rgba(37,99,235,0.16),transparent_31%),linear-gradient(135deg,#ffffff_0%,#eff6ff_52%,#dbeafe_100%)] px-6 py-4 text-[#071943] sm:px-10 sm:py-6 lg:flex">
      <div className="pointer-events-none absolute left-[69%] top-[8%] grid grid-cols-5 gap-3 opacity-35">
        {Array.from({ length: 25 }).map((_, index) => (
          <span key={index} className="size-2 rounded-full bg-blue-200" />
        ))}
      </div>
      <div className="pointer-events-none absolute -bottom-28 -left-20 size-[520px] rounded-full border border-white/80" />
      <div className="pointer-events-none absolute bottom-16 right-14 size-72 rounded-full bg-white/25 blur-sm" />

      <div className="relative z-10 flex min-h-0 h-full w-full flex-col">
        <GtgBrandMark className="[&>div:first-child]:size-14 [&>div:first-child]:rounded-xl [&>div:first-child_span]:text-base [&>div:last-child_span:first-child]:text-2xl [&>div:last-child_span:first-child]:text-[#071943] [&>div:last-child_span:last-child]:text-lg [&>div:last-child_span:last-child]:font-bold [&>div:last-child_span:last-child]:text-orange-500" />

        <div className="relative z-20 mt-6 max-w-lg">
          <h1 className="text-3xl font-bold leading-tight text-[#071943] sm:text-4xl lg:text-4xl">
            Close Every Gap.
            <span className="block text-blue-600">Transform Talent,</span>
            Unlock Growth.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-600 sm:text-base">
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
            icon={<Users className="size-8 text-blue-600" />}
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
            <div className="relative z-10 rotate-[-9deg] rounded-xl bg-[#173c95] p-2 shadow-2xl shadow-blue-500/30">
              <div className="rounded-lg bg-gradient-to-br from-blue-50 to-white p-5">
                <div className="mb-5 flex gap-2">
                  <span className="size-2 rounded-full bg-white sha000dow" />
                  <span className="size-2 rounded-full bg-white shadow" />
                  <span className="size-2 rounded-full bg-white shadow" />
                </div>
                <div className="grid grid-cols-[1fr_0.85fr] gap-5">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex size-14 items-center justify-center rounded-full bg-blue-100">
                        <BriefcaseBusiness className="size-8 text-blue-600" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="h-3 rounded-full bg-blue-100" />
                        <div className="h-3 w-4/5 rounded-full bg-blue-100" />
                      </div>
                    </div>
                    <div className="flex h-24 items-end gap-3">
                      {[34, 54, 78, 98].map((height, index) => (
                        <span
                          key={index}
                          className="w-7 rounded-t-lg bg-blue-500/80"
                          style={{ height }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-4 shadow-sm">
                    <div className="mx-auto mt-3 size-24 rounded-full bg-[conic-gradient(#2563eb_0_72%,#dbeafe_72%_100%)] p-5">
                      <div className="size-full rounded-full bg-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mx-auto h-5 w-[84%] rounded-b-2xl bg-gradient-to-r from-blue-200 via-slate-100 to-blue-300 shadow-lg" />
          </div>
        </div>

        <p className="text-xs text-slate-600">
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
    <div className="flex h-[100dvh] overflow-hidden bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_45%,#f3f8ff_100%)] text-[#071943]">
      <BrandIllustrationSection />

      <main className="relative flex min-h-[100dvh] flex-1 flex-col items-center justify-center overflow-hidden px-4 py-4 sm:px-8">
        <div className="absolute left-4 right-4 top-4 flex justify-between lg:justify-end">
          <div className="lg:hidden">
            <GtgBrandMark />
          </div>
          <button
            type="button"
            className="inline-flex h-12 items-center gap-3 rounded-xl bg-white px-5 text-base font-semibold text-[#071943] shadow-lg shadow-blue-100/60 ring-1 ring-blue-100"
          >
            <Globe2 className="size-5 text-[#071943]" />
            English
            <ChevronDown className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-[660px] overflow-hidden rounded-2xl border border-blue-100/70 bg-white/95 px-4 py-4 shadow-2xl shadow-slate-200/70 backdrop-blur max-[640px]:px-3 max-[640px]:py-3 sm:px-7 sm:py-6 md:px-10 md:py-7">
            <div className="mb-4 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-blue-50 sm:size-14">
                <Headset className="size-7 text-blue-600 sm:size-8" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[#071943] max-[640px]:text-xl sm:text-3xl">
                Welcome Back!
              </h2>
              <p className="mt-1 max-w-md text-xs text-slate-600 max-[640px]:text-[11px] sm:text-sm">
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
                  className="text-base font-bold text-[#071943]"
                >
                  Email or Employee ID
                </Label>
                <div className="relative mt-2">
                  <Mail className="pointer-events-none absolute left-5 top-1/2 size-6 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={isLoading}
                    className="h-14 rounded-xl border-slate-200 bg-white pl-14 pr-5 text-base shadow-sm placeholder:text-slate-500 focus-visible:ring-blue-100 max-[640px]:h-12"
                  />
                </div>
              </div>

              <div>
                <Label
                  htmlFor="password"
                  className="text-base font-bold text-[#071943]"
                >
                  Password
                </Label>
                <div className="relative mt-2">
                  <LockKeyhole className="pointer-events-none absolute left-5 top-1/2 size-6 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="********"
                    disabled={isLoading}
                    className="h-14 rounded-xl border-slate-200 bg-white pl-14 pr-12 text-base shadow-sm placeholder:text-slate-500 focus-visible:ring-blue-100 max-[640px]:h-12"
                  />
                  <Eye className="pointer-events-none absolute right-5 top-1/2 size-6 -translate-y-1/2 text-slate-600" />
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
                    className="cursor-pointer text-base font-medium text-slate-600"
                  >
                    Remember me
                  </Label>
                </div>
                <a
                  href="#"
                  className="text-base font-semibold text-blue-600 hover:text-blue-700"
                >
                  Forgot password?
                </a>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-14 w-full rounded-xl bg-blue-600 text-base font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 max-[640px]:h-12"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>

              <div className="flex items-center gap-6 py-1 text-base text-slate-600">
                <span className="h-px flex-1 bg-slate-200" />
                or
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <Button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                variant="outline"
                className="h-14 w-full rounded-xl border-slate-200 bg-white text-base font-bold text-[#071943] shadow-sm hover:bg-slate-50 max-[640px]:h-12"
              >
                <span className="text-2xl font-bold text-blue-600" aria-hidden="true">
                  G
                </span>
                Sign in with Google
              </Button>
            </form>

            <div className="mt-3 hidden border-t border-slate-200 pt-3 text-[11px] leading-4 text-slate-500 sm:block">
              <p className="text-center">Demo accounts (any password works):</p>
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-center font-mono">
                <p>admin@gtg.local</p>
                <p>hr@gtg.local</p>
                <p>depthead@gtg.local</p>
                <p>employee@gtg.local</p>
              </div>
            </div>

            <div className="mt-5 hidden items-center justify-center gap-3 text-sm text-slate-600 sm:flex">
              <ShieldCheck className="size-6 text-slate-600" />
              <span>Your data is secure with enterprise-grade protection</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}