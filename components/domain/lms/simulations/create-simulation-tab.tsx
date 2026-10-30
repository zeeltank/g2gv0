'use client'

import { AlertTriangle, Check, CheckCircle2, Clock, Download, Eye, Loader2, RotateCcw, Save, Send, Upload } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useRuntimeCheck } from '@/hooks/use-runtime-check'
import { useAssetUploads, useSimulationLimits, type UseSimulationsReturn } from '@/hooks/use-simulations'
import { PACKAGE_LIMITS, formatBytes, readPackage, type PackageProblem, type ReadPackage } from '@/lib/simulation-package'
import {
  ATTESTATION_TEXT,
  describeUse,
  planUploads,
  saveTarget,
  type AssetEdit,
  type ExistingSimulation,
  type StepStatus,
  type UploadPlan,
} from '@/lib/simulation-package-plan'
import { combineIssues, fillAssetHashes, hashAssets, type FillResult } from '@/lib/simulation-package-spec'
import { cn } from '@/lib/utils'
import type { SimulationCard } from '@/services/lms/simulations'

import { minutesLabel, readSpec } from './simulation-format'

/** The sample package a customer starts from (g2gv0/public/sim-samples). */
export const SAMPLE_PACKAGE_URL = '/sim-samples/pendulum-lab.zip'
/** The second sample: a physics simulation (bodies, a ramp, a goal), for people who want to start from the physics engine. */
export const SAMPLE_PHYSICS_URL = '/sim-samples/ramp-lab.zip'

type Stage =
  | { kind: 'empty' }
  | { kind: 'reading'; name: string; note: string }
  | { kind: 'refused'; name: string; problems: PackageProblem[] }
  | { kind: 'ready'; name: string; pkg: ReadPackage; hashes: Record<string, string>; fill: FillResult }

/** What the runtime said about the filled-in specification (its lines are merged with ours when shown). */
type CheckState = { kind: 'idle' } | { kind: 'checking' } | { kind: 'done'; ok: boolean; unavailable: boolean; runtime: string[] }

type Saving = 'idle' | 'uploading' | 'saving'

const refusal = (name: string, message: string): Stage => ({ kind: 'refused', name, problems: [{ code: 'not-a-zip', message }] })

/** One numbered step of the panel. */
function Step({ number, title, done, children }: { number: number; title: string; done: boolean; children: React.ReactNode }) {
  const headingId = useId()
  return (
    <li>
      <section aria-labelledby={headingId} className="rounded-xl border border-border bg-card p-4">
        <h3 id={headingId} className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
          <span
            className={cn('grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold', done ? 'bg-success text-white' : 'bg-primary/10 text-primary')}
            aria-hidden="true"
          >
            {done ? <Check className="size-3.5" /> : number}
          </span>
          <span>
            <span className="sr-only">Step {number}: </span>
            {title}
            {done && <span className="sr-only"> (done)</span>}
          </span>
        </h3>
        <div className="mt-3 space-y-3 text-sm">{children}</div>
      </section>
    </li>
  )
}

const code = 'rounded bg-muted px-1 py-0.5 font-mono text-[11px]'

function statusLine(status: StepStatus | undefined): { icon: React.ReactNode; text: string; tone: 'muted' | 'ok' | 'bad' } {
  switch (status?.state) {
    case 'uploading':
      return { icon: <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />, text: 'Uploading…', tone: 'muted' }
    case 'slow':
      return { icon: <Clock className="size-3.5" aria-hidden="true" />, text: `The server asked for a short pause; trying again in about ${status.seconds} seconds…`, tone: 'muted' }
    case 'done':
      return { icon: <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />, text: status.created ? 'Uploaded' : 'Already stored', tone: 'ok' }
    case 'failed':
      return { icon: <AlertTriangle className="size-3.5 text-destructive" aria-hidden="true" />, text: status.message, tone: 'bad' }
    default:
      return { icon: <Clock className="size-3.5" aria-hidden="true" />, text: 'Waiting', tone: 'muted' }
  }
}

/**
 * Create a simulation from a package: download the sample, edit it, choose it here, see it checked, save it as a draft, preview it and publish it.
 * Everything about the zip happens in this browser (lib/simulation-package.ts); the server is sent each model and image one by one, then the
 * specification. A customer needs no developer for any of it.
 */
