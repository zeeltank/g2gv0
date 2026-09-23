'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { TwoFactorRequiredError, useAuth } from '@/components/auth/gtg-auth'
import { CredentialForm } from '@/components/auth/login/credential-form'
import { ForgotPasswordPanel } from '@/components/auth/login/forgot-password-panel'
import { ImageCollage, type CollageSlide } from '@/components/auth/login/image-collage'
import { TwoFactorStep } from '@/components/auth/login/two-factor-step'
import { GtgBrandMark } from '@/components/shell/gtg-brand-mark'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { passwordService } from '@/services/auth/password'
import { accountService } from '@/services/account'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { readLastVisited } from '@/lib/last-visited'

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * THE SIGN-IN SCREEN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This file is an orchestrator: it owns the state and the three calls that
 * can happen here — sign in, answer a two-step challenge, ask for a reset
 * link — and renders one of three steps. Everything visual lives in
 * `./login/`. The previous version of this file interleaved ~200 lines of
 * hand-drawn CSS illustration (a laptop built from divs, a potted plant made
 * of colour blobs) with the auth logic; none of that survives, and none of
 * the auth logic below changed except the one deliberate addition —
 * `rememberMe` now actually reaches `login()`, see gtg-auth.tsx.
 *
 * ── COMPOSITION ──────────────────────────────────────────────────────────
 *
 * Full bleed — no floating card, no page frame around it, the two panels
 * fill the actual viewport. Below `lg` there is no image panel at all: a
 * scattered multi-card collage cannot read as anything but noise in a
 * shallow strip, so it is not attempted there. At `lg` and up, a flat
 * `bg-brand-navy` panel carries the collage, its right edge cut on a shallow
 * diagonal (`.g2g-auth-diagonal` in globals.css) rather than a straight
 * vertical line — the seam is absolutely positioned and the form clears it
 * with padding, which is what makes the lean possible without the two
 * panels needing to be ordinary flex siblings.
 *
 * ── WHY THIS SCREEN IS ALWAYS LIGHT ─────────────────────────────────────
 *
 * There is no theme toggle on this screen, so "the app's current theme"
 * and "what a visitor can actually choose here" are not the same thing —
 * whatever a signed-out visitor's OS or last-stored preference says, this
 * screen renders light. Two mechanisms, not one, because they cover two
 * different moments: the blocking script in `app/layout.tsx` special-cases
 * `/login` so the very first paint is never dark, and the effect below
 * corrects `ThemeProvider`'s own post-mount sync — it re-applies the real
 * stored/system preference on every mount via a deferred microtask,
 * regardless of route, so without this it would silently re-darken the
 * screen a moment after the script's fix already ran. The `setTimeout(0)`
 * inside it is deliberate: it has to resolve after that microtask, not
 * before it, to actually win.
 */

const SLIDES: CollageSlide[] = [
  { src: '/auth/collage-1.png', caption: 'Headcount and growth, at a glance.' },
  { src: '/auth/collage-2.png', caption: 'Attendance and leave, simplified.' },
  { src: '/auth/collage-3.png', caption: 'Performance and open roles, live.' },
]

