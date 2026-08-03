'use client'

import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'

/**
 * Shared chrome for the payroll screens: the HR/Admin gate that mirrors where
 * the payroll routes sit in Laravel's menu, plus the page heading.
 */
export function PayrollPageShell({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
}) {
  const { user, isLoading } = useAuth()

  if (!isLoading && (!user || !['admin', 'hr'].includes(user.role))) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center sm:min-h-[480px] sm:px-8 sm:py-16">
        <div
          className="mb-5 flex size-14 items-center justify-center rounded-lg bg-danger/10 text-danger sm:mb-6 sm:size-16"
          aria-hidden="true"
        >
          <Lock className="size-7 sm:size-8" />
        </div>
        <h2 className="text-xl font-semibold text-foreground sm:text-2xl">Access Restricted</h2>
        <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:mt-3 sm:text-base">
          {title} is accessible to HR Manager and Administrator roles only.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-full flex-col gap-4 sm:gap-5 md:gap-6">
      <div className="flex flex-col gap-3 px-4 sm:px-0 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:mt-2 sm:text-base">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>

      <div className="flex flex-col gap-4 px-4 pb-4 sm:px-0 sm:pb-0 sm:gap-5 md:gap-6">{children}</div>
    </div>
  )
}

/** Dismissible success / failure banner used by every payroll screen. */
export function PayrollMessages({
  error,
  actionMessage,
  onDismiss,
}: {
  error: string | null
  actionMessage: string | null
  onDismiss: () => void
}) {
  if (!error && !actionMessage) return null

  return (
    <Alert variant={error ? 'destructive' : undefined}>
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>{error ?? actionMessage}</span>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </AlertDescription>
    </Alert>
  )
}

export function PayrollTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}

/** Client-side CSV export - the project ships no spreadsheet dependency. */
export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (value: string | number) => {
    const text = String(value ?? '')
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
