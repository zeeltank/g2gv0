'use client'

// Re-export shared components from Layer 2 for backward compatibility
// These components have been moved to components/business/shared.tsx
export { SectionCard, ReadField, FormField, Tabs } from '@/shared/business'

import * as React from 'react'
import { Lock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ReactNode } from 'react'

// TextInput - wrapper around Input primitive (org-specific)
export function TextInput({
  id,
  placeholder,
  defaultValue,
  value,
  onChange,
  type = 'text',
  disabled,
}: {
  id?: string
  placeholder?: string
  defaultValue?: string
  value?: string
  onChange?: React.ChangeEventHandler<HTMLInputElement>
  type?: string
  disabled?: boolean
}) {
  return (
    <Input
      id={id}
      type={type}
      placeholder={placeholder}
      defaultValue={defaultValue}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  )
}

// SelectInput - wrapper around Select primitive (org-specific)
export function SelectInput({
  id,
  defaultValue,
  value,
  onChange,
  options,
  disabled,
  className,
}: {
  id?: string
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
  className?: string
}) {
  return (
    <Select
      id={id}
      defaultValue={defaultValue}
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
      className={className}
    />
  )
}

// TextArea - wrapper around Textarea primitive (org-specific)
export function TextArea({
  id,
  placeholder,
  defaultValue,
  value,
  onChange,
  rows = 3,
  disabled,
}: {
  id?: string
  placeholder?: string
  defaultValue?: string
  value?: string
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>
  rows?: number
  disabled?: boolean
}) {
  return (
    <Textarea
      id={id}
      rows={rows}
      placeholder={placeholder}
      defaultValue={defaultValue}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  )
}

// AccessDenied - uses Lock icon and custom layout (org-specific)
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
