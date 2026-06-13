import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  delayMs?: number
  children: React.ReactNode
}

const Tooltip = ({ content, side = 'top', delayMs = 200, children }: TooltipProps) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const timeoutRef = React.useRef<NodeJS.Timeout>()

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(true), delayMs)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsOpen(false)
  }

  const sideClass = {
    top: 'bottom-full mb-2',
    right: 'left-full ml-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
  }[side]

  const arrowClass = {
    top: 'top-full -translate-y-0.5 border-t-card border-x-transparent border-b-transparent',
    right: 'right-full translate-x-0.5 border-r-card border-y-transparent border-l-transparent',
    bottom: 'bottom-full translate-y-0.5 border-b-card border-x-transparent border-t-transparent',
    left: 'left-full -translate-x-0.5 border-l-card border-y-transparent border-r-transparent',
  }[side]

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground shadow-lg',
            sideClass,
          )}
          role="tooltip"
        >
          {content}
          <div
            className={cn(
              'absolute border-4',
              arrowClass,
            )}
          />
        </div>
      )}
    </div>
  )
}
Tooltip.displayName = 'Tooltip'

export { Tooltip }
