'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ExternalLink, Maximize2, PlayCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { clientPresentationPage, type ClientPresentationLink } from '@/lib/client-presentation/link'

/**
 * The customer presentation inside a My Learning lesson: the deck in a frame, with Full screen and New tab, the same pattern as the
 * sales-training launcher. The deck (opened with ?embed=1) reports where it is by postMessage, same origin only; the first step marks
 * the lesson started, reaching the last slide ticks it complete through the normal progress call.
 */
export function ClientPresentationLauncher({
  link,
  title,
  completed,
  onProgress,
  onComplete,
}: {
  link: ClientPresentationLink
  title: string | null
  completed: boolean
  onProgress: () => void
  onComplete: () => void
}) {
  const [at, setAt] = useState<{ step: number; of: number; percent: number } | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const started = useRef(false)

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      if (event.source !== frame.current?.contentWindow) return
      const data = event.data as { src?: string; key?: string; type?: string; step?: number; of?: number; percent?: number } | null
      if (!data || data.src !== 'g2g-client-presentation' || data.key !== link.key) return
      if (typeof data.step === 'number' && typeof data.of === 'number' && typeof data.percent === 'number') {
        setAt({ step: data.step, of: data.of, percent: data.percent })
      }
      if (data.type === 'completed') {
        if (!completed) onComplete()
        return
      }
      // First step only: mark the lesson as started, and never once it is complete (it must not slip back to "in progress").
      if (!started.current && !completed) {
        started.current = true
        onProgress()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [link.key, completed, onProgress, onComplete])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === box.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void box.current?.requestFullscreen?.()
  }
  const src = typeof window === 'undefined' ? null : clientPresentationPage(link, true)

  return (
    <div className="flex w-full min-w-0 flex-col gap-3" data-testid="client-presentation-launcher">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {completed ? <CheckCircle2 className="size-4 text-emerald-500" /> : <PlayCircle className="size-4 text-primary" />}
          {link.mode === 'short' ? 'Customer presentation, five-slide version' : 'Customer presentation'}
          {at ? <span className="text-xs font-normal text-muted-foreground">Slide {at.step} of {at.of}</span> : null}
          {completed ? <span className="text-xs font-normal text-emerald-600">Completed</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={toggleFullscreen}>
            <Maximize2 className="size-3.5" /> Full screen
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open(clientPresentationPage(link), '_blank')}>
            <ExternalLink className="size-3.5" /> New tab
          </Button>
        </div>
      </div>
      <div ref={box} className="w-full min-w-0 overflow-hidden rounded-xl border border-border/60 bg-black shadow-sm">
        {src ? (
          <iframe
            ref={frame}
            title={title ?? 'Customer presentation'}
            src={src}
            allow="fullscreen"
            className={fullscreen ? 'h-screen w-screen' : 'aspect-video max-h-[78vh] w-full'}
          />
        ) : (
          <Skeleton className="aspect-video w-full" />
        )}
      </div>
      {at && !completed ? <Progress value={at.percent} className="h-1.5" /> : null}
      <p className="text-xs text-muted-foreground">
        Use the arrow keys or the buttons in the frame. Reaching the last slide marks this lesson complete.
      </p>
    </div>
  )
}
