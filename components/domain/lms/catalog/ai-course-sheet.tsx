'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Plus,
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
import { MultiSelect } from '@/domain/lms/shared/multi-select'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { useAiCourse } from '@/hooks/use-ai-course'
import type { AiOutline } from '@/services/lms'
import type { CatalogFilterOptions } from '@/services/lms'

/**
 * What the author tells the generator.
 *
 * ── EVERY ONE OF THESE USED TO BE A TEXT BOX ────────────────────────────────
 *
 * industry, department, job role and proficiency were free text, and "target
 * skills" was a comma-separated string with no relationship to the job role
 * above it. So the model was fed whatever somebody typed — "Healthcare",
 * "healthcare", "Health care" — and the resulting course could not be traced
 * to a department, a role, or a competency in the system.
 *
 * All of it is real, related data: 43 industries, the tenant's departments, 266
 * job roles each carrying a department, and a competency graph underneath them.
 */
interface FormState {
  course_title: string
  industry: string
  /** hrms_departments.id values — a course can serve several. */
  department_ids: string[]
  /** s_user_jobrole.id values, narrowed by the departments above. */
  jobrole_ids: string[]
  critical_work_function: string
  /** One task per row, entered as rows rather than free text. */
  tasks: string[]
  /**
   * How the course is scoped.
   *
   * Only 9 of tenant 6's 266 job roles have competencies mapped, so offering
   * competencies alone would leave the field empty for almost every role. KASBA
   * is the fallback the data actually supports.
   */
  scope_mode: 'competency' | 'kasba'
  competency_ids: string[]
  kasba_item_ids: string[]
  proficiency: string
  slide_count: string
}

const PROFICIENCY_LEVELS = [
  { value: '', label: 'Not specified' },
  { value: 'Awareness', label: 'Awareness — aware of it, not yet able' },
  { value: 'Basic', label: 'Basic — has the foundations' },
  { value: 'Intermediate', label: 'Intermediate — dependable on routine work' },
  { value: 'Advanced', label: 'Advanced — solid working command' },
  { value: 'Expert', label: 'Expert — near-complete mastery' },
]

