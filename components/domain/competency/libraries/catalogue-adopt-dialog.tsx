'use client'

/**
 * ADOPT FROM THE CATALOGUE — the picker that makes the adopt endpoint usable.
 *
 * ── WHY THIS SCREEN EXISTS ──────────────────────────────────────────────────
 *
 * Until this week every new organisation was force-fed the whole shared
 * catalogue at signup: on live, 98-99% of every row a new customer received.
 * That copy is gone, so a new organisation now starts genuinely empty — which
 * means the Capability Library's empty state is the FIRST thing they see, and
 * until this dialog the only thing it offered was "add your first entry", one
 * row at a time, against a catalogue of 3,347 roles and 5,640 skills.
 *
 * The server side of adopt was already built and guarded. It was unreachable
 * from the product because nothing here could turn a name into a catalogue id.
 *
 * ── THE FLOW IS PICK → PREVIEW → ADOPT, AND THE PREVIEW IS NOT CEREMONY ─────
 *
 * `preview` and `commit` run the SAME code path on the server — `written` is
 * the only difference — so the preview genuinely predicts the write. Showing it
 * before committing is what makes "5 will be created, 2 skipped" a fact rather
 * than an estimate.
 *
 * ── A NAME MATCH IS REPORTED, NEVER MERGED ──────────────────────────────────
 *
 * A row whose name the tenant already holds is flagged here and SKIPPED by the
 * server. It is deliberately still selectable: the customer is allowed to ask,
 * and the answer comes back as a counted, named skip. What must never happen is
 * silently creating a second "Staff Nurse", or silently assuming theirs is the
 * catalogue's. Whether two things sharing a name are the same thing is their
 * call, so the dialog says so in words rather than swallowing it.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Download, Loader2, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { getLaravelContext } from '@/lib/laravel-context'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import {
  catalogueAdoptService,
  type AdoptResponse,
  type CatalogueBrowseItem,
  type CatalogueKind,
} from '@/services/competency/catalogue-adopt'

const PAGE_SIZE = 50

interface CatalogueAdoptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Which catalogue to browse. Only job roles and skills can be adopted. */
  kind: CatalogueKind
  singular: string
  plural: string
  /** Called after a successful adopt so the library behind the dialog reloads. */
  onAdopted: () => void
}

/** Reads `{job_roles, skills}` for whichever kind this dialog is showing. */
function forKind(tally: { job_roles: number; skills: number } | null, kind: CatalogueKind): number {
  if (!tally) return 0
  return kind === 'role' ? tally.job_roles : tally.skills
}

