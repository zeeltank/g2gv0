"use client"

import * as React from "react"
import { Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Select } from "@/components/ui/select"

interface TimePickerProps {
  value?: string // format: "HH:mm"
  defaultValue?: string
  onChange?: (time: string) => void
  className?: string
  disabled?: boolean
}

/**
 * Controlled when `value` is passed, uncontrolled otherwise.
 *
 * Hour and minute used to be derived from the `value` prop alone, so a caller
 * that passed a literal (`value="09:00"`) with no onChange had a picker that
 * could not be changed - selecting a different hour fired an undefined
 * callback and the display snapped straight back. Both the Add Employee
 * wizard and the Personal Info tab painted fixed 09:00/18:00 shifts that way.
 */
export function TimePicker({ value: valueProp, defaultValue = "09:00", onChange, className, disabled }: TimePickerProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const isControlled = valueProp !== undefined
  const value = isControlled ? valueProp : internalValue

  const commit = (next: string) => {
    if (!isControlled) setInternalValue(next)
    onChange?.(next)
  }

  // Tolerate "HH:mm:ss" - the API returns TIME columns in that form.
  const [hour = "09", minute = "00"] = (value || "09:00").split(":")

  const hours = Array.from({ length: 24 }, (_, i) => ({
    label: i.toString().padStart(2, "0"),
    value: i.toString().padStart(2, "0"),
  }))

  const minutes = Array.from({ length: 60 }, (_, i) => ({
    label: i.toString().padStart(2, "0"),
    value: i.toString().padStart(2, "0"),
  }))

  const handleHourChange = (newHour: string) => {
    commit(`${newHour}:${minute}`)
  }

  const handleMinuteChange = (newMinute: string) => {
    commit(`${hour}:${newMinute}`)
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Clock className="w-4 h-4 text-muted-foreground mr-1" />
      <div className="w-20">
        <Select
          options={hours}
          value={hour}
          onChange={handleHourChange}
          placeholder="HH"
          disabled={disabled}
        />
      </div>
      <span className="text-muted-foreground font-medium">:</span>
      <div className="w-20">
        <Select
          options={minutes}
          value={minute}
          onChange={handleMinuteChange}
          placeholder="MM"
          disabled={disabled}
        />
      </div>
    </div>
  )
}
