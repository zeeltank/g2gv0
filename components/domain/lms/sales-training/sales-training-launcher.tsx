'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ExternalLink, Maximize2, PlayCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import type { SalesProductKey } from '@/lib/sales-training/deck'

const PAGE = (key: SalesProductKey) => `/module/lms/learning/sales-training/${key}`

/**
 * A sales-training lesson inside My Learning. It shows the scenario player in a frame, with the same Full screen and
 * New tab buttons as the other interactive lessons. The player reports its progress by postMessage (same origin only);
 * reaching a won, won-with-concessions or stalled ending ticks the lesson complete through the normal progress call.
 */
export function SalesTrainingLauncher({
  productKey,
  title,
  completed,
  onProgress,
  onComplete,
}: {
  productKey: SalesProductKey
  title: string | null
  completed: boolean
  onProgress: () => void
  onComplete: () => void
}) {
  const [percent, setPercent] = useState<number | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const started = useRef(false)

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      if (event.source !== frame.current?.contentWindow) return
      const data = event.data as { src?: string; key?: string; type?: string; percent?: number } | null
      if (!data || data.src !== 'g2g-sales-training' || data.key !== productKey) return
      if (typeof data.percent === 'number') setPercent(data.percent)
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
  }, [productKey, completed, onProgress, onComplete])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === box.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void box.current?.requestFullscreen?.()
  }
  const src = typeof window === 'undefined' ? null : `${PAGE(productKey)}?embed=1`

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {completed ? <CheckCircle2 className="size-4 text-emerald-500" /> : <PlayCircle className="size-4 text-primary" />}
          Sales training scenario
          {percent !== null && !completed ? <span className="text-xs font-normal text-muted-foreground">{percent}% of slides seen</span> : null}
          {completed ? <span className="text-xs font-normal text-emerald-600">Completed</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={toggleFullscreen}>
            <Maximize2 className="size-3.5" /> Full screen
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open(PAGE(productKey), '_blank')}>
            <ExternalLink className="size-3.5" /> New tab
          </Button>
        </div>
      </div>
      <div ref={box} className="w-full min-w-0 overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm">
        {src ? (
          <iframe
            ref={frame}
            title={title ?? 'Sales training scenario'}
            src={src}
            allow="fullscreen"
            className={fullscreen ? 'h-screen w-screen' : 'h-[74vh] min-h-[540px] w-full'}
          />
        ) : (
          <Skeleton className="h-[74vh] min-h-[540px] w-full" />
        )}
      </div>
      {percent !== null && !completed ? <Progress value={percent} className="h-1.5" /> : null}
      <p className="text-xs text-muted-foreground">
        Choose an answer on each decision. Reaching a deal outcome (won, won with concessions or stalled) marks this lesson complete.
      </p>
    </div>
  )
}
