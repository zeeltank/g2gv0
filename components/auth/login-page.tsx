'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/gtg-auth'
import { GtgBrandMark } from '@/components/shell/gtg-brand-mark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

function GlassmorphismLogoSection() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-linear-to-br from-brand/20 via-transparent to-primary/10" aria-hidden="true" />
      
      {/* Glass card effect */}
      <div className="relative rounded-3xl border border-white/20 bg-white/10 p-12 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-white/30 hover:bg-white/15">
        {/* Logo container with glow */}
        <div className="relative">
          {/* Glow effect behind logo */}
          <div className="absolute inset-0 -top-8 -left-8 -right-8 -bottom-8 rounded-2xl bg-linear-to-br from-primary/30 to-brand/30 blur-2xl opacity-60" aria-hidden="true" />
          
          {/* Logo image */}
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/gapstogrowth-K5hRRqX0Bt6V0e8azcKKDnq0ZypXcE.png"
            alt="GapstoGrowth Logo"
            width={280}
            height={280}
            className="relative drop-shadow-xl"
            priority
          />
        </div>
      </div>

      {/* Text below glass card */}
      <div className="relative mt-12 text-center">
        <h2 className="text-2xl font-bold text-white drop-shadow-lg">Close Every Gap</h2>
        <p className="mt-2 text-sm text-white/80 drop-shadow-md">Transform talent, unlock growth</p>
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
      <div className="hidden flex-1 flex-col items-center justify-center bg-linear-to-br from-brand to-brand/80 px-8 lg:flex">
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
              <svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
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
