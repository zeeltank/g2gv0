'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, NativeSelect } from '@/components/shared/scaffolds/form-field'
import { FormLayout } from '@/components/shared/scaffolds/form-layout'
import { icpHref } from '@/lib/product-selection'
import {
  CUSTOMER_MODELS, describeStartFailure, EMPTY_FORM, failedRunText, failureContext, nextPollStep, onlyProduct, POLL_MS, productOptions, progressLines,
  runGoneFailure, subProductOptions, toRequest, validateGenerate, type GenerateForm, type StartFailure, type Timers,
} from '@/lib/signal-review/generate-model'
import type { ProductInfo } from '@/services/portfolio/types'
import { signalRunService, type CustomerModel, type RunSnapshot, type SignalRunApi } from '@/services/signal-review/signal-run-service'

const REAL_TIMERS: Timers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

type Phase =
  | { name: 'form' }
  | { name: 'starting'; watching: boolean }
  | { name: 'running'; runId: number; run: RunSnapshot | null; stalled: 'contact' | 'slow' | null }
  | { name: 'ended'; run: RunSnapshot }

type ProductsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; list: ProductInfo[] }

export interface SignalGenerateDialogProps {
  open: boolean
  onClose: () => void
  /**
   * A run ended: finished its work, or did not. The screen refreshes whatever depends on runs. For a run that finished its work the dialog then closes
   * itself; for one that did not it stays open and says why. `null`: a run that was going has ended, but the dialog did not see how.
   */
  onFinished: (run: RunSnapshot | null) => void
  service?: SignalRunApi
  /** Where the waiting between two polls happens. Tests hand in a clock they control. */
  timers?: Timers
  /** Where focus goes when the dialog closes (the button that opened it). */
  returnFocusTo?: RefObject<HTMLElement | null>
}

/**
 * "Generate signals": choose a product, a customer model and, when the product has them, one sub-product, then start a research run and watch it from
 * here. A run uses search and AI quota, so the dialog says so before Start. The server decides whether a run may start; every refusal it can give is
 * shown beside the form in plain words. Closing the window stops watching, never the run.
 */
export function SignalGenerateDialog({ open, onClose, onFinished, service = signalRunService, timers = REAL_TIMERS, returnFocusTo }: SignalGenerateDialogProps) {
  // Every opening starts a fresh form, even if the previous one has not finished its exit animation (the content is still mounted then).
  const [session, setSession] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSession((n) => n + 1)
  }
  // While the request to start a run is in flight the window cannot be closed: the run would start with nobody watching it.
  const [locked, setLocked] = useState(false)

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !locked) onClose() }}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto"
        onCloseAutoFocus={(event) => {
          if (!returnFocusTo?.current) return
          event.preventDefault()
          returnFocusTo.current.focus()
        }}
      >
        <GenerateBody key={session} open={open} service={service} timers={timers} onClose={onClose} onFinished={onFinished} onLockChange={setLocked} />
      </DialogContent>
    </Dialog>
  )
}

function describeLoadError(cause: unknown): string {
  return cause instanceof Error && cause.message ? cause.message : 'Something went wrong.'
}

function GenerateBody({ open, service, timers, onClose, onFinished, onLockChange }: Pick<SignalGenerateDialogProps, 'onClose' | 'onFinished'> & {
  open: boolean
  service: SignalRunApi
  timers: Timers
  onLockChange: (locked: boolean) => void
}) {
  const [products, setProducts] = useState<ProductsState>({ status: 'loading' })
  const [form, setForm] = useState<GenerateForm>(EMPTY_FORM)
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [phase, setPhase] = useState<Phase>({ name: 'form' })
  const [failure, setFailure] = useState<StartFailure | null>(null)

  // Every answer that arrives later is checked against the generation it was asked in: closing the window (or leaving the page) ends the generation,
  // so a slow answer cannot change a dialog that has moved on, and no timer outlives it.
  const generation = useRef(0)
  const timer = useRef<unknown>(null)
  const working = useRef(false)
  const productRef = useRef<HTMLSelectElement>(null)
  const callbacks = useRef({ onClose, onFinished })
  useEffect(() => { callbacks.current = { onClose, onFinished } })

  const stop = useCallback(() => {
    generation.current += 1
    if (timer.current !== null) {
      timers.clear(timer.current)
      timer.current = null
    }
  }, [timers])

  useEffect(() => { if (!open) stop() }, [open, stop])
  useEffect(() => stop, [stop])

  const locked = phase.name === 'starting'
  useEffect(() => {
    onLockChange(locked)
    return () => onLockChange(false)
  }, [locked, onLockChange])

  const loadProducts = useCallback(() => {
    const mine = generation.current
    setProducts({ status: 'loading' })
    service.products().then(
      (list) => {
        if (mine !== generation.current) return
        setProducts({ status: 'ready', list })
        setForm((current) => (current.product === '' ? { ...current, product: onlyProduct(list) } : current))
      },
      (cause: unknown) => { if (mine === generation.current) setProducts({ status: 'error', message: describeLoadError(cause) }) },
    )
  }, [service])

  useEffect(() => { queueMicrotask(loadProducts) }, [loadProducts])

  /** Follow a run to its end, asking about it every POLL_MS. */
  const follow = useCallback((runId: number, first: RunSnapshot | null) => {
    const mine = generation.current
    setPhase({ name: 'running', runId, run: first, stalled: null })

    const step = (attempt: number, failures: number) => {
      timer.current = timers.set(() => {
        timer.current = null
        void (async () => {
          let run: RunSnapshot | null = null
          try {
            run = await service.get(runId)
          } catch {
            run = null
          }
          if (mine !== generation.current) return

          const next = nextPollStep({ run, failures, attempt })
          if (next.kind === 'completed') {
            callbacks.current.onFinished(next.run)
            callbacks.current.onClose()
          } else if (next.kind === 'ended') {
            setPhase({ name: 'ended', run: next.run })
            callbacks.current.onFinished(next.run)
          } else if (next.kind === 'stalled') {
            setPhase((current) => (current.name === 'running' ? { ...current, stalled: next.reason } : current))
          } else {
            if (run) setPhase((current) => (current.name === 'running' ? { ...current, run } : current))
            step(attempt + 1, next.failures)
          }
        })()
      }, POLL_MS)
    }

    step(0, 0)
  }, [service, timers])

  const change = (patch: Partial<GenerateForm>) => {
    setForm((current) => ({ ...current, ...patch }))
    setFieldError(undefined)
    setFailure(null)
  }

  const submit = async () => {
    if (products.status !== 'ready' || phase.name !== 'form' || working.current) return
    const problems = validateGenerate(form, products.list)
    setFieldError(problems.product)
    if (problems.product) {
      productRef.current?.focus()
      return
    }

    working.current = true
    setFailure(null)
    setPhase({ name: 'starting', watching: false })
    const mine = generation.current
    try {
      const started = await service.start(toRequest(form))
      if (mine !== generation.current) return
      follow(started.runId, started.run)
    } catch (cause) {
      if (mine !== generation.current) return
      setFailure(describeStartFailure(cause, failureContext(form, products.list)))
      setPhase({ name: 'form' })
    } finally {
      working.current = false
    }
  }

  /** The server said a run is already going: find it and follow that one. */
  const watchRunning = async () => {
    if (products.status !== 'ready' || working.current) return
    working.current = true
    setPhase({ name: 'starting', watching: true })
    const mine = generation.current
    try {
      const run = await service.findRunning()
      if (mine !== generation.current) return
      if (run) {
        follow(run.id, run)
      } else {
        setFailure(runGoneFailure())
        setPhase({ name: 'form' })
        callbacks.current.onFinished(null)
      }
    } catch (cause) {
      if (mine !== generation.current) return
      setFailure(describeStartFailure(cause, failureContext(form, products.list)))
      setPhase({ name: 'form' })
    } finally {
      working.current = false
    }
  }

  if (phase.name === 'running') {
    const lines = progressLines(phase.run)
    return (
      <>
        <DialogHeader>
          <DialogTitle>Research is running</DialogTitle>
          <DialogDescription>This can take a few minutes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {phase.stalled ? (
            <div role="alert" className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
              <p className="font-medium text-foreground">{phase.stalled === 'contact' ? 'Lost contact with the server' : 'This run is taking longer than expected'}</p>
              <p>
                {phase.stalled === 'contact'
                  ? 'This window could not follow the run. The run itself may still be going on the server.'
                  : 'This window stopped following the run. The run itself is still going on the server.'}{' '}
                Its result will be on the Runs tab.
              </p>
              <Button type="button" size="sm" variant="outline" onClick={() => follow(phase.runId, phase.run)}>Keep watching</Button>
            </div>
          ) : (
            <div role="status" aria-live="polite" className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">{lines.headline}</p>
                {lines.detail && <p className="text-muted-foreground">{lines.detail}</p>}
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground">You can close this window. The run keeps going on the server and shows on the Runs tab.</p>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </>
    )
  }

  if (phase.name === 'ended') {
    return (
      <>
        <DialogHeader>
          <DialogTitle>The run did not finish</DialogTitle>
          <DialogDescription>The Runs tab has the details of this run.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{failedRunText(phase.run)}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Close</Button>
            <Button type="button" onClick={() => setPhase({ name: 'form' })}>Back to the form</Button>
          </div>
        </div>
      </>
    )
  }

  const starting = phase.name === 'starting'
  const ready = products.status === 'ready' ? products.list : []
  const subs = subProductOptions(ready, form.product, form.model)
  const retryable = failure !== null && ['network', 'server', 'wait'].includes(failure.kind)

  return (
    <>
      <DialogHeader>
        <DialogTitle>Generate signals</DialogTitle>
        <DialogDescription>Research one product for new signals.</DialogDescription>
      </DialogHeader>

      {products.status === 'loading' && (
        <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading products…
        </div>
      )}

      {products.status === 'error' && (
        <div className="space-y-3">
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <p className="font-medium">The products could not be loaded</p>
            <p>{products.message}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={loadProducts}>Retry</Button>
          </div>
        </div>
      )}

      {products.status === 'ready' && (
        <FormLayout onSubmit={() => void submit()}>
          {failure && <FailurePanel failure={failure} productKey={form.product} busy={starting} onWatch={() => void watchRunning()} />}

          <Field label="Product" required error={fieldError}>
            {(control) => (
              <NativeSelect {...control} ref={productRef} value={form.product} disabled={starting} onChange={(event) => change({ product: event.target.value, offer: '' })}>
                <option value="">Choose a product…</option>
                {productOptions(ready, form.model).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </NativeSelect>
            )}
          </Field>

          {subs.length > 0 && (
            <Field label="Sub-product (optional)" hint="Leave this on “The whole product” to research all of it.">
              {(control) => (
                <NativeSelect {...control} value={form.offer} disabled={starting} onChange={(event) => change({ offer: event.target.value })}>
                  {subs.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </NativeSelect>
              )}
            </Field>
          )}

          <Field label="Customer model">
            {(control) => (
              <NativeSelect {...control} value={form.model} disabled={starting} onChange={(event) => change({ model: event.target.value as CustomerModel })}>
                {CUSTOMER_MODELS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </NativeSelect>
            )}
          </Field>

          <p className="text-sm text-muted-foreground">A run uses search and AI quota, so start one only when you need new signals.</p>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={starting} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={starting}>
              {phase.name === 'starting' ? (phase.watching ? 'Looking for the run…' : 'Starting…') : retryable ? 'Try again' : 'Start'}
            </Button>
          </div>
        </FormLayout>
      )}
    </>
  )
}

/** Why a run did not start, in the server's reasons made plain, with what to do next. */
function FailurePanel({ failure, productKey, busy, onWatch }: { failure: StartFailure; productKey: string; busy: boolean; onWatch: () => void }) {
  const calm = failure.kind === 'running' || failure.kind === 'wait'
  return (
    <div role="alert" className={calm ? 'space-y-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm' : 'space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm'}>
      <p className={calm ? 'font-medium text-foreground' : 'font-medium text-destructive'}>{failure.title}</p>
      <p>{failure.message}</p>
      {failure.missing.length > 0 && (
        <>
          <p>Still missing:</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {failure.missing.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </>
      )}
      {failure.kind === 'not_ready' && productKey !== '' && (
        <Link href={icpHref(productKey)} className="inline-block font-medium underline underline-offset-2">Open the product to complete its ICP</Link>
      )}
      {failure.canWatch && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onWatch}>Watch it</Button>}
    </div>
  )
}
