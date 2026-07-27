"use client"

import * as React from "react"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

/**
 * react-day-picker v9 markup, for reference when editing the classNames below:
 *
 *   root > months > [ nav, month > [ month_caption, month_grid ] ]
 *   month_grid > weeks > week > day (td) > day_button (button)
 *
 * Two things matter and were previously wrong:
 *  - `nav` is a sibling of `month` inside `months`, so `months` must be
 *    positioned for the absolute nav to anchor to the calendar.
 *  - `day` is the <td>; `day_button` is the real <button>. Button styling has
 *    to land on `day_button` or the click target will not match the visible
 *    cell. The selected/today modifiers are applied to the <td>, so they reach
 *    the button through a child selector.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: "w-fit",
        // `relative` anchors the absolutely positioned nav below.
        months: "relative flex flex-col sm:flex-row gap-4",
        month: "space-y-4",

        month_caption: "flex h-9 items-center justify-center px-9",
        caption_label: "text-sm font-medium",

        // Full-width bar sitting over the caption row: previous on the left,
        // next on the right. z-10 keeps the buttons clickable above the label.
        nav: "absolute inset-x-0 top-0 z-10 flex h-9 items-center justify-between px-1",

        button_previous: cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
        ),

        button_next: cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
        ),

        // Month / year dropdowns, used when captionLayout is a dropdown variant.
        dropdowns: "flex items-center justify-center gap-2 text-sm font-medium",
        dropdown_root: "relative inline-flex items-center rounded-md border border-input px-2 py-1 hover:bg-accent",
        // The native select is laid over its label so it stays keyboard and
        // pointer accessible while the styled label shows through.
        dropdown: "absolute inset-0 h-full w-full cursor-pointer opacity-0",
        months_dropdown: "",
        years_dropdown: "",
        chevron: "size-4",

        month_grid: "w-full border-collapse",

        weekdays: "flex",
        weekday: "w-9 text-center text-xs font-normal text-muted-foreground",

        weeks: "",
        week: "flex w-full mt-2",

        // The cell. Keep it sized, but let the button inside own the styling.
        day: "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 cursor-pointer p-0 font-normal"
        ),

        // Modifier classes land on the <td>, so reach the button from there.
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground [&>button:focus]:bg-primary [&>button:focus]:text-primary-foreground",
        today: "[&>button]:bg-accent [&>button]:text-accent-foreground",

        outside: "[&>button]:text-muted-foreground [&>button]:opacity-50",
        disabled: "[&>button]:text-muted-foreground [&>button]:opacity-50 [&>button]:pointer-events-none",
        hidden: "invisible",

        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...chevronProps }) => {
          const Icon =
            orientation === "left" ? ChevronLeft : orientation === "right" ? ChevronRight : ChevronDown

          return <Icon className={cn("h-4 w-4", chevronClassName)} {...chevronProps} />
        },
      }}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
