'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth/gtg-auth'
import { GtgBrandMark } from '@/components/shell/gtg-brand-mark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { passwordService } from '@/services/auth/password'
import { accountService } from '@/services/account'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { readLastVisited } from '@/lib/last-visited'
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
            icon={<CalendarCheck className="size-8 text-success" />}
            label="Attendance & Leave"
          />
          <FeatureTile
            className="bottom-4 left-[37%] rotate-[-15deg]"
            icon={<Wallet className="size-8 text-amber-500" />}
            label="Payroll & Compliance"
          />
          <FeatureTile
            className="bottom-16 right-3 rotate-[-13deg]"
            icon={<BarChart3 className="size-8 text-primary" />}
            label="Analytics & Reports"
          />

          <div className="relative mb-16 w-[390px]">
            <div className="absolute -right-14 bottom-0 h-28 w-20 rounded-t-full bg-gradient-to-b from-lime-500 to-green-700 shadow-xl">
              <div className="absolute -left-8 top-8 h-14 w-20 -rotate-45 rounded-full bg-lime-500" />
              <div className="absolute left-6 top-4 h-16 w-24 -rotate-12 rounded-full bg-success" />
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
                    <div className="mx-auto mt-3 size-24 rounded-full g2g-login-progress p-5">
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
  const searchParams = useSearchParams()
  const { login } = useAuth()

  /*
   * WHERE TO GO AFTER SIGNING IN.
   *
   * Three sources, in order of how specific the intent is:
   *
   *   1. `?redirect=` — they were sent here from a page they were trying to
   *      reach. Nothing is more specific than that, so it always wins.
   *   2. Their `landing_page` preference. This is the reader that preference
   *      never had: Settings stored it and NOTHING consulted it, so choosing
   *      "the last page I was on" changed nothing at all.
   *   3. The dashboard.
   *
   * Fetched AFTER login, not before — there is no session to read a preference
   * with until then, which is why this is async and why the provider mounted in
   * the layout cannot answer it (it runs before anybody has signed in).
   */
  const getRedirectTarget = async () => {
    const redirect = searchParams.get('redirect')
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
      return redirect
    }

    try {
      const context = getLaravelContext(null)

      if (!isLaravelContextReady(context)) return '/dashboard'

      const me = await accountService.me(context)

      if (me.data.preferences.landing_page === 'last-visited') {
        return readLastVisited() ?? '/dashboard'
      }
    } catch {
      // A preference lookup must never be the reason somebody cannot get in.
    }

    return '/dashboard'
  }

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  /*
   * FORGOT PASSWORD, FOR REAL THIS TIME.
   *
   * The reply is deliberately the same whether or not the address has an
   * account, so this form cannot be used to find out who is registered - and it
   * never returns the link itself. See Api\Auth\PasswordController::forgot().
   */
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotBusy, setForgotBusy] = useState(false)
  const [forgotNotice, setForgotNotice] = useState('')

  async function requestReset(event: React.FormEvent) {
    event.preventDefault()

    if (!forgotEmail.trim() || forgotBusy) return

    setForgotBusy(true)
    setForgotNotice('')

    try {
      const response = await passwordService.forgot(forgotEmail.trim())
      setForgotNotice(response.message)
    } catch {
      // Even a failure says the same neutral thing: a different message here
      // would leak exactly what the endpoint refuses to.
      setForgotNotice(
        'If that address has an account, a reset link is on its way. Ask your administrator if nothing arrives.',
      )
    } finally {
      setForgotBusy(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    setIsLoading(true)

    try {
      await login(email, password)
      router.push(await getRedirectTarget())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  // The ERP exposes no OAuth endpoint - authController only accepts
  // email/password (and a separate mobile OTP flow), so this cannot sign in yet.
  const handleGoogleSignIn = () => {
    setError('Google sign-in is not available yet. Please sign in with your email and password.')
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
                  {/*
                    * WAS "Email or Employee ID". It has never accepted an
                    * employee ID: authController matches on `email`, which is
                    * tbluser's only unique key, and `user_name` is queried by
                    * nothing. Anybody who typed their employee number was told
                    * their credentials were wrong.
                    *
                    * The input `type` follows the label - it was `text`, which
                    * suppressed the browser's own email autofill and validation
                    * for a field that only ever accepts an address.
                    */}
                  Email address
                </Label>
                <div className="relative mt-2">
                  <Mail className="pointer-events-none absolute left-5 top-1/2 size-6 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
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
                {/*
                  * WAS `<a href="#">Forgot password?</a>` - a link that reloaded
                  * the login page and left people typing guesses.
                  *
                  * It is a sentence rather than a working link because self-serve
                  * reset is HALF-BUILT, not missing: the backend has
                  * ForgotPasswordController with a working
                  * submitForgetPasswordForm() and a token/reset pair on the web
                  * routes - but showForgetPasswordForm() IS COMMENTED OUT while
                  * routes/web.php:171 still points at it, so the entry point
                  * errors. Wiring this link to that route would send somebody
                  * from a dead link to a broken page, which is worse.
                  *
                  * Until the flow is finished, this says who can actually help -
                  * the same answer the profile screen gives, for the same reason.
                  */}
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email)
                    setForgotNotice('')
                    setForgotOpen(true)
                  }}
                  className="text-base font-semibold text-primary hover:text-primary/80"
                >
                  Forgot password?
                </button>
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

            <div className="mt-5 hidden items-center justify-center gap-3 text-sm text-muted-foreground sm:flex">
              <ShieldCheck className="size-6 text-muted-foreground" />
              <span>Your data is secure with enterprise-grade protection</span>
            </div>
          </div>
        </div>
      </main>

      {/*
        * A panel rather than a separate page, so nobody loses the login form to
        * ask a one-field question - and so the address they already typed is
        * carried across.
        *
        * Deliberately NOT a Dialog: this screen renders outside the app shell
        * and has no other overlay, and a focus-trapped modal over a login form
        * is more machinery than one input needs.
        */}
      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-title"
          onClick={() => setForgotOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="forgot-title" className="text-lg font-semibold text-foreground">
              Reset your password
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We will send a link to set a new one.
            </p>

            {forgotNotice ? (
              <div className="mt-4 flex flex-col gap-4">
                <Alert variant="info">
                  <AlertDescription>{forgotNotice}</AlertDescription>
                </Alert>
                <Button variant="outline" onClick={() => setForgotOpen(false)}>
                  Close
                </Button>
              </div>
            ) : (
              <form onSubmit={requestReset} className="mt-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="forgot-email">Email address</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(event) => setForgotEmail(event.target.value)}
                    autoFocus
                  />
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="ghost" onClick={() => setForgotOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!forgotEmail.trim() || forgotBusy}>
                    {forgotBusy ? 'Sending…' : 'Send the link'}
                  </Button>
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  If your organisation has no email set up, ask your administrator — they can
                  generate a link for you from the Employee Directory.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}