'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ListPage } from '@/components/shared/scaffolds/list-page'
import { PageTabs, TabPanel, type PageTab } from '@/components/shared/scaffolds/page-tabs'
import { useListQuery } from '@/components/shared/scaffolds/use-list-query'
import { useUrlTab } from '@/components/shared/scaffolds/use-url-tab'
import { finishedNotice, type Timers } from '@/lib/signal-review/generate-model'
import { queryToParams, SIGNAL_LIST_QUERY } from '@/lib/signal-review/list-model'
import { NOTICE_TONE } from '@/lib/org-accounts/tones'
import { cn } from '@/lib/utils'
import { signalReviewService, type SignalReviewApi } from '@/services/signal-review/signal-review-service'
import { signalRunService, type RunSnapshot, type SignalRunApi } from '@/services/signal-review/signal-run-service'
import { SignalExportButton, type ScreenNotice } from './signal-export-button'
import { SignalGenerateDialog } from './signal-generate-dialog'
import { SignalReviewList } from './signal-review-list'
import { SignalRunsPanel } from './signal-runs-panel'

// Defined once, outside the component: useUrlTab depends on the ids. The first is the default and keeps the plain address.
const TAB_IDS = ['signals', 'runs'] as const
const TABS: PageTab[] = [
  { id: 'signals', label: 'Signals' },
  { id: 'runs', label: 'Runs' },
]
const ID_PREFIX = 'signal-review'

const NOTICE_TONES: Record<ScreenNotice['tone'], string> = {
  success: NOTICE_TONE.success,
  warning: 'border-warning/30 bg-warning/10 text-foreground',
  error: NOTICE_TONE.error,
  info: 'border-border bg-muted/40 text-foreground',
}

/**
 * Signal Review (Sales & Marketing › Signals › Signal Review): the signals worth a look, with the evidence behind each, and a place to decide on them
 * and keep the reason. The Runs tab shows what each research run did and cost. The open tab is kept in the address (?tab=runs). The page header starts a
 * research run ("Generate signals") and, on the Signals tab, saves the signals that match the filters as a file ("Export"); what either did is said in a
 * notice above the list. `service`, `runService` and `timers` are for tests; the screen uses the real ones.
 */
export function SignalReviewView({ service = signalReviewService, runService = signalRunService, timers }: {
  service?: SignalReviewApi
  runService?: SignalRunApi
  timers?: Timers
}) {
  const [tab, setTab] = useUrlTab(TAB_IDS)
  // The same address the list reads, so the export asks for exactly the signals the list is showing.
  const { query } = useListQuery(SIGNAL_LIST_QUERY)
  const params = useMemo(() => queryToParams(query), [query])

  const [generateOpen, setGenerateOpen] = useState(false)
  const [notice, setNotice] = useState<ScreenNotice | null>(null)
  // Changes whenever a research run ends: the list reads again, and the Runs tab is built again so it shows the run.
  const [runsVersion, setRunsVersion] = useState(0)
  const generateButton = useRef<HTMLButtonElement>(null)

  const onFinished = useCallback((run: RunSnapshot | null) => {
    setRunsVersion((n) => n + 1)
    const finished = run ? finishedNotice(run) : null
    if (finished) setNotice(finished)
  }, [])

  const openGenerate = useCallback(() => setGenerateOpen(true), [])
  const closeGenerate = useCallback(() => setGenerateOpen(false), [])

  return (
    <>
      <ListPage
        title="Signal Review"
        description="See why each signal is here, decide what to do with it, and keep the reason."
        actions={(
          <>
            {tab === 'signals' && <SignalExportButton params={params} service={service} onNotice={setNotice} />}
            <Button ref={generateButton} type="button" onClick={openGenerate}>
              <Sparkles aria-hidden="true" />
              Generate signals
            </Button>
          </>
        )}
        toolbar={<div className="w-full"><PageTabs tabs={TABS} active={tab} onChange={setTab} label="Signal Review sections" idPrefix={ID_PREFIX} /></div>}
        notice={notice && (
          <div role="status" className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm', NOTICE_TONES[notice.tone])}>
            <span>{notice.text}</span>
            <Button size="sm" variant="ghost" onClick={() => setNotice(null)} aria-label="Dismiss">Dismiss</Button>
          </div>
        )}
        status="ready"
      >
        <TabPanel id="signals" active={tab} idPrefix={ID_PREFIX}>
          <SignalReviewList service={service} refreshKey={runsVersion} onGenerate={openGenerate} />
        </TabPanel>
        <TabPanel id="runs" active={tab} idPrefix={ID_PREFIX}><SignalRunsPanel key={runsVersion} /></TabPanel>
      </ListPage>

      <SignalGenerateDialog open={generateOpen} onClose={closeGenerate} onFinished={onFinished} service={runService} timers={timers} returnFocusTo={generateButton} />
    </>
  )
}
