'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { useAiCourse } from '@/hooks/use-ai-course'
import type { AiOutline } from '@/services/lms'
import type { CatalogFilterOptions } from '@/services/lms'

interface FormState {
  course_title: string
  industry: string
  department: string
  job_role: string
  critical_work_function: string
  tasks: string
  skills: string
  proficiency: string
  selfPaced: boolean
  instructorLed: boolean
  slide_count: string
}

const EMPTY_FORM: FormState = {
  course_title: '',
  industry: '',
  department: '',
  job_role: '',
  critical_work_function: '',
  tasks: '',
  skills: '',
  proficiency: '',
  selfPaced: true,
  instructorLed: false,
  slide_count: '10',
}

function Banner({
  tone,
  children,
  onDismiss,
}: {
  tone: 'success' | 'error' | 'info'
  children: React.ReactNode
  onDismiss?: () => void
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-xs font-medium',
        tone === 'success' && 'border-success/30 bg-success/10 text-success',
        tone === 'error' && 'border-destructive/30 bg-destructive/10 text-destructive',
        tone === 'info' && 'border-primary/30 bg-primary/10 text-primary',
      )}
    >
      <span className="flex items-start gap-2">
        {tone === 'error' ? (
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        ) : tone === 'success' ? (
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
        ) : (
          <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" />
        )}
        <span>{children}</span>
      </span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss">
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}

