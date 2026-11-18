import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

/**
 * Position a popover against something that is not its trigger.
 *
 * Added for the attendance grid, where ~1,550 day cells share ONE popover: the
 * grid tracks which cell is hovered or focused and anchors the single popover
 * to that cell's rect. Wrapping every cell in its own Popover root would be the
 * obvious alternative and would mean 1,550 Radix roots on one screen.
 *
 * It is also why ui/tooltip.tsx could not be used there - it is hand-rolled and
 * absolutely positioned inside a `relative` wrapper, so it is clipped by any
 * `overflow-x-auto` ancestor. This one portals.
 */
const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        // z-[60] clears the Sheet (z-50) and Dialog (content and overlay both
        // z-50) this popover is commonly opened from. pointer-events-auto is
        // required because a modal Radix Dialog/Sheet sets pointer-events:none
        // on <body>, which this portalled content would otherwise inherit -
        // the popover would render but swallow every click.
        "z-[60] w-72 rounded-md border border-border/50 bg-popover p-4 text-popover-foreground shadow-md outline-none pointer-events-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent }
