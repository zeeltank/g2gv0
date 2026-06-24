"use client"

import * as React from "react"
import { Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Select } from "@/components/ui/select"

interface TimePickerProps {
  value?: string // format: "HH:mm"
  onChange?: (time: string) => void
  className?: string
}

export function TimePicker({ value = "09:00", onChange, className }: TimePickerProps) {
  const [hour, minute] = value.split(":")

  const hours = Array.from({ length: 24 }, (_, i) => ({
    label: i.toString().padStart(2, "0"),
    value: i.toString().padStart(2, "0"),
  }))

  const minutes = Array.from({ length: 60 }, (_, i) => ({
    label: i.toString().padStart(2, "0"),
    value: i.toString().padStart(2, "0"),
  }))

  const handleHourChange = (newHour: string) => {
    onChange?.(`${newHour}:${minute}`)
  }

  const handleMinuteChange = (newMinute: string) => {
    onChange?.(`${hour}:${newMinute}`)
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
        />
      </div>
      <span className="text-muted-foreground font-medium">:</span>
      <div className="w-20">
        <Select 
          options={minutes} 
          value={minute} 
          onChange={handleMinuteChange} 
          placeholder="MM" 
        />
      </div>
    </div>
  )
}