/** Editable slide card - the outline is reviewable before it goes to Gamma. */
function SlideEditor({
  outline,
  onChange,
}: {
  outline: AiOutline
  onChange: (outline: AiOutline) => void
}) {
  const updateSlide = (index: number, patch: Partial<AiOutline['slides'][number]>) => {
    const slides = outline.slides.map((slide, i) => (i === index ? { ...slide, ...patch } : slide))
    onChange({ ...outline, slides })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ai-outline-title">Course title</Label>
        <Input
          id="ai-outline-title"
          value={outline.title}
          onChange={(event) => onChange({ ...outline, title: event.target.value })}
        />
      </div>

      {outline.summary && (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Summary
          </p>
          <p className="mt-1 text-xs text-foreground">{outline.summary}</p>
        </div>
      )}

      {outline.learning_objectives.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Learning objectives
          </p>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-xs text-foreground">
            {outline.learning_objectives.map((objective, index) => (
              <li key={index}>{objective}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {outline.slides.map((slide, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-lg border border-border/60 p-3">
            <div className="flex items-center gap-2">
              <StatusBadge variant="processing" size="sm" className="shrink-0 text-[10px] font-bold">
                {slide.slide_number}
              </StatusBadge>
              <Input
                value={slide.title}
                onChange={(event) => updateSlide(index, { title: event.target.value })}
                className="h-8 text-sm font-semibold"
                aria-label={`Slide ${slide.slide_number} title`}
              />
            </div>
            <Textarea
              value={slide.bullets.join('\n')}
              onChange={(event) =>
                updateSlide(index, {
                  bullets: event.target.value.split('\n').filter((line) => line.trim() !== ''),
                })
              }
              rows={Math.max(slide.bullets.length, 3)}
              className="text-xs"
              aria-label={`Slide ${slide.slide_number} bullet points`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Build with AI.
 *
 * Restores the previous frontend's AiCourseDialog, which had no equivalent
 * here. Outline generation runs on DeepSeek and the deck is rendered by Gamma -
 * both server-side, so no provider key reaches the browser.
 */
export function AiCourseSheet({
  open,
  onOpenChange,
  filterOptions,
  onPublished,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  filterOptions: CatalogFilterOptions | null
  onPublished: () => void
}) {
  const ai = useAiCourse(open)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [publishDepartment, setPublishDepartment] = useState('')

  useEffect(() => {
    if (open) return
    queueMicrotask(() => {
      setForm(EMPTY_FORM)
      setPublishDepartment('')
      ai.reset()
    })
    // `ai` is recreated each render; resetting on close only needs `open`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const departmentOptions = useMemo(
    () =>
      (filterOptions?.departments ?? []).map((department) => ({
        value: String(department.id),
        label: department.department,
      })),
    [filterOptions],
  )

  const providersReady = ai.providers?.deepseek_configured ?? false
  const gammaReady = ai.providers?.gamma_configured ?? false

  const handleGenerateOutline = () =>
    void ai.generateOutline({
      course_title: form.course_title || undefined,
      industry: form.industry || undefined,
      department: form.department || undefined,
      job_role: form.job_role || undefined,
      critical_work_function: form.critical_work_function || undefined,
      tasks: form.tasks
        .split('\n')
        .map((task) => task.trim())
        .filter(Boolean),
      skills: form.skills
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean),
      proficiency: form.proficiency || undefined,
      modality: { selfPaced: form.selfPaced, instructorLed: form.instructorLed },
      slide_count: Number(form.slide_count) || 10,
    })

  const handlePublish = async () => {
    if (!ai.outline || !publishDepartment) return
    const result = await ai.publish({
      display_name: ai.outline.title,
      standard_id: Number(publishDepartment),
      subject_category: form.industry || 'AI Generated',
      subject_type: 'E-learning Module',
      jobrole: form.job_role || null,
      status: 1,
    })
    if (result.ok) {
      onPublished()
      onOpenChange(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border/60 p-6 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> Build with AI
          </SheetTitle>
          <SheetDescription>
            {ai.providersLoading
              ? 'Checking providers…'
              : providersReady
                ? `Outline by ${ai.providers?.deepseek_model}, slides rendered by Gamma.`
                : 'AI course generation is not configured yet.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          {!ai.providersLoading && !providersReady && (
            <Banner tone="error">
              DeepSeek is not configured. Add <code>DEEPSEEK_API_KEY</code> to the Laravel
              environment to enable outline generation.
            </Banner>
          )}
          {!ai.providersLoading && providersReady && !gammaReady && (
            <Banner tone="error">
              Gamma is not configured, so outlines can be generated but not rendered into slides.
              Add a key for this institute, or set <code>GAMMA_API_KEY</code>.
            </Banner>
          )}
          {ai.error && (
            <Banner tone="error" onDismiss={ai.dismiss}>
              {ai.error}
            </Banner>
          )}
          {ai.message && !ai.error && (
            <Banner tone={ai.step === 'rendering' ? 'info' : 'success'} onDismiss={ai.dismiss}>
              {ai.message}
            </Banner>
          )}

          {ai.step === 'idle' && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ai-title">Course title</Label>
                <Input
                  id="ai-title"
                  value={form.course_title}
                  onChange={(event) => setField('course_title', event.target.value)}
                  placeholder="Leave blank to let the model choose"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai-industry">Industry</Label>
                  <Input
                    id="ai-industry"
                    value={form.industry}
                    onChange={(event) => setField('industry', event.target.value)}
                    placeholder="e.g. Healthcare"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai-department">Department</Label>
                  <Input
                    id="ai-department"
                    list="ai-department-options"
                    value={form.department}
                    onChange={(event) => setField('department', event.target.value)}
                    placeholder="e.g. Nursing"
                  />
                  <datalist id="ai-department-options">
                    {(filterOptions?.departments ?? []).map((department) => (
                      <option key={department.id} value={department.department} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai-jobrole">Job role</Label>
                  <Input
                    id="ai-jobrole"
                    list="ai-jobrole-options"
                    value={form.job_role}
                    onChange={(event) => setField('job_role', event.target.value)}
                    placeholder="e.g. Enrolled Nurse"
                  />
                  <datalist id="ai-jobrole-options">
                    {(filterOptions?.jobroles ?? []).map((jobrole) => (
                      <option key={jobrole} value={jobrole} />
                    ))}
                  </datalist>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai-proficiency">Proficiency</Label>
                  <Input
                    id="ai-proficiency"
                    value={form.proficiency}
                    onChange={(event) => setField('proficiency', event.target.value)}
                    placeholder="e.g. Intermediate"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ai-cwf">Critical work function</Label>
                <Input
                  id="ai-cwf"
                  value={form.critical_work_function}
                  onChange={(event) => setField('critical_work_function', event.target.value)}
                  placeholder="Optional"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ai-tasks">Key tasks</Label>
                <Textarea
                  id="ai-tasks"
                  value={form.tasks}
                  onChange={(event) => setField('tasks', event.target.value)}
                  rows={3}
                  placeholder="One task per line"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ai-skills">Target skills</Label>
                <Input
                  id="ai-skills"
                  value={form.skills}
                  onChange={(event) => setField('skills', event.target.value)}
                  placeholder="Comma separated"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai-slides">Slides</Label>
                  <Input
                    id="ai-slides"
                    type="number"
                    min={3}
                    max={40}
                    value={form.slide_count}
                    onChange={(event) => setField('slide_count', event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Modality</Label>
                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={form.selfPaced}
                        onChange={(event) => setField('selfPaced', event.target.checked)}
                      />
                      Self-paced
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={form.instructorLed}
                        onChange={(event) => setField('instructorLed', event.target.checked)}
                      />
                      Instructor-led
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}

          {ai.outline && ai.step !== 'idle' && (
            <>
              {ai.step === 'outline' && (
                <p className="text-xs text-muted-foreground">
                  Review and edit the outline below, then render it into slides.
                </p>
              )}
              <SlideEditor outline={ai.outline} onChange={ai.updateOutline} />
            </>
          )}

          {ai.step === 'ready' && (
            <div className="flex flex-col gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
              <p className="text-sm font-semibold text-foreground">Presentation ready</p>
              <div className="flex flex-wrap gap-2">
                {ai.gammaUrl && (
                  <a href={ai.gammaUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink className="size-3.5" /> Open in Gamma
                    </Button>
                  </a>
                )}
                {ai.exportUrl && (
                  <a href={ai.exportUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="size-3.5" /> Download PDF
                    </Button>
                  </a>
                )}
              </div>

              <div className="flex flex-col gap-1.5 pt-2">
                <Label htmlFor="ai-publish-department">
                  Publish to department <span className="text-destructive">*</span>
                </Label>
                <Select
                  id="ai-publish-department"
                  value={publishDepartment}
                  onChange={(value) => setPublishDepartment(String(value))}
                  options={departmentOptions}
                  placeholder="Select a department..."
                />
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-border/60 p-6">
          {ai.step !== 'idle' && ai.step !== 'rendering' && (
            <Button variant="ghost" onClick={ai.reset} disabled={ai.busy} className="gap-2 mr-auto">
              <ArrowLeft className="size-4" /> Start over
            </Button>
          )}

          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={ai.busy}>
            Close
          </Button>

          {ai.step === 'idle' && (
            <Button
              onClick={handleGenerateOutline}
              disabled={ai.busy || !providersReady}
              className="gap-2"
            >
              {ai.busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Generate outline
            </Button>
          )}

          {ai.step === 'outline' && (
            <Button
              onClick={() =>
                void ai.generatePresentation({
                  course_type: form.job_role || 'ai-generated',
                  input_fields: { ...form },
                })
              }
              disabled={ai.busy || !gammaReady}
              className="gap-2"
            >
              {ai.busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Build presentation
            </Button>
          )}

          {ai.step === 'rendering' && (
            <Button disabled className="gap-2">
              <Loader2 className="size-4 animate-spin" /> Rendering…
            </Button>
          )}

          {ai.step === 'ready' && (
            <Button onClick={() => void handlePublish()} disabled={ai.busy || !publishDepartment}>
              Publish to catalog
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