const EMPTY_FORM: FormState = {
  course_title: '',
  industry: '',
  department_ids: [],
  jobrole_ids: [],
  critical_work_function: '',
  tasks: [''],
  scope_mode: 'competency',
  competency_ids: [],
  kasba_item_ids: [],
  proficiency: '',
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

  const providersReady = ai.providers?.deepseek_configured ?? false
  const gammaReady = ai.providers?.gamma_configured ?? false

  /*
   * The pickers are built from the SCOPE endpoint, not from the catalogue's
   * filter options.
   *
   * `filterOptions.jobroles` is DISTINCT sub_std_map.jobrole - free text
   * somebody once typed into a course form, 45 strings against the tenant's 266
   * real roles, and carrying no department. It cannot narrow roles by
   * department and cannot reach a competency, which is the whole point here.
   */
  const industryOptions = ai.scope?.industries ?? []

  const departmentOptions = useMemo(
    () =>
      (ai.scope?.departments ?? []).map((department) => ({
        value: String(department.id),
        label: department.department,
      })),
    [ai.scope],
  )

  /** Roles in the chosen departments; all of them when none is chosen yet. */
  const jobroleOptions = useMemo(() => {
    const roles = ai.scope?.jobroles ?? []
    const chosen = new Set(form.department_ids)

    return roles
      .filter((role) => chosen.size === 0 || chosen.has(String(role.department_id ?? '')))
      .map((role) => ({
        value: String(role.id),
        label: role.jobrole,
        // Searchable by department too, which is how people look for a role
        // they know the team but not the exact title of.
        hint: role.department ?? role.industries ?? null,
      }))
  }, [ai.scope, form.department_ids])

  const competencyOptions = useMemo(
    () =>
      (ai.scope?.competencies ?? []).map((competency) => ({
        value: String(competency.id),
        label: competency.name,
        hint: competency.code,
      })),
    [ai.scope],
  )

  const kasbaOptions = useMemo(
    () =>
      (ai.scope?.kasba_items ?? []).map((item) => ({
        value: String(item.id),
        label: item.item_label,
        // The type is what distinguishes two similarly-worded items, so it is
        // the hint rather than a prefix on the label.
        hint: item.kasba_type,
      })),
    [ai.scope],
  )

  /*
   * Competencies and KASBA items belong to the CHOSEN ROLES, so the lists are
   * refetched whenever those change rather than being filtered client-side
   * from something already loaded - there is nothing already loaded to filter.
   */
  const jobroleKey = form.jobrole_ids.join(',')

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => ai.loadScopeFor(form.jobrole_ids.map(Number).filter(Boolean)))
    // `ai` is recreated each render; the roles are what actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobroleKey])

  /** A course has to be FOR somebody: department and role are required. */
  const canGenerate =
    form.department_ids.length > 0 && form.jobrole_ids.length > 0 && !ai.busy && providersReady


  const handleGenerateOutline = () =>
    void ai.generateOutline({
      course_title: form.course_title || undefined,
      industry: form.industry || undefined,
      department_ids: form.department_ids.map(Number).filter(Boolean),
      jobrole_ids: form.jobrole_ids.map(Number).filter(Boolean),
      critical_work_function: form.critical_work_function || undefined,
      // Blank rows are dropped here rather than sent: an empty task became a
      // slide the model was asked to write about nothing.
      tasks: form.tasks.map((task) => task.trim()).filter(Boolean),
      scope_mode: form.scope_mode,
      competency_ids:
        form.scope_mode === 'competency' ? form.competency_ids.map(Number).filter(Boolean) : [],
      kasba_item_ids:
        form.scope_mode === 'kasba' ? form.kasba_item_ids.map(Number).filter(Boolean) : [],
      proficiency: form.proficiency || undefined,
      slide_count: Number(form.slide_count) || 10,
    })

  /*
   * sub_std_map.jobrole is a single free-text column, so a course for three
   * roles can only name one there. The full set goes to the settings row; this
   * keeps the legacy column meaningful rather than blank.
   */
  const firstJobroleName =
    (ai.scope?.jobroles ?? []).find((role) => String(role.id) === form.jobrole_ids[0])?.jobrole ??
    null

  const handlePublish = async () => {
    if (!ai.outline || !publishDepartment) return
    const result = await ai.publish({
      display_name: ai.outline.title,
      standard_id: Number(publishDepartment),
      subject_category: form.industry || 'AI Generated',
      /*
       * 'E-learning Module' was hardcoded here AND defaulted server-side, which
       * is where the invalid course type came from. It now carries the real
       * scope so the published course is findable by the people it is for.
       */
      subject_type: 'Self-paced course',
      jobrole: firstJobroleName,
      department_ids: form.department_ids.map(Number).filter(Boolean),
      jobrole_ids: form.jobrole_ids.map(Number).filter(Boolean),
      competency_ids: form.competency_ids.map(Number).filter(Boolean),
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
              {/*
                * REQUIRED FIELDS ARE MARKED, AND ENFORCED.
                *
                * The generator previously accepted an entirely blank form and
                * produced a generic deck about nothing in particular. A course
                * has to be FOR somebody: a department and a job role are what
                * make it scoped, and what let the published course be found by
                * the people it was written for.
                */}
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
                  {/* Was a text box. These are the industries this tenant's own
                      job roles are actually in. */}
                  <Select
                    id="ai-industry"
                    value={form.industry}
                    onChange={(value) => setField('industry', value)}
                    options={[
                      { label: 'Not specified', value: '' },
                      ...industryOptions.map((industry) => ({ label: industry, value: industry })),
                    ]}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Departments <span className="text-destructive">*</span>
                  </Label>
                  <MultiSelect
                    aria-label="Departments this course is for"
                    options={departmentOptions}
                    values={form.department_ids}
                    onChange={(values) => {
                      setField('department_ids', values)
                      /*
                       * Job roles belong to departments, so narrowing the
                       * departments must drop any role that is no longer
                       * reachable - otherwise the form silently carries a role
                       * the author can no longer see.
                       */
                      const allowed = new Set(
                        (ai.scope?.jobroles ?? [])
                          .filter((role) =>
                            values.length === 0 ||
                            values.includes(String(role.department_id ?? '')),
                          )
                          .map((role) => String(role.id)),
                      )
                      setField(
                        'jobrole_ids',
                        form.jobrole_ids.filter((id) => allowed.has(id)),
                      )
                    }}
                    placeholder="Select departments"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>
                  Job roles <span className="text-destructive">*</span>
                </Label>
                <MultiSelect
                  aria-label="Job roles this course is for"
                  options={jobroleOptions}
                  values={form.jobrole_ids}
                  onChange={(values) => setField('jobrole_ids', values)}
                  placeholder={
                    form.department_ids.length === 0
                      ? 'Select departments first, or search all roles'
                      : 'Select job roles'
                  }
                  searchPlaceholder="Search job roles\u2026"
                />
                <p className="text-xs text-muted-foreground">
                  {form.department_ids.length > 0
                    ? `${jobroleOptions.length} role(s) in the selected departments.`
                    : `All ${jobroleOptions.length} roles. Choose departments above to narrow this.`}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
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
                  <Label htmlFor="ai-proficiency">Target proficiency</Label>
                  {/* Was free text, so "Intermediate", "intermediate" and "mid"
                      all reached the model as different things. These are the
                      same five bands the competency module rates against. */}
                  <Select
                    id="ai-proficiency"
                    value={form.proficiency}
                    onChange={(value) => setField('proficiency', value)}
                    options={PROFICIENCY_LEVELS}
                  />
                </div>
              </div>

              {/*
                * Key tasks as ROWS.
                *
                * This was a textarea split on newlines, which looks the same
                * and is not: there was no way to see how many tasks you had, no
                * way to remove one, and a stray blank line became an empty task
                * the model was asked to write a slide about.
                */}
              <div className="flex flex-col gap-1.5">
                <Label>Key tasks</Label>
                {form.tasks.map((task, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={task}
                      onChange={(event) =>
                        setField(
                          'tasks',
                          form.tasks.map((t, i) => (i === index ? event.target.value : t)),
                        )
                      }
                      placeholder={`Task ${index + 1}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove task ${index + 1}`}
                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      disabled={form.tasks.length === 1}
                      onClick={() =>
                        setField('tasks', form.tasks.filter((_, i) => i !== index))
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit gap-1.5"
                  onClick={() => setField('tasks', [...form.tasks, ''])}
                >
                  <Plus className="size-3.5" /> Task
                </Button>
              </div>

              {/*
                * WHAT THE COURSE DEVELOPS.
                *
                * "Target skills" was a comma-separated text box with no
                * connection to the job roles above it, so nothing the author
                * typed could be checked, reused, or mapped to the course after
                * publication.
                *
                * Two modes, because the data supports two: a role's whole
                * competencies where they are mapped, and the individual
                * knowledge / skill / behaviour / attitude / ability items
                * underneath them where they are not. Only 9 of 266 roles have
                * competencies, so the second is not a fallback — it is the
                * common case.
                */}
              <div className="flex flex-col gap-2 rounded-lg border border-border/60 p-3">
                <Label>What should this course develop?</Label>

                <div className="flex flex-wrap items-center gap-2">
                  {(['competency', 'kasba'] as const).map((mode) => (
                    <Button
                      key={mode}
                      type="button"
                      variant={form.scope_mode === mode ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setField('scope_mode', mode)}
                    >
                      {mode === 'competency' ? 'Whole competencies' : 'Individual K/S/B/A items'}
                    </Button>
                  ))}
                </div>

                {form.jobrole_ids.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Choose one or more job roles above and their competencies appear here.
                  </p>
                ) : ai.scopeLoading ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Loading what these roles need…
                  </p>
                ) : form.scope_mode === 'competency' ? (
                  competencyOptions.length === 0 ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      These roles have no competencies mapped yet. Switch to{' '}
                      <button
                        type="button"
                        className="font-semibold underline"
                        onClick={() => setField('scope_mode', 'kasba')}
                      >
                        individual K/S/B/A items
                      </button>
                      , or map competencies to the role first.
                    </p>
                  ) : (
                    <MultiSelect
                      aria-label="Competencies this course develops"
                      options={competencyOptions}
                      values={form.competency_ids}
                      onChange={(values) => setField('competency_ids', values)}
                      placeholder="Select competencies"
                    />
                  )
                ) : kasbaOptions.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    These roles have no knowledge, skill, behaviour, attitude or ability items
                    recorded yet.
                  </p>
                ) : (
                  <MultiSelect
                    aria-label="Knowledge, skill, behaviour, attitude and ability items"
                    options={kasbaOptions}
                    values={form.kasba_item_ids}
                    onChange={(values) => setField('kasba_item_ids', values)}
                    placeholder="Select items"
                  />
                )}
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
                {/*
                  * "Modality" is gone.
                  *
                  * It was two checkboxes labelled with a word the people using
                  * this form do not use, it changed nothing the model could act
                  * on, and its only visible effect was a slide in the generated
                  * deck headed "Modality Instructions".
                  */}
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
            <span className="flex items-center gap-3">
              {/*
                * Say WHY it is disabled, at the point it is disabled.
                *
                * The generator used to accept an entirely blank form and
                * produce a generic deck about nothing. A course has to be for
                * somebody; the button now waits for that and says so, rather
                * than being greyed out for a reason the author has to guess.
                */}
              {!canGenerate && providersReady && (
                <span className="text-xs text-muted-foreground">
                  {form.department_ids.length === 0
                    ? 'Choose at least one department'
                    : 'Choose at least one job role'}
                </span>
              )}
              <Button onClick={handleGenerateOutline} disabled={!canGenerate} className="gap-2">
                {ai.busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Generate outline
              </Button>
            </span>
          )}

          {ai.step === 'outline' && (
            <Button
              onClick={() =>
                void ai.generatePresentation({
                  course_type: firstJobroleName || 'ai-generated',
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