export function CreateTab({
  existing,
  create,
  update,
  setStatus,
  onAdded,
  onDone,
  onPreview,
}: {
  existing: readonly ExistingSimulation[]
  create: UseSimulationsReturn['create']
  update: UseSimulationsReturn['update']
  setStatus: UseSimulationsReturn['setStatus']
  onAdded: (message: string) => void
  onDone: () => void
  onPreview: (card: SimulationCard) => void
}) {
  const fileId = useId()
  const attestId = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const previewButton = useRef<HTMLButtonElement>(null)
  const readToken = useRef(0)
  const busyNow = useRef(false)

  const { run: runCheck, abandon: abandonCheck } = useRuntimeCheck(150)
  const { limits } = useSimulationLimits()
  const uploads = useAssetUploads()

  const [sample, setSample] = useState<'checking' | 'ready' | 'missing'>('checking')
  const [dragging, setDragging] = useState(false)
  const [stage, setStage] = useState<Stage>({ kind: 'empty' })
  const [edits, setEdits] = useState<Record<string, AssetEdit>>({})
  const [attested, setAttested] = useState(false)
  const [check, setCheck] = useState<CheckState>({ kind: 'idle' })
  const [saving, setSaving] = useState<Saving>('idle')
  const [failure, setFailure] = useState<{ message: string; problems: string[] } | null>(null)
  const [saved, setSaved] = useState<{ card: SimulationCard; newVersion: boolean } | null>(null)
  const [publishing, setPublishing] = useState(false)

  // Is the sample on this site? (A missing file is said politely, instead of sending the customer to a "not found" page.)
  useEffect(() => {
    let live = true
    fetch(SAMPLE_PACKAGE_URL, { method: 'HEAD', cache: 'no-store' })
      .then((response) => {
        const type = response.headers.get('Content-Type') ?? ''
        if (live) setSample(response.ok && !/text\/html/i.test(type) ? 'ready' : 'missing')
      })
      // the network being down says nothing about the file: leave the link
      .catch(() => live && setSample('ready'))
    return () => {
      live = false
    }
  }, [])

  // After a save, the next thing to do is Preview: put the keyboard there.
  useEffect(() => {
    if (saved) previewButton.current?.focus()
  }, [saved])

  // Leaving the screen ends any package still being read: its later steps see a newer token and stop.
  useEffect(() => {
    const token = readToken
    return () => {
      token.current += 1
    }
  }, [])

  const ready = stage.kind === 'ready' ? stage : null
  const specId = ready ? ready.pkg.spec.id : undefined
  const target = useMemo(() => saveTarget(specId, existing), [specId, existing])
  const plan = useMemo(
    () =>
      ready
        ? planUploads({ assets: ready.pkg.assets, usedIds: ready.fill.usedIds, hashes: ready.hashes, edits, attested, serverUploadBytes: limits.serverUploadBytes })
        : null,
    [ready, edits, attested, limits.serverUploadBytes],
  )
  const issues = useMemo(() => {
    if (!ready) return []
    const list = combineIssues(ready.fill.problems, check.kind === 'done' ? check.runtime : [])
    // A verdict of "no" with nothing said still has to show up as something to read, or the screen would refuse to save without a reason.
    if (list.length === 0 && check.kind === 'done' && !check.ok && !check.unavailable) {
      list.push({ path: null, message: 'The simulation player cannot play this, but it did not say why. Compare your files with the sample package.' })
    }
    return list
  }, [ready, check])

  const checked = check.kind === 'done'
  const specAccepted = ready !== null && checked && ready.fill.problems.length === 0 && (check.ok || check.unavailable)

  const blockers: string[] = []
  if (ready && plan && !saved) {
    if (issues.length > 0 || (checked && !check.ok && !check.unavailable)) blockers.push('Fix the problems listed in step 3, then choose the package again.')
    else if (!checked) blockers.push('Wait for the check in step 3 to finish.')
    blockers.push(...plan.blockers)
    if (target.kind === 'refused') blockers.push(target.message)
  }
  const canSave = ready !== null && plan !== null && specAccepted && blockers.length === 0 && saving === 'idle' && !saved

  const reset = () => {
    readToken.current += 1
    abandonCheck()
    uploads.reset()
    setStage({ kind: 'empty' })
    setEdits({})
    setAttested(false)
    setCheck({ kind: 'idle' })
    setSaving('idle')
    setFailure(null)
    setSaved(null)
  }

  const openPackage = async (file: File | undefined | null, count = 1) => {
    if (!file) return
    reset()
    const token = readToken.current
    if (count !== 1) return setStage(refusal(`${count} files`, 'Choose one .zip file: your whole package in a single zip.'))
    if (!/\.zip$/i.test(file.name)) {
      return setStage(refusal(file.name, `“${file.name}” is not a .zip file. Zip the files of your package (manifest.json, simulation.json and the assets folder) and choose that.`))
    }
    if (file.size > PACKAGE_LIMITS.packageBytes) {
      return setStage(refusal(file.name, `“${file.name}” is ${formatBytes(file.size)}; a simulation package may be at most ${formatBytes(PACKAGE_LIMITS.packageBytes)}.`))
    }

    setStage({ kind: 'reading', name: file.name, note: 'Opening the package…' })
    let bytes: Uint8Array
    try {
      bytes = new Uint8Array(await file.arrayBuffer())
    } catch {
      if (token === readToken.current) setStage(refusal(file.name, `“${file.name}” could not be read. Choose it again.`))
      return
    }
    if (token !== readToken.current) return
    const result = await readPackage(bytes)
    if (token !== readToken.current) return
    if (!result.ok) return setStage({ kind: 'refused', name: file.name, problems: result.problems })

    const pkg = result.package
    let hashes: Record<string, string>
    try {
      hashes = await hashAssets(pkg.assets, (done, total) => {
        if (token === readToken.current) setStage({ kind: 'reading', name: file.name, note: `Fingerprinting file ${done} of ${total}…` })
      })
    } catch (error) {
      if (token === readToken.current) setStage(refusal(file.name, error instanceof Error ? error.message : 'The files could not be fingerprinted.'))
      return
    }
    if (token !== readToken.current) return

    const fill = fillAssetHashes(pkg.spec, pkg.assets, hashes)
    setEdits(Object.fromEntries(pkg.assets.map((asset) => [asset.id, { licence: asset.licence, credit: asset.credit, source: asset.source }])))
    setStage({ kind: 'ready', name: file.name, pkg, hashes, fill })
    setCheck({ kind: 'checking' })
    runCheck(fill.spec, (verdict) => setCheck({ kind: 'done', ok: verdict.ok, unavailable: verdict.unavailable === true, runtime: verdict.issues }))
  }

  const edit = (id: string, field: keyof AssetEdit, value: string) => setEdits((current) => ({ ...current, [id]: { ...current[id], [field]: value } }))

  const save = async () => {
    // `busyNow` closes the gap between a click and the re-render that disables the button: a second quick click must not save a second draft.
    if (!canSave || !ready || !plan || busyNow.current) return
    busyNow.current = true
    try {
      await saveNow(ready, plan)
    } finally {
      busyNow.current = false
    }
  }

  const saveNow = async (ready: Extract<Stage, { kind: 'ready' }>, plan: UploadPlan) => {
    setFailure(null)
    setSaving('uploading')
    const uploaded = await uploads.run(plan.steps)
    if (!uploaded.ok) {
      setSaving('idle')
      if (uploaded.finished) {
        setFailure({
          message: `${uploaded.failed === 1 ? 'One file' : `${uploaded.failed} files`} could not be uploaded, so nothing has been saved yet. Fix what is said below, then press the button again; files that went through are not sent twice.`,
          problems: [],
        })
      }
      return
    }
    setSaving('saving')
    const outcome =
      target.kind === 'new-version'
        ? await update(target.id, { spec: ready.fill.spec, note: 'Saved from a package' })
        : await create({ spec: ready.fill.spec, status: 'draft' })
    setSaving('idle')
    if (outcome.ok) {
      setSaved({ card: outcome.card, newVersion: target.kind === 'new-version' })
      onAdded(target.kind === 'new-version' ? `Saved a new version of “${outcome.card.title}”.` : `Saved “${outcome.card.title}” as a draft.`)
    } else {
      setFailure({ message: outcome.message, problems: outcome.problems })
    }
  }

  const publish = async () => {
    if (!saved || busyNow.current) return
    busyNow.current = true
    setPublishing(true)
    setFailure(null)
    const outcome = await setStatus(saved.card.id, 'published').finally(() => {
      busyNow.current = false
    })
    setPublishing(false)
    if (outcome.ok) {
      onAdded(`“${saved.card.title}” is now visible to learners.`)
      onDone()
    } else {
      setFailure({ message: outcome.message, problems: outcome.problems })
    }
  }

  const facts = ready ? readSpec(ready.fill.spec) : null
  const use = limits.fromServer ? describeUse(limits, plan) : null
  const busy = saving !== 'idle' || publishing || stage.kind === 'reading'
  const doneUploads = plan ? plan.steps.filter((step) => uploads.statuses[step.id]?.state === 'done').length : 0

  return (
    <div className="space-y-5">
      <ol className="space-y-4">
        {/* ------------------------------------------------------------------ 1 */}
        <Step number={1} title="Download the sample package" done={false}>
          <p className="text-muted-foreground">
            Start from a simulation that already works. The sample is a zip file with a pendulum simulation, its settings, and a folder for your own 3D models and pictures.
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-foreground">
            <li>
              Open <code className={code}>simulation.json</code> in any text editor (Notepad is fine) and change the <code className={code}>id</code>, the <code className={code}>title</code> and the words learners read.
            </li>
            <li>
              To use your own 3D model or picture, put the file in the <code className={code}>assets</code> folder and change its entry in <code className={code}>manifest.json</code> (file name, licence, credit). Then zip the files again.
            </li>
          </ol>
          {sample === 'missing' ? (
            <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-foreground" role="status">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              The sample package is not on this site yet, so it cannot be downloaded from here. Please ask the person who looks after this site to add it. If you already have a package, go on to step 2.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="w-fit">
                <a href={SAMPLE_PACKAGE_URL} download>
                  <Download aria-hidden="true" /> Pendulum Lab (equations, .zip)
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-fit">
                <a href={SAMPLE_PHYSICS_URL} download>
                  <Download aria-hidden="true" /> Ramp Lab (physics, .zip)
                </a>
              </Button>
            </div>
          )}
        </Step>

        {/* ------------------------------------------------------------------ 2 */}
        <Step number={2} title="Choose your package" done={ready !== null}>
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              if (!busy) void openPackage(event.dataTransfer.files?.[0], event.dataTransfer.files?.length ?? 0)
            }}
            className={cn('flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors', dragging ? 'border-primary bg-primary/5' : 'border-border')}
          >
            <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-foreground">
              Drop your <span className="font-medium">.zip</span> package here, or
            </p>
            <input
              ref={fileInput}
              id={fileId}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="sr-only"
              tabIndex={-1}
              aria-label="Choose your package (.zip)"
              onChange={(event) => {
                void openPackage(event.target.files?.[0], event.target.files?.length ?? 0)
                event.target.value = ''
              }}
            />
            <Button variant="outline" size="sm" disabled={busy} onClick={() => fileInput.current?.click()}>
              {ready ? 'Choose a different package' : 'Choose a package'}
            </Button>
          </div>

          <div aria-live="polite">
            {stage.kind === 'reading' && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {stage.note}
              </p>
            )}
            {ready && (
              <p className="flex items-start gap-2 font-medium text-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                <span>
                  Read “{ready.name}”: {ready.pkg.assets.length === 0 ? 'no models or images' : `${ready.pkg.assets.length} ${ready.pkg.assets.length === 1 ? 'file' : 'files'} (${formatBytes(ready.pkg.assets.reduce((sum, asset) => sum + asset.size, 0))})`}.
                  {ready.pkg.ignored.length > 0 && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {ready.pkg.ignored.length} hidden system {ready.pkg.ignored.length === 1 ? 'file' : 'files'} that Mac or Windows added to the zip {ready.pkg.ignored.length === 1 ? 'was' : 'were'} skipped.
                    </span>
                  )}
                </span>
              </p>
            )}
          </div>

          {stage.kind === 'refused' && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm" role="alert">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                {stage.problems.length === 1 ? 'This package cannot be used.' : `This package cannot be used (${stage.problems.length} problems).`}
              </p>
              <ul className="mt-2 max-h-48 list-disc space-y-1.5 overflow-y-auto pl-6 text-xs text-foreground">
                {stage.problems.map((problem, index) => (
                  <li key={index}>{problem.message}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Nothing was uploaded. Fix the files, zip them again and choose the package once more.</p>
            </div>
          )}

          {ready && ready.pkg.assets.length > 0 && (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                  <caption className="sr-only">Models and images in the package. Licence and credit are required; source is optional.</caption>
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      {['File', 'Id', 'Kind', 'Size'].map((heading) => (
                        <th key={heading} scope="col" className="px-2 py-2 font-medium">
                          {heading}
                        </th>
                      ))}
                      <th scope="col" className="px-2 py-2 font-medium">
                        Licence <span aria-hidden="true">*</span>
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Credit <span aria-hidden="true">*</span>
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        Source
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ready.pkg.assets.map((asset) => {
                      const unused = ready.fill.unusedIds.includes(asset.id)
                      const value = edits[asset.id] ?? { licence: asset.licence, credit: asset.credit, source: asset.source }
                      return (
                        <tr key={asset.id} className="border-t border-border align-top">
                          <td className="max-w-[9rem] px-2 py-2">
                            <span className="block truncate font-mono text-[11px] text-foreground" title={asset.file}>
                              {asset.file}
                            </span>
                            {unused && <span className="block text-[11px] text-muted-foreground">Not used by the simulation, so not uploaded</span>}
                          </td>
                          <td className="px-2 py-2 font-mono text-[11px]">{asset.id}</td>
                          <td className="whitespace-nowrap px-2 py-2">{asset.kind === 'image' ? 'Image' : asset.kind === 'hdr' ? 'HDR sky' : '3D model'}</td>
                          <td className="whitespace-nowrap px-2 py-2 tabular-nums">{formatBytes(asset.size)}</td>
                          <td className="px-2 py-1.5">
                            <Input
                              size="sm"
                              className="min-w-[7rem]"
                              aria-label={`Licence for ${asset.file}`}
                              aria-required="true"
                              value={value.licence}
                              maxLength={PACKAGE_LIMITS.licenceChars}
                              placeholder="e.g. CC0"
                              onChange={(event) => edit(asset.id, 'licence', event.target.value)}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              size="sm"
                              className="min-w-[9rem]"
                              aria-label={`Credit for ${asset.file}`}
                              aria-required="true"
                              value={value.credit}
                              maxLength={PACKAGE_LIMITS.creditChars}
                              placeholder="Who made it"
                              onChange={(event) => edit(asset.id, 'credit', event.target.value)}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              size="sm"
                              className="min-w-[9rem]"
                              aria-label={`Source of ${asset.file} (a web address, optional)`}
                              inputMode="url"
                              value={value.source}
                              maxLength={PACKAGE_LIMITS.sourceChars}
                              placeholder="https://…"
                              onChange={(event) => edit(asset.id, 'source', event.target.value)}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <label htmlFor={attestId} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-4 py-3">
                <Checkbox id={attestId} className="mt-0.5" checked={attested} onCheckedChange={setAttested} aria-required="true" />
                <span>
                  <span className="block text-sm font-medium text-foreground">{ATTESTATION_TEXT}</span>
                  <span className="block text-xs text-muted-foreground">Required. The licence and credit above are kept with each file and shown to learners.</span>
                </span>
              </label>
            </div>
          )}
          {plan && plan.notes.length > 0 && <p className="text-xs text-muted-foreground">{plan.notes.join(' ')}</p>}
        </Step>

        {/* ------------------------------------------------------------------ 3 */}
        <Step number={3} title="Check it" done={specAccepted}>
          <div aria-live="polite" className="space-y-3">
            {!ready && <p className="text-muted-foreground">Once you have chosen your package, it is checked here with the same simulation player that will run it.</p>}
            {ready && check.kind === 'checking' && issues.length === 0 && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking it with the simulation player…
              </p>
            )}
            {ready && issues.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5" role="alert">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                  {issues.length === 1 ? '1 thing to fix before this can be saved' : `${issues.length} things to fix before this can be saved`}
                </p>
                <ul className="mt-2 max-h-52 list-disc space-y-1.5 overflow-y-auto pl-6 text-xs text-foreground">
                  {issues.map((issue, index) => (
                    <li key={index}>
                      {issue.path && <code className={cn(code, 'mr-1.5')}>{issue.path}</code>}
                      {issue.message}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">Fix them in your files, zip again and choose the package once more.</p>
              </div>
            )}
            {ready && checked && check.unavailable && issues.length === 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                The simulation player did not answer, so the full check could not run. You can still save a draft; the server checks the basics, and the player explains any problem when you preview it.
              </p>
            )}
            {ready && checked && !check.unavailable && check.ok && issues.length === 0 && (
              <p className="flex items-center gap-2 font-medium text-foreground">
                <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" /> The simulation is valid. The player accepts it.
              </p>
            )}
            {ready && facts && (specAccepted || issues.length === 0) && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <p className="text-sm font-semibold text-foreground">{facts.title ?? 'Untitled simulation'}</p>
                {(facts.subtitle ?? facts.summary) && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{facts.subtitle ?? facts.summary}</p>}
                {minutesLabel(facts.minutes) && <p className="mt-1 text-xs text-muted-foreground">{minutesLabel(facts.minutes)}</p>}
              </div>
            )}
          </div>
        </Step>

        {/* ------------------------------------------------------------------ 4 */}
        <Step number={4} title="Save as a draft, preview it, publish it" done={saved !== null}>
          {use?.use && <p className="text-xs text-muted-foreground">{use.use}</p>}
          {use?.warning && <p className="text-xs text-warning">{use.warning}</p>}
          <p className="text-muted-foreground">
            Saving uploads each model and image, then keeps the simulation as a <span className="font-medium text-foreground">draft</span>: only people who manage simulations can see it, so you can try it before learners do.
          </p>
          {target.kind === 'new-version' && !saved && (
            <p className="text-xs text-foreground">
              You already have a draft called “{target.title}” with this id. Saving adds a new version to it; the earlier version stays in its history.
            </p>
          )}

          {!saved && ready && blockers.length > 0 && (
            <div aria-live="polite" className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Before you can save:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {blockers.map((blocker, index) => (
                  <li key={index}>{blocker}</li>
                ))}
              </ul>
            </div>
          )}

          {!saved && (
            <Button onClick={() => void save()} disabled={!canSave} className="w-fit gap-2">
              {saving === 'idle' ? <Save aria-hidden="true" /> : <Loader2 className="animate-spin" aria-hidden="true" />}
              {saving === 'uploading' ? 'Uploading files…' : saving === 'saving' ? 'Saving the draft…' : target.kind === 'new-version' ? 'Save as a new version of the draft' : 'Save as a draft'}
            </Button>
          )}

          {plan && plan.steps.length > 0 && (saving !== 'idle' || Object.keys(uploads.statuses).length > 0) && (
            <div className="space-y-2" aria-live="polite">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {doneUploads} of {plan.steps.length} {plan.steps.length === 1 ? 'file' : 'files'} uploaded
                </span>
                <span className="tabular-nums">{Math.round((100 * doneUploads) / plan.steps.length)}%</span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Files uploaded"
                aria-valuemin={0}
                aria-valuemax={plan.steps.length}
                aria-valuenow={doneUploads}
              >
                <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${(100 * doneUploads) / plan.steps.length}%` }} />
              </div>
              <ul className="divide-y divide-border rounded-lg border border-border text-xs">
                {plan.steps.map((step) => {
                  const line = statusLine(uploads.statuses[step.id])
                  return (
                    <li key={step.id} className="flex items-start gap-2 px-3 py-2">
                      <span className="mt-0.5">{line.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[11px] text-foreground" title={step.file}>
                          {step.file}
                        </span>
                        <span className={cn('block', line.tone === 'bad' ? 'text-destructive' : 'text-muted-foreground')}>{line.text}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{formatBytes(step.size)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {failure && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5" role="alert">
              <p className="flex items-start gap-2 font-medium text-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" /> <span className="min-w-0">{failure.message}</span>
              </p>
              {failure.problems.length > 0 && (
                <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-6 text-xs text-foreground">
                  {failure.problems.map((problem, index) => (
                    <li key={index}>{problem}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {saved && (
            <div className="space-y-3 rounded-lg border border-success/30 bg-success/5 px-3 py-3" role="status">
              <p className="flex items-start gap-2 font-medium text-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                <span>
                  {saved.newVersion ? 'Saved a new version of' : 'Saved'} “{saved.card.title}” as a draft. Learners cannot see it yet.
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button ref={previewButton} onClick={() => onPreview(saved.card)} disabled={publishing} className="gap-2">
                  <Eye aria-hidden="true" /> Preview
                </Button>
                <Button variant="outline" onClick={() => void publish()} disabled={publishing} className="gap-2">
                  {publishing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />} {publishing ? 'Publishing…' : 'Publish to learners'}
                </Button>
                <Button variant="ghost" onClick={reset} disabled={publishing} className="gap-2">
                  <RotateCcw aria-hidden="true" /> Create another
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Preview opens the simulation as a learner would see it. Publishing makes it visible to learners straight away.</p>
            </div>
          )}
        </Step>
      </ol>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="outline" onClick={onDone} disabled={busy}>
          Close
        </Button>
      </div>
    </div>
  )
}