export function CatalogueAdoptDialog({
  open,
  onOpenChange,
  kind,
  singular,
  plural,
  onAdopted,
}: CatalogueAdoptDialogProps) {
  const { user } = useAuth()

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [items, setItems] = useState<CatalogueBrowseItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selected, setSelected] = useState<Set<number>>(new Set())

  const [preview, setPreview] = useState<AdoptResponse['data'] | null>(null)
  const [busy, setBusy] = useState(false)
  const [committed, setCommitted] = useState<AdoptResponse['data'] | null>(null)

  /* --------------------------- search debounce --------------------------- */
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  /* ------------------------------- loading ------------------------------- */
  const load = useCallback(
    async (offset: number) => {
      const context = getLaravelContext(user)
      const setBusyFlag = offset === 0 ? setLoading : setLoadingMore
      setBusyFlag(true)
      setError(null)

      try {
        const res = await catalogueAdoptService.browse(context, kind, {
          q: search || undefined,
          limit: PAGE_SIZE,
          offset,
        })
        setTotal(res.data.total)
        setItems((prev) => (offset === 0 ? res.data.items : [...prev, ...res.data.items]))
      } catch (err) {
        setError(err instanceof Error ? err.message : `Couldn't load the ${plural.toLowerCase()} catalogue.`)
      } finally {
        setBusyFlag(false)
      }
    },
    [kind, plural, search, user],
  )

  // Reload from the top whenever the dialog opens or the search changes. The
  // preview is cleared with it: a preview computed against a previous selection
  // would be a stale promise about what adopting does.
  useEffect(() => {
    if (!open) return
    setPreview(null)
    setCommitted(null)
    void load(0)
  }, [open, load])

  // Selection does NOT survive closing the dialog. Carrying it over would mean
  // adopting rows the person can no longer see.
  useEffect(() => {
    if (!open) {
      setSelected(new Set())
      setSearchInput('')
      setSearch('')
      setItems([])
    }
  }, [open])

  /* ------------------------------ selection ------------------------------ */
  const toggle = (id: number) => {
    setPreview(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectableOnPage = useMemo(
    () => items.filter((item) => !item.already_adopted).map((item) => item.catalogue_id),
    [items],
  )

  const allSelected =
    selectableOnPage.length > 0 && selectableOnPage.every((id) => selected.has(id))

  const toggleAll = () => {
    setPreview(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) selectableOnPage.forEach((id) => next.delete(id))
      else selectableOnPage.forEach((id) => next.add(id))
      return next
    })
  }

  /* --------------------------- preview / commit --------------------------- */
  const selection = useMemo(
    () =>
      kind === 'role'
        ? { job_role_ids: Array.from(selected) }
        : { skill_ids: Array.from(selected) },
    [kind, selected],
  )

  const runPreview = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await catalogueAdoptService.preview(getLaravelContext(user), selection)
      setPreview(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed.')
    } finally {
      setBusy(false)
    }
  }

  const runCommit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await catalogueAdoptService.commit(getLaravelContext(user), selection)
      setCommitted(res.data)
      setSelected(new Set())
      onAdopted()
      // Re-browse so the rows just taken show as already adopted rather than
      // still looking available.
      void load(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adopting failed. Nothing was written.')
    } finally {
      setBusy(false)
    }
  }

  /* -------------------------------- render -------------------------------- */
  const skippedTotal = preview
    ? forKind(preview.skipped.already_adopted, kind) +
      forKind(preview.skipped.name_collision, kind) +
      forKind(preview.skipped.not_in_catalogue, kind)
    : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add {plural.toLowerCase()} from the catalogue</DialogTitle>
          <DialogDescription>
            Shared content you can take into your own library. Nothing is copied until you adopt it,
            and adopting brings only the {plural.toLowerCase()} themselves — never their mappings,
            tasks or departments.
          </DialogDescription>
        </DialogHeader>

        {/* ---- what just happened, if anything ---- */}
        {committed && (
          <div className="rounded-xl border border-success/20 bg-success/10 p-3 text-sm">
            <p className="font-semibold text-success">
              Added {forKind(committed.created, kind)} {plural.toLowerCase()} to your library.
            </p>
            <p className="mt-1 text-muted-foreground">{committed.note}</p>
          </div>
        )}

        {/* ---- search ---- */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={`Search ${total.toLocaleString()} catalogue ${plural.toLowerCase()}…`}
            className="pl-9"
          />
        </div>

        {/* ---- the list ---- */}
        <div className="max-h-[42vh] overflow-y-auto rounded-xl border border-border">
          {error ? (
            <ErrorState
              title="Couldn't load the catalogue"
              description={error}
              retry={() => void load(0)}
              className="m-4 border-0"
            />
          ) : loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3, 4].map((index) => (
                <Skeleton key={index} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              className="m-4 border-0"
              title={search ? `No catalogue ${plural.toLowerCase()} match "${search}"` : 'The catalogue is empty'}
              description={
                search
                  ? 'Try a shorter or different search term.'
                  : `There is no shared ${singular.toLowerCase()} content to adopt.`
              }
            />
          ) : (
            <>
              <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-2 backdrop-blur">
                <Checkbox
                  size="sm"
                  checked={allSelected}
                  indeterminate={!allSelected && selectableOnPage.some((id) => selected.has(id))}
                  onCheckedChange={toggleAll}
                  aria-label="Select all loaded rows"
                />
                <span className="text-xs font-semibold text-muted-foreground">
                  Showing {items.length.toLocaleString()} of {total.toLocaleString()}
                  {selected.size > 0 && ` · ${selected.size.toLocaleString()} selected`}
                </span>
              </div>

              <ul className="divide-y divide-border">
                {items.map((item) => {
                  const disabled = item.already_adopted
                  return (
                    <li
                      key={item.catalogue_id}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5',
                        disabled ? 'opacity-60' : 'hover:bg-muted/50 cursor-pointer',
                      )}
                      onClick={() => !disabled && toggle(item.catalogue_id)}
                    >
                      <Checkbox
                        size="sm"
                        disabled={disabled}
                        checked={selected.has(item.catalogue_id)}
                        onCheckedChange={() => !disabled && toggle(item.catalogue_id)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={item.name}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                        {item.category && (
                          <p className="truncate text-xs text-muted-foreground">{item.category}</p>
                        )}
                      </div>
                      {item.already_adopted && (
                        <Badge variant="muted" className="shrink-0 gap-1">
                          <Check className="h-3 w-3" /> In your library
                        </Badge>
                      )}
                      {!item.already_adopted && item.name_collision && (
                        <Badge variant="warning" className="shrink-0 gap-1">
                          <AlertTriangle className="h-3 w-3" /> Name already used
                        </Badge>
                      )}
                    </li>
                  )
                })}
              </ul>

              {items.length < total && (
                <div className="border-t border-border p-3 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingMore}
                    onClick={() => void load(items.length)}
                  >
                    {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Load {Math.min(PAGE_SIZE, total - items.length)} more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ---- the preview, which is what the write will actually do ---- */}
        {preview && (
          <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
            <p className="font-semibold text-foreground">
              {forKind(preview.would_create, kind).toLocaleString()} will be added
              {skippedTotal > 0 && `, ${skippedTotal.toLocaleString()} skipped`}
            </p>
            {skippedTotal > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {forKind(preview.skipped.already_adopted, kind) > 0 && (
                  <li>
                    <strong>{forKind(preview.skipped.already_adopted, kind)}</strong> already in your
                    library — adopting again would do nothing.
                  </li>
                )}
                {forKind(preview.skipped.name_collision, kind) > 0 && (
                  <li>
                    <strong>{forKind(preview.skipped.name_collision, kind)}</strong> share a name with
                    something you already have. They are left alone rather than merged or duplicated —
                    whether they are the same thing is your call.
                  </li>
                )}
                {forKind(preview.skipped.not_in_catalogue, kind) > 0 && (
                  <li>
                    <strong>{forKind(preview.skipped.not_in_catalogue, kind)}</strong> no longer exist
                    in the catalogue.
                  </li>
                )}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">{preview.note}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {committed ? 'Done' : 'Cancel'}
          </Button>

          {preview ? (
            <Button onClick={() => void runCommit()} disabled={busy || forKind(preview.would_create, kind) === 0}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add {forKind(preview.would_create, kind).toLocaleString()} {plural.toLowerCase()}
            </Button>
          ) : (
            <Button onClick={() => void runPreview()} disabled={busy || selected.size === 0}>
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Review {selected.size > 0 ? `${selected.size.toLocaleString()} selected` : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
