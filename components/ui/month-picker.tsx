'use client'

import * as React from 'react'
import { CalendarDays } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/**
 * Pick a month, as "YYYY-MM".
 *
 * Reports here were choosing a month from a Select built by recentMonths(18) —
 * a flat list of the last eighteen. It worked until someone needed a month that
 * had fallen off the end, and then that month was unreachable from the screen
 * entirely. There is no day to choose in a monthly report, so a full date picker
 * would be offering a decision that does not exist.
 *
 * A year strip plus a twelve-month grid: two clicks to anywhere, and the year in
 * view is always visible. Deliberately NOT built on the DayPicker calendar —
 * that renders a day grid this control has no use for, and its month/year
 * dropdowns are the thing that was broken in the first place.
 */
export interface MonthPickerProps {
  id?: string
  /** "YYYY-MM". */
  value: string
  onChange: (value: string) => void
  /** Earliest selectable year. Defaults to five years back. */
  fromYear?: number
  /** Latest selectable year. Defaults to the current year. */
  toYear?: number
  disabled?: boolean
  className?: string
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function parse(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '')
  if (!match) return null
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return { year: Number(match[1]), month }
}

function label(value: string): string {
  const parsed = parse(value)
  if (!parsed) return 'Select a month'
  const date = new Date(parsed.year, parsed.month - 1, 1)
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export function MonthPicker({
  id,
  value,
  onChange,
  fromYear,
  toYear,
  disabled,
  className,
}: MonthPickerProps) {
  const now = new Date()
  const maxYear = toYear ?? now.getFullYear()
  const minYear = fromYear ?? maxYear - 5

  const selected = parse(value)
  const [open, setOpen] = React.useState(false)
  // The year on show, which is not the same as the year selected: someone can
  // browse 2023 without having chosen a month in it yet.
  const [viewYear, setViewYear] = React.useState(() => selected?.year ?? maxYear)

  React.useEffect(() => {
    if (open) setViewYear(parse(value)?.year ?? maxYear)
  }, [open, value, maxYear])

  const years: number[] = []
  for (let year = maxYear; year >= minYear; year -= 1) years.push(year)

  const choose = (monthIndex: number) => {
    onChange(`${viewYear}-${String(monthIndex + 1).padStart(2, '0')}`)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarDays className="mr-2 size-4 shrink-0" aria-hidden="true" />
          {label(value)}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-3" align="start">
        <div
          className="g2g-scrollbar mb-3 flex gap-1 overflow-x-auto pb-1"
          role="group"
          aria-label="Year"
        >
          {years.map((year) => (
            <Button
              key={year}
              type="button"
              size="sm"
              variant={year === viewYear ? 'default' : 'ghost'}
              className="h-7 shrink-0 px-2 text-xs"
              aria-pressed={year === viewYear}
              onClick={() => setViewYear(year)}
            >
              {year}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1" role="group" aria-label="Month">
          {MONTHS.map((name, index) => {
            const isSelected =
              selected?.year === viewYear && selected?.month === index + 1

            return (
              <Button
                key={name}
                type="button"
                size="sm"
                variant={isSelected ? 'default' : 'ghost'}
                className="h-8 text-xs"
                aria-pressed={isSelected}
                onClick={() => choose(index)}
              >
                {name}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