export function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()

  /*
   * ALWAYS LIGHT — see the file header for why this needs two mechanisms.
   *
   * `useLayoutEffect` applies the correction synchronously, before the
   * browser's next paint, which is as early as anything running inside
   * React (rather than the blocking head script) can act. That alone is
   * not enough: `ThemeProvider` defers ITS sync with `queueMicrotask`
   * specifically so a mount isn't immediately followed by a second render,
   * and a microtask queued by a parent's effect still resolves after a
   * child's layout effect has already run — so on first mount that sync
   * lands AFTER this one and silently reapplies the real preference. The
   * `setTimeout(0)` queues a macrotask, which is guaranteed to run after
   * every already-queued microtask (ThemeProvider's included), so it is
   * what actually wins the race.
   *
   * Restored on unmount, not left removed — leaving `.dark` off after
   * navigating to an authenticated page would show a dark-preferring
   * visitor a light dashboard until something else happened to correct it.
   */
  useLayoutEffect(() => {
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')
    const previousColorScheme = root.style.colorScheme

    const forceLight = () => {
      root.classList.remove('dark')
      root.style.colorScheme = 'light'
    }

    forceLight()
    const timer = window.setTimeout(forceLight, 0)

    return () => {
      window.clearTimeout(timer)
      if (wasDark) root.classList.add('dark')
      root.style.colorScheme = previousColorScheme
    }
  }, [])

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
   * Fetched AFTER login, not before — there is no session to read a
   * preference with until then, which is why this is async and why the
   * provider mounted in the layout cannot answer it (it runs before anybody
   * has signed in).
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
   * A rejection has to be ANNOUNCED, not merely displayed. WCAG 3.3.1 asks
   * that a detected error be identified in text; a red box that silently
   * appears above a form satisfies that only for people who can see it
   * appear. Focus moves to the alert so it is read out, and so the next Tab
   * lands back at the top of the form rather than wherever focus happened to
   * be when the request failed.
   */
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  /*
   * FORGOT PASSWORD, FOR REAL THIS TIME.
   *
   * The reply is deliberately the same whether or not the address has an
   * account, so this form cannot be used to find out who is registered - and
   * it never returns the link itself. See Api\Auth\PasswordController::forgot().
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

  /*
   * ═════════════════════════════════════════════════════════════════════════
   * THE SECOND STEP, FOR ACCOUNTS WITH TWO-STEP VERIFICATION ON
   * ═════════════════════════════════════════════════════════════════════════
   *
   * `challenge` holds the server's sentence and doubles as the flag for which
   * step is on screen: null is email-and-password, a string is the code
   * field.
   *
   * ── WHY THE PASSWORD IS RE-SENT RATHER THAN A PENDING STATE HELD ───────────
   *
   * The second call repeats the email and password alongside the code. The
   * alternative — the server remembering a half-authenticated sign-in between
   * the two calls — needs a store, an expiry, and a decision about what
   * happens when somebody abandons it halfway; and for the duration of that
   * window a half-finished sign-in exists that is not the second factor's
   * business to protect. Nothing is remembered here, so there is nothing to
   * abandon.
   *
   * Both values are already in component state from the first attempt, so
   * nobody types their password twice.
   */
  const [challenge, setChallenge] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)

  const leaveChallenge = () => {
    setChallenge(null)
    setCode('')
    setRecoveryCode('')
    setUseRecovery(false)
    setError('')
    // The password is cleared on the way out, because the credential step is
    // about to be shown again and leaving it filled invites a second blind
    // attempt against an account that has already challenged once.
    setPassword('')
  }

  /**
   * One sign-in attempt, with or without a second factor.
   *
   * Shared by both steps rather than duplicated, so the redirect, the error
   * handling and the loading flag cannot drift between them — the code path
   * and the password path end in exactly the same place.
   */
  const attempt = async (second?: { code?: string; recoveryCode?: string }) => {
    setError('')
    setIsLoading(true)

    try {
      // `rememberMe` reaches the provider for the first time here. It decides
      // whether the session survives the browser closing — see
      // setSessionCookie() in gtg-auth.tsx.
      await login(email, password, second, rememberMe)
      router.push(await getRedirectTarget())
    } catch (err) {
      if (err instanceof TwoFactorRequiredError) {
        /*
         * Into `challenge`, never into `error`. The password was accepted; a
         * red "Enter the code from your authenticator app" above the
         * password field — which is what this was before the branch existed
         * — reads as a rejection and offers nowhere to type.
         *
         * The same object is thrown for a WRONG code, so this also covers
         * the second and later attempts: the step stays on screen with the
         * server's newer sentence, including the throttle message.
         */
        setChallenge(err.message)
        setCode('')
        setRecoveryCode('')
        return
      }

      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await attempt()
  }

  const submitChallenge = async (e: React.FormEvent) => {
    e.preventDefault()

    await attempt(
      useRecovery ? { recoveryCode: recoveryCode.trim() } : { code: code.trim() },
    )
  }

  const step = challenge !== null ? 'challenge' : forgotOpen ? 'forgot' : 'credentials'

  return (
    /*
     * FULL BLEED — no floating card, no page frame around it. What used to
     * wrap this in a padded, centered, rounded-and-shadowed card (a `bg-muted`
     * page ground behind a `max-w-[1040px]` card) is gone entirely; the two
     * panels below now fill the actual viewport edge to edge, the way the
     * screen this replaces already did. `relative` stays on the root because
     * the collage panel still needs an absolutely-positioned ancestor for the
     * diagonal-seam technique — see the comment on that panel below.
     */
    <div className="relative min-h-[100dvh] bg-background">
      {/*
        The collage panel. Absolutely positioned — not an ordinary flex
        sibling — because a clip-path that leans its right edge only reads
        as a diagonal SEAM (rather than a shape floating over a straight
        boundary) if it is allowed to overlap the nominal form column at its
        widest point, with the form clearing it via padding instead. See
        `.g2g-auth-diagonal` in globals.css.
      */}
      <div
        className="g2g-auth-diagonal absolute inset-y-0 left-0 hidden w-[48%] bg-brand-navy lg:block xl:w-[46%]"
        aria-hidden="true"
      >
        <ImageCollage slides={SLIDES} className="h-full w-full" />
      </div>

      <main className="relative flex min-h-[100dvh] flex-col px-6 py-8 sm:px-10 sm:py-10 lg:py-14 lg:pl-[calc(48%+2.5rem)] lg:pr-12 xl:pl-[calc(46%+3rem)] xl:pr-16">
        {/* One brand placement, at every width — not on the collage art at
            any point (it used to also live in a chip over the images at
            lg+). Top of the right panel, horizontally centered within it —
            `justify-center` on this row, not `mx-auto` on the mark itself,
            so it centers on `<main>`'s full content width rather than being
            constrained to the narrower 380px form column below it. */}
        <div className="mb-5 mt-4 flex justify-center">
          <GtgBrandMark size="lg" />
        </div>

        {/*
          `flex-1` at every breakpoint, not just below `lg` — this is what
          pushes the copyright to the bottom of the viewport, and it used to
          switch to `lg:flex-none` with the copyright pulled out via
          `lg:absolute` instead. That absolute positioning was the actual bug:
          `inset-x-0` on a child aligns to the ANCESTOR's padding-box edges,
          which ignores the ancestor's own padding entirely — it does not
          "respect" `<main>`'s asymmetric left/right padding the way CSS
          padding affects normal-flow content, so the footer centered on the
          full viewport width instead of the padded content column. One flex
          mechanism at every size, and the copyright below sharing the exact
          same `mx-auto max-w-[380px]` wrapper as the form, sidesteps that
          entirely — both are centered by the same computation, so they can't
          drift apart.
        */}
        <div className="flex flex-1 flex-col justify-center">
          <div className="mx-auto w-full max-w-[380px]">
            {/* The "Gaps to Growth" eyebrow that used to sit here was
                redundant with the brand mark above — the same name, twice.
                Removed rather than kept alongside a mark that already
                carries it. */}
            <div className="mb-7">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {step === 'forgot' ? 'Account recovery' : 'Sign in'}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {step === 'challenge'
                  ? 'One more step to confirm it’s you.'
                  : step === 'forgot'
                    ? 'We’ll get you back into your workspace.'
                    : 'Welcome back to your workspace.'}
              </p>
            </div>

            {error && (
              <Alert
                variant="destructive"
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className="mb-5 focus:outline-none motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200"
              >
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === 'challenge' ? (
              <TwoFactorStep
                challenge={challenge as string}
                code={code}
                onCodeChange={setCode}
                recoveryCode={recoveryCode}
                onRecoveryCodeChange={setRecoveryCode}
                useRecovery={useRecovery}
                onToggleRecovery={() => {
                  setUseRecovery((value) => !value)
                  setCode('')
                  setRecoveryCode('')
                  setError('')
                }}
                isLoading={isLoading}
                onSubmit={submitChallenge}
                onRestart={leaveChallenge}
              />
            ) : step === 'forgot' ? (
              <ForgotPasswordPanel
                email={forgotEmail}
                onEmailChange={setForgotEmail}
                busy={forgotBusy}
                notice={forgotNotice}
                onSubmit={requestReset}
                onBack={() => setForgotOpen(false)}
              />
            ) : (
              <CredentialForm
                email={email}
                onEmailChange={setEmail}
                password={password}
                onPasswordChange={setPassword}
                remember={rememberMe}
                onRememberChange={setRememberMe}
                isLoading={isLoading}
                hasError={Boolean(error)}
                onSubmit={handleSubmit}
                onForgot={() => {
                  // Carried across, so nobody types the address twice.
                  setForgotEmail(email)
                  setForgotNotice('')
                  setError('')
                  setForgotOpen(true)
                }}
              />
            )}
          </div>
        </div>

        {/* Same wrapper as the form above, not absolute positioning — see
            the comment on the flex-1 container for why the previous attempt
            at this (inset-x-0) didn't actually work. */}
        <p className="mx-auto mt-8 w-full max-w-[380px] text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Gaps to Growth
        </p>
      </main>
    </div>
  )
}
