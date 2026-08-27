import * as React from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectOption {
  label: string
  value: string
}

interface SelectProps {
  id?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  options?: SelectOption[]
  className?: string
  size?: 'sm' | 'default' | 'lg'
  placeholder?: string
  disabled?: boolean
  'aria-label'?: string
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ id, className, size = 'default', value: valueProp, defaultValue, onChange, options = [], placeholder = 'Select...', disabled, 'aria-label': ariaLabel }, ref) => {
    /*
     * Controlled when `value` is passed, uncontrolled otherwise.
     *
     * `defaultValue` was declared on SelectProps but never destructured, so it
     * did nothing, and a Select given neither `value` nor `onChange` had no
     * selection state anywhere: clicking an option called an undefined
     * onChange and the trigger kept rendering the placeholder. Every dropdown
     * in the Add Employee wizard behaved that way - you picked "Engineering"
     * and the box still read "Select Department".
     *
     * Callers that pass `value` are unaffected: isControlled short-circuits
     * the internal state and onChange still fires exactly as before.
     */
    const [internalValue, setInternalValue] = React.useState<string | undefined>(defaultValue)
    const isControlled = valueProp !== undefined
    const value = isControlled ? valueProp : internalValue

    const commit = React.useCallback(
      (next: string) => {
        if (!isControlled) setInternalValue(next)
        onChange?.(next)
      },
      [isControlled, onChange],
    )

    const [open, setOpen] = React.useState(false)
    const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
    const [isMounted, setIsMounted] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)
    const listRef = React.useRef<HTMLDivElement>(null)
    const [popoverStyle, setPopoverStyle] = React.useState<React.CSSProperties>()
    const [openAbove, setOpenAbove] = React.useState(false)
    const typeaheadTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
    const typeaheadBufferRef = React.useRef('')
    const listboxId = React.useId()
    const MAX_POPOVER_HEIGHT = 240

    /*
     * A SEARCH BOX APPEARS ONCE THE LIST IS LONG ENOUGH TO BE ANNOYING.
     *
     * Below this many options, scrolling is faster than typing and a search box
     * is just another thing to look at. Above it, finding one department among
     * ninety by eye is the wrong way to spend somebody's afternoon.
     */
    const SEARCH_THRESHOLD = 8
    const [query, setQuery] = React.useState('')
    const searchRef = React.useRef<HTMLInputElement>(null)
    const showSearch = options.length >= SEARCH_THRESHOLD

    /**
     * What is actually on screen, and therefore what the keyboard navigates.
     *
     * Everything below indexes into THIS, never the full `options` — otherwise
     * pressing Enter on the second visible row would commit the second option
     * of the unfiltered list, which is a different one entirely.
     */
    const visibleOptions = React.useMemo(() => {
      const q = query.trim().toLowerCase()
      if (!q) return options
      return options.filter((option) => option.label.toLowerCase().includes(q))
    }, [options, query])

    React.useImperativeHandle(ref, () => containerRef.current as HTMLDivElement)

    React.useEffect(() => {
      if (open) {
        setIsMounted(true)
        /*
         * Only while UNFILTERED. `options.findIndex` is an index into the full
         * list, and once a search has narrowed things down that index points at
         * a different row — or past the end of what is rendered. The query
         * effect below owns the highlight from then on.
         */
        if (!query) {
          const currentIndex = options.findIndex(o => String(o.value) === String(value))
          setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0)
        }
      } else {
        // The query is cleared on close so reopening never shows a filtered
        // list with no visible reason for the missing options.
        setQuery('')
        const timer = setTimeout(() => setIsMounted(false), 150)
        return () => clearTimeout(timer)
      }
    }, [open, value, options, query])

    /*
     * ── THE DROPDOWN WOULD NOT SCROLL INSIDE A SHEET OR DIALOG ──────────────
     *
     * This popover portals to document.body, which puts it OUTSIDE the
     * `RemoveScroll` wrapper Radix puts around dialog content. That library
     * listens for `wheel` and `touchmove` on `document` and calls
     * preventDefault() on anything it does not recognise as inside the lock —
     * so the mouse wheel and two-finger trackpad scrolling did nothing here,
     * while the keyboard still worked.
     *
     * Its listener is registered `{ passive: false }` — bubble phase, not
     * capture — so stopping propagation on the popover means the event never
     * reaches document and native scrolling behaves normally. No manual
     * scrollTop arithmetic, and nothing else on the page is affected.
     *
     * Native listeners rather than React's onWheel: this subtree is portalled
     * outside the React root, and a native handler on the element itself is
     * unambiguous about firing before document's.
     *
     * ── AND THE SAME THING HAPPENS TO FOCUS ─────────────────────────────────
     *
     * Radix's `FocusScope` does the mirror image with keyboard focus:
     *
     *     document.addEventListener('focusin', handleFocusIn)
     *     …
     *     if (container.contains(target)) { remember it }
     *     else { focus(lastFocusedElementRef.current) }   // ← yanks it back
     *
     * Our search box lives in that same body-level portal, so `contains` is
     * false and focus was pulled back into the dialog the instant you clicked
     * it — the box could be seen and clicked but never typed into.
     *
     * `focusin` and `focusout` bubble (unlike `focus`/`blur`), and Radix
     * registers them on `document` in the bubble phase too, so stopping them
     * here means the dialog never learns about focus moving inside our popover
     * and leaves it alone. It still remembers the trigger as its own last
     * focused element, which is what should happen when the popover closes.
     */
    React.useEffect(() => {
      const node = listRef.current
      if (!open || !node) return

      const keepItHere = (event: Event) => event.stopPropagation()

      node.addEventListener('wheel', keepItHere, { passive: false })
      node.addEventListener('touchmove', keepItHere, { passive: false })
      node.addEventListener('focusin', keepItHere)
      node.addEventListener('focusout', keepItHere)
      return () => {
        node.removeEventListener('wheel', keepItHere)
        node.removeEventListener('touchmove', keepItHere)
        node.removeEventListener('focusin', keepItHere)
        node.removeEventListener('focusout', keepItHere)
      }
    }, [open, isMounted])

    // Typing filters, so the highlight has to come back to the top of what is
    // now on screen rather than pointing at a row that scrolled out of the set.
    React.useEffect(() => {
      if (query) setHighlightedIndex(0)
    }, [query])

    // Focus the search when there is one, so a long list can be narrowed by
    // typing immediately rather than clicking twice.
    React.useEffect(() => {
      if (open && showSearch) {
        const timer = setTimeout(() => searchRef.current?.focus(), 20)
        return () => clearTimeout(timer)
      }
    }, [open, showSearch])

    React.useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node) &&
          !listRef.current?.contains(e.target as Node)
        ) {
          setOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    React.useLayoutEffect(() => {
      if (!open) return

      const positionPopover = () => {
        const trigger = containerRef.current?.getBoundingClientRect()
        if (!trigger) return
        const viewportHeight = window.innerHeight
        const spaceBelow = viewportHeight - trigger.bottom - 12
        const spaceAbove = trigger.top - 12
        const shouldOpenAbove =
          spaceBelow < 180 && spaceAbove > spaceBelow
        const availableHeight = shouldOpenAbove ? spaceAbove : spaceBelow
        const nextMaxHeight = Math.max(
          120,
          Math.min(MAX_POPOVER_HEIGHT, availableHeight)
        )

        setOpenAbove(shouldOpenAbove)
        setPopoverStyle({
          top: shouldOpenAbove
            ? Math.max(8, trigger.top - nextMaxHeight - 4)
            : trigger.bottom + 4,
          left: trigger.left,
          width: Math.max(trigger.width, 128),
          maxHeight: nextMaxHeight,
        })
      }

      /*
       * Reposition when the PAGE moves under the popover — not when the popover
       * scrolls itself. This is a capture listener on window, so before the
       * scroll fix above it never fired for the list; now that the list does
       * scroll, an unguarded handler would recompute the position on every
       * wheel tick and re-render the whole popover for no change.
       */
      const repositionUnlessSelfScroll = (event: Event) => {
        if (event.target instanceof Node && listRef.current?.contains(event.target)) return
        positionPopover()
      }

      positionPopover()
      window.addEventListener('resize', positionPopover)
      window.addEventListener('scroll', repositionUnlessSelfScroll, true)
      return () => {
        window.removeEventListener('resize', positionPopover)
        window.removeEventListener('scroll', repositionUnlessSelfScroll, true)
      }
    }, [open])

    React.useEffect(() => {
      if (!open || !listRef.current) return

      const items = listRef.current.querySelectorAll('[role="option"]')
      items.forEach((item, index) => {
        if (index === highlightedIndex) {
          item.scrollIntoView({ block: 'nearest' })
        }
      })
    }, [highlightedIndex, open])

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return

      switch (e.key) {
        case ' ':
          /* SPACE IS A CHARACTER WHEN THE SEARCH HAS FOCUS.
             Treating it as "open/commit" everywhere made the space bar
             unusable for typing a two-word option name. */
          if (showSearch && open) return
          e.preventDefault()
          if (open && highlightedIndex >= 0 && visibleOptions[highlightedIndex]) {
            commit(visibleOptions[highlightedIndex].value)
            setOpen(false)
          } else {
            setOpen(true)
          }
          break
        case 'Enter':
          e.preventDefault()
          if (open && highlightedIndex >= 0 && visibleOptions[highlightedIndex]) {
            commit(visibleOptions[highlightedIndex].value)
            setOpen(false)
          } else {
            setOpen(true)
          }
          break
        case 'ArrowDown':
          e.preventDefault()
          if (!open) {
            setOpen(true)
          } else {
            setHighlightedIndex(prev =>
              prev < visibleOptions.length - 1 ? prev + 1 : 0
            )
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (!open) {
            setOpen(true)
          } else {
            setHighlightedIndex(prev =>
              prev > 0 ? prev - 1 : visibleOptions.length - 1
            )
          }
          break
        case 'Home':
          e.preventDefault()
          if (open) {
            setHighlightedIndex(0)
          }
          break
        case 'End':
          e.preventDefault()
          if (open) {
            setHighlightedIndex(visibleOptions.length - 1)
          }
          break
        case 'Escape':
          e.preventDefault()
          setOpen(false)
          break
        case 'Tab':
          setOpen(false)
          break
        default:
          // Typeahead is the SHORT-LIST equivalent of the search box. With a
          // search box on screen it would compete for the same keystrokes.
          if (!showSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault()
            typeaheadBufferRef.current += e.key.toLowerCase()
            
            if (typeaheadTimeoutRef.current) {
              clearTimeout(typeaheadTimeoutRef.current)
            }
            
            typeaheadTimeoutRef.current = setTimeout(() => {
              typeaheadBufferRef.current = ''
            }, 500)
            
            const matchIndex = visibleOptions.findIndex(opt =>
              opt.label.toLowerCase().startsWith(typeaheadBufferRef.current)
            )
            
            if (matchIndex >= 0) {
              setHighlightedIndex(matchIndex)
            }
          }
      }
    }

    const sizeClass = {
      sm: 'h-7 px-2.5 text-xs',
      default: 'h-8 px-3 text-sm',
      lg: 'h-9 px-3.5 text-base',
    }[size]

    const selectedLabel = options.find(o => String(o.value) === String(value))?.label || placeholder
    const portalContainer =
      typeof document !== 'undefined' ? document.body : null

    return (
      <div 
        ref={containerRef} 
        id={id}
        className="relative inline-block w-full"
        onKeyDown={handleKeyDown}
      >
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={() => !disabled && setOpen(!open)}
          className={cn(
            'flex w-full items-center justify-between rounded-lg border border-input bg-transparent py-1.5 text-foreground transition-all duration-200 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 appearance-none cursor-pointer active:scale-95',
            sizeClass,
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className={cn('size-4 opacity-50 transition-transform duration-200', open && 'rotate-180')} />
        </button>

        {(isMounted || open) && portalContainer && createPortal(
          <div
            ref={listRef}
            style={popoverStyle}
            role="listbox"
            aria-label={ariaLabel || 'Select options'}
            className={cn(
              // flex column so the search stays pinned while the LIST scrolls;
              // overflow moves off this element onto the list below it.
              'pointer-events-auto fixed z-[100] flex max-h-60 min-w-[8rem] flex-col overflow-hidden rounded-xl border border-border/50 bg-card/98 backdrop-blur-xl p-1 shadow-xl ring-1 ring-black/5',
              'transition-all duration-150 ease-out',
              openAbove ? 'origin-bottom' : 'origin-top',
              open
                ? 'opacity-100 scale-100 translate-y-0'
                : openAbove
                  ? 'opacity-0 scale-95 translate-y-2 pointer-events-none'
                  : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
            )}
          >
            {showSearch && (
              <div className="shrink-0 border-b border-border/50 p-1 pb-1.5">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    /* Arrow keys and Enter belong to the LIST even while the
                       search has focus — otherwise typing narrows the options
                       and then the keyboard cannot reach them. */
                    onKeyDown={handleKeyDown}
                    placeholder="Search…"
                    aria-label="Search options"
                    aria-controls={listboxId}
                    autoComplete="off"
                    className="h-7 w-full rounded-md border border-border bg-background pl-7 pr-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
              {/* A search that matches nothing is its own answer. Rendering an
                  empty box would read as a broken dropdown. */}
              {visibleOptions.length === 0 && (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  Nothing matches “{query}”
                </p>
              )}
              {visibleOptions.map((opt, index) => (
                <div
                  key={`${opt.value}-${index}`}
                  role="option"
                  aria-selected={String(value) === String(opt.value)}
                  onPointerDown={(event) => {
                    event.preventDefault()
                    commit(opt.value)
                    setOpen(false)
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm text-foreground transition-colors outline-none cursor-pointer hover:bg-accent hover:text-accent-foreground',
                    highlightedIndex === index && 'bg-accent text-accent-foreground',
                    String(value) === String(opt.value) && 'bg-primary/15 text-primary font-medium'
                  )}
                >
                  {opt.label}
                  {String(value) === String(opt.value) && <Check className="size-4" />}
                </div>
              ))}
            </div>
          </div>,
          portalContainer,
        )}
      </div>
    )
  },
)
Select.displayName = 'Select'

export { Select, type SelectOption }
