'use client'

import { useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SignalRunsPanel } from '@/components/domain/signals/signal-runs-panel'

/**
 * "Run health & cost" on Market Signals: how the latest research runs of the organisation went and what they cost (the Signal Review's Runs tab).
 * It is always there, in every scope, because the runs belong to the organisation and not to the product on screen. The panel reads the runs when the
 * window opens, so what it shows is as old as the click. It is NOT the Advanced tools' "Report history" (one product's reports and the sources each read).
 *
 * The Signal Review kept its open tab in the address (`?tab=runs`), and an old link to that tab arrives here with the same address (the old addresses
 * redirect and keep their query), so the window opens on arrival; closing it takes `tab` out of the address and leaves everything else in it.
 */
export function RunHealthButton({ className }: { className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(() => searchParams.get('tab') === 'runs')
  const opener = useRef<HTMLButtonElement>(null)

  const change = (next: boolean) => {
    setOpen(next)
    if (next || searchParams.get('tab') !== 'runs') return
    const rest = new URLSearchParams(searchParams.toString())
    rest.delete('tab')
    const query = rest.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <>
      <Button ref={opener} type="button" variant="outline" size="lg" className={className} onClick={() => change(true)}>
        <Activity className="mr-2 size-4" aria-hidden="true" />
        Run health &amp; cost
      </Button>
      <Dialog open={open} onOpenChange={change}>
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-6xl overflow-y-auto"
          onCloseAutoFocus={(event) => {
            // Safari does not focus a button on click, so the window cannot rely on remembering what had focus: it goes back to the button itself.
            if (!opener.current) return
            event.preventDefault()
            opener.current.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>Run health &amp; cost</DialogTitle>
            <DialogDescription>
              How the latest research runs of your organisation went and what they cost, across all products. The sources each run read are under Report history in Advanced tools, once a product is chosen.
            </DialogDescription>
          </DialogHeader>
          <div className="min-w-0">
            <SignalRunsPanel />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
