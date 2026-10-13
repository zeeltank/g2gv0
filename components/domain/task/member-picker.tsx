'use client'

import { X } from 'lucide-react'
import { Select } from '@/components/ui/select'

interface MemberOption {
  id: string
  name: string
}

interface Props {
  /** Currently chosen ids, in display order. */
  value: string[]
  /** The full candidate pool - rendered choices exclude whatever's already in `value`. */
  options: MemberOption[]
  onChange: (nextIds: string[]) => void
  placeholder?: string
  disabled?: boolean
}

/**
 * Pick-and-chip member selection, factored out of create-project-modal.tsx's
 * own inline block - project-detail-view.tsx's Team tab is now a second
 * consumer, which is the bar this codebase uses for "worth sharing".
 *
 * Deliberately stateless: `onChange` receives the FULL next id list (one
 * add or one remove at a time) and the caller decides what happens to it.
 * That split is what lets the two consumers behave so differently from the
 * same component - the modal accumulates locally until its own Save fires,
 * while the Team tab calls syncProjectMembers immediately on every change.
 */
export function MemberPicker({ value, options, onChange, placeholder = 'Select an employee...', disabled }: Props) {
  const remaining = options.filter((option) => !value.includes(option.id))
  const nameOf = (id: string) => options.find((option) => option.id === id)?.name ?? id

  return (
    <div>
      <Select
        value=""
        onChange={(id) => id && onChange([...value, id])}
        options={[{ value: '', label: placeholder }, ...remaining.map((option) => ({ value: option.id, label: option.name }))]}
        className="h-11 rounded-xl"
        disabled={disabled}
      />
      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map((id) => (
            <span key={id} className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              {nameOf(id)}
              <button
                type="button"
                onClick={() => onChange(value.filter((existing) => existing !== id))}
                className="rounded-full p-0.5 hover:bg-primary/20"
                disabled={disabled}
                aria-label={`Remove ${nameOf(id)}`}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
