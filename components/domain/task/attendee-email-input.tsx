'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  disabled?: boolean
}

/**
 * Email-chip input, factored out of create-event-modal.tsx's own inline
 * block - event-details-drawer.tsx is a second consumer. Stays email-only,
 * matching the create flow's own deliberate scope (no internal-user picker
 * at create time): an internal picker would be a different kind of control,
 * not a variant of this one.
 */
export function AttendeeEmailInput({ value, onChange, placeholder = 'name@company.com, press Enter', disabled }: Props) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const email = draft.trim()
    if (!email) return
    if (!value.includes(email)) onChange([...value, email])
    setDraft('')
  }

  return (
    <div>
      <div className="flex gap-2">
        <Input
          type="email"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || !draft.trim()) return
            event.preventDefault()
            add()
          }}
          placeholder={placeholder}
          disabled={disabled}
        />
        <Button type="button" variant="outline" size="icon" disabled={disabled || !draft.trim()} onClick={add}>
          <Plus className="size-4" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {value.map((email) => (
            <span key={email} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
              {email}
              <button type="button" aria-label={`Remove ${email}`} disabled={disabled} onClick={() => onChange(value.filter((existing) => existing !== email))}>
                <X className="size-3 text-muted-foreground hover:text-foreground" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
