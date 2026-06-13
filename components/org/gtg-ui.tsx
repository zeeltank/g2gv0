'use client'

// Re-export reusable primitives for backward compatibility
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
export { Badge, type BadgeProps } from '@/components/ui/badge'
export { Button } from '@/components/ui/button'
export { Input } from '@/components/ui/input'
export { Textarea } from '@/components/ui/textarea'
export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
export { Label } from '@/components/ui/label'
export { EmptyState } from '@/components/ui/empty-state'
export { StatusBadge } from '@/components/ui/status-badge'

// Legacy component exports for backward compatibility during migration
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

// SectionCard - wraps Card primitive
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      {(title || actions) && (
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              {title && (
                <h2 className="text-xl font-semibold text-foreground">{title}</h2>
              )}
              {description && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  )
}

// ReadField - simple key-value display
export function ReadField({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">{value || '—'}</dd>
    </div>
  )
}

// FormField - wrapper with label and hint
export function FormField({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  required?: boolean
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-foreground"
      >
        {label}
        {required && <span className="ml-0.5 text-primary">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// TextInput - wrapper around Input primitive
export function TextInput({
  id,
  placeholder,
  defaultValue,
  type = 'text',
  disabled,
}: {
  id?: string
  placeholder?: string
  defaultValue?: string
  type?: string
  disabled?: boolean
}) {
  return (
    <input
      id={id}
      type={type}
      placeholder={placeholder}
      defaultValue={defaultValue}
      disabled={disabled}
      className={cn(
        'h-10 w-full rounded-md border border-input bg-surface px-3 text-[15px] text-foreground transition-colors duration-200 outline-none',
        'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
      )}
    />
  )
}

// SelectInput - wrapper around Select primitive
export function SelectInput({
  id,
  defaultValue,
  value,
  onChange,
  options,
  disabled,
}: {
  id?: string
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
}) {
  return (
    <select
      id={id}
      defaultValue={defaultValue}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      disabled={disabled}
      className={cn(
        'h-10 w-full rounded-md border border-input bg-surface px-3 text-[15px] text-foreground transition-colors duration-200 outline-none',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

// TextArea - wrapper around Textarea primitive
export function TextArea({
  id,
  placeholder,
  defaultValue,
  rows = 3,
  disabled,
}: {
  id?: string
  placeholder?: string
  defaultValue?: string
  rows?: number
  disabled?: boolean
}) {
  return (
    <textarea
      id={id}
      rows={rows}
      placeholder={placeholder}
      defaultValue={defaultValue}
      disabled={disabled}
      className={cn(
        'w-full rounded-md border border-input bg-surface px-3 py-2 text-[15px] leading-relaxed text-foreground transition-colors duration-200 outline-none',
        'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
      )}
    />
  )
}

// AccessDenied - uses Lock icon and custom layout
export function AccessDenied({ role }: { role: string }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <div
        className="mb-5 flex size-14 items-center justify-center rounded-lg bg-danger/10 text-danger"
        aria-hidden="true"
      >
        <Lock className="size-7" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">Access Restricted</h2>
      <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
        The <span className="font-semibold text-foreground">{role}</span> role does
        not have permission to view this page. Contact your administrator if you
        believe this is an error.
      </p>
    </div>
  )
}

// Tabs - custom implementation for tab navigation
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div
      role="tablist"
      className="flex items-center gap-1 border-b border-border"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative -mb-px h-10 px-4 text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {isActive && (
              <span
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary"
                aria-hidden="true"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
