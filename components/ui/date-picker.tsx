"use client"

import * as React from "react"
import * as dateFns from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  value?: Date | string
  onChange?: (date?: Date | string) => void
  placeholder?: string
  className?: string
  id?: string
  disabled?: boolean
  /** Earliest selectable year in the year dropdown. */
  fromYear?: number
  /** Latest selectable year in the year dropdown. */
  toYear?: number
}

/**
 * Strings arrive from forms and APIs; reject the ones date-fns would throw on.
 *
 * A BARE "YYYY-MM-DD" MUST BE PARSED AS LOCAL, NOT UTC. `new Date("2026-01-02")`
 * is defined to parse as UTC midnight, so west of Greenwich it renders as
 * 1 January — the calendar highlights the day before the stored one. Splitting
 * the parts and using the Date(y, m, d) constructor pins it to local midnight,
 * which is what every caller means by a date-only value.
 *
 * Datetime strings (anything with a "T") keep the standard parse; those carry a
 * real instant and their offset is meaningful.
 */
function toValidDate(value?: Date | string): Date | undefined {
  if (!value) return undefined

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value)

  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  id,
  disabled,
  fromYear = new Date().getFullYear() - 100,
  toYear = new Date().getFullYear() + 10,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const dateValue = toValidDate(value)

  // The month the calendar is showing. Kept in state so navigation works, and
  // re-anchored to the selected date each time the popover opens so reopening
  // lands on the chosen month rather than today.
  const [month, setMonth] = React.useState<Date>(dateValue ?? new Date())

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setMonth(dateValue ?? new Date())
    setOpen(nextOpen)
  }

  const handleSelect = (selected?: Date) => {
    onChange?.(selected)
    // Close only on an actual pick, so clearing keeps the calendar open.
    if (selected) setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          // Without this the trigger defaults to type="submit" and submits the
          // surrounding form instead of opening the calendar.
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-8 px-3 border-input bg-transparent hover:bg-transparent cursor-pointer active:scale-95 transition-all duration-200",
            !dateValue && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {dateValue ? dateFns.format(dateValue, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelect}
          month={month}
          onMonthChange={setMonth}
          captionLayout="dropdown"
          startMonth={new Date(fromYear, 0)}
          endMonth={new Date(toYear, 11)}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
