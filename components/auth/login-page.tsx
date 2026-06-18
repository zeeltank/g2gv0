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
import { AlertCircle, Globe } from 'lucide-react'

function GlassmorphismLogoSection() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10">
      <GtgBrandMark className="scale-125" />

      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Close Every Gap</h2>
        <p className="mt-2 text-sm text-muted-foreground">Transform talent, unlock growth</p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs font-medium text-muted-foreground">
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-center text-foreground">
          HRMS
        </div>
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-center text-foreground">
          ERP
        </div>
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-center text-foreground">
          SaaS
        </div>
      </div>
    </div>
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
      // For demo: auto-login as HR Manager with Google
      await login('hr@gtg.local', 'password')
      router.push('/dashboard')
    } catch (err) {
      setError('Google sign-in failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left: Branding with Glassmorphism */}
      <div className="hidden flex-1 flex-col items-center justify-center border-r border-border bg-surface-muted px-8 lg:flex">
        <GlassmorphismLogoSection />
      </div>

      {/* Right: Form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <GtgBrandMark className="size-8" />
            <div>
              <h1 className="text-lg font-bold text-foreground">GapstoGrowth</h1>
              <p className="text-xs text-muted-foreground">HRMS</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Sign In</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your credentials to access the system
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Employee ID / Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked: boolean) => setRememberMe(checked === true)}
                  disabled={isLoading}
                />
                <Label htmlFor="remember" className="text-sm cursor-pointer">Remember me</Label>
              </div>
              <a href="#" className="text-sm font-medium text-primary hover:text-primary/80">
                Forgot password?
              </a>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>

            <Button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              variant="outline"
              className="mt-3 w-full"
            >
              <Globe className="size-5" aria-hidden="true" />
              Sign in with Google
            </Button>
          </form>

          <div className="mt-6 border-t border-border pt-6">
            <p className="text-center text-xs text-muted-foreground">
              Demo accounts (any password works):
            </p>
            <div className="mt-3 space-y-1 text-center text-xs">
              <p className="font-mono text-muted-foreground">admin@gtg.local (Admin)</p>
              <p className="font-mono text-muted-foreground">hr@gtg.local (HR Manager)</p>
              <p className="font-mono text-muted-foreground">depthead@gtg.local (Dept Head)</p>
              <p className="font-mono text-muted-foreground">employee@gtg.local (Employee)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
