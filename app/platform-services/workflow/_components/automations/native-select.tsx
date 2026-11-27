'use client'

import { forwardRef, type SelectHTMLAttributes } from 'react'
import { NativeSelect as ScaffoldSelect } from '@/components/shared/scaffolds/form-field'
import { cn } from '@/lib/utils'

/**
 * The scaffold's native select with an explicit background and text colour. The scaffold leaves the background transparent, and a native list then takes its
 * colours from the system, which in dark mode on Windows gives dark text on a dark list. The scaffold is left as it is.
 */
export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <ScaffoldSelect ref={ref} className={cn('bg-background text-foreground', className)} {...props} />
))
NativeSelect.displayName = 'NativeSelect'
