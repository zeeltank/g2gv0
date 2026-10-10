'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Loader2, Plus, RotateCcw, Archive } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  PLAYBOOK_KINDS, PLAYBOOK_ROLES, playbookService,
  type GtmPlaybook, type PlaybookVersion,
} from '@/services/gtm/gtm'
import { GtmPageHeader, errMsg, fmtDate, useGtmReady } from './gtm-shared'

const SELECT = 'h-9 rounded-md border border-input bg-background px-2 text-sm'
const TEXTAREA = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
const label = (s: string) => s.replace(/_/g, ' ')

/**
 * Playbooks. Platform defaults are read-only; "Customise" copies one into the organisation,
 * and every edit of that copy is a new version that can be restored. The agents that follow
 * a playbook read exactly what is saved here.
 */
export function PlaybooksView() {
  const ready = useGtmReady()
  const [kind, setKind] = useState('')
  const [role, setRole] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [items, setItems] = useState<GtmPlaybook[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems((await playbookService.list({ kind, role, status: showArchived ? 'archived' : '' })).data.items)
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load playbooks'))
    }
  }, [kind, role, showArchived])

  useEffect(() => { if (ready) queueMicrotask(() => void load()) }, [ready, load])

  return (
    <div className="p-6">
      <GtmPageHeader
        title="Playbooks"
        description="How your GTM agents work: role playbooks, qualification methodologies, templates and workflows. Platform defaults are read-only; customise one to make it yours."
        actions={<Button onClick={() => setCreating(true)}><Plus className="mr-1 size-4" />New playbook</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className={SELECT} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">All types</option>
          {PLAYBOOK_KINDS.map((k) => <option key={k} value={k}>{label(k)}</option>)}
        </select>
        <select className={SELECT} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          {PLAYBOOK_ROLES.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
        </select>
        <label className="flex items-center gap-1 text-sm text-muted-foreground">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />Archived only
        </label>
      </div>

      {error ? <ErrorState title="Could not load playbooks" description={error} retry={load} /> : !items ? <Skeleton className="h-40" /> : items.length === 0 ? (
        <EmptyState title="No playbooks" description="Nothing matches these filters." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((p) => (
            <button key={p.id} onClick={() => setOpenId(p.id)} className="rounded-lg border border-border bg-card p-4 text-left hover:bg-muted/30">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant="outline">{label(p.kind)}</Badge>
                <Badge variant="outline">{p.role.toUpperCase()}</Badge>
                {p.stage && <Badge variant="outline">{p.stage}</Badge>}
                {p.source === 'platform' ? <Badge variant="outline">platform default</Badge> : <Badge>{p.overrides_default ? 'your version' : 'yours'} · v{p.version}</Badge>}
                {p.status !== 'active' && <Badge variant="outline">{p.status}</Badge>}
              </div>
              <div className="font-medium">{p.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
            </button>
          ))}
        </div>
      )}

      <NewPlaybookDialog open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); void load(); setOpenId(id) }} />
      <PlaybookDialog key={openId ?? 'none'} id={openId} onClose={() => setOpenId(null)} onChanged={load} onOpen={setOpenId} />
    </div>
  )
}

function NewPlaybookDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const [f, setF] = useState({ kind: 'role_playbook', role: 'all', slug: '', title: '', body: '', definition: '' })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      let definition: Record<string, unknown> | null = null
      if (f.definition.trim()) {
        try { definition = JSON.parse(f.definition) } catch { throw new Error('Definition must be valid JSON.') }
      }
      const res = await playbookService.create({
        kind: f.kind as GtmPlaybook['kind'], role: f.role as GtmPlaybook['role'], slug: f.slug.trim(), title: f.title.trim(), body: f.body, definition,
      })
      setF({ kind: 'role_playbook', role: 'all', slug: '', title: '', body: '', definition: '' })
      onCreated(res.data.playbook.id)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New playbook</DialogTitle><DialogDescription>Written instructions an agent follows. A methodology also needs scoring dimensions.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <select className={SELECT} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{PLAYBOOK_KINDS.map((k) => <option key={k} value={k}>{label(k)}</option>)}</select>
            <select className={SELECT} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{PLAYBOOK_ROLES.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}</select>
          </div>
          <Input placeholder="Title *" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Input placeholder="Slug * (lowercase-with-dashes)" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} />
          <textarea className={TEXTAREA} rows={6} placeholder="Instructions *" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          <textarea className={`${TEXTAREA} font-mono text-xs`} rows={4} placeholder='Definition (JSON, optional) e.g. {"dimensions":[{"key":"need","label":"Need","weight":1}, ...]}' value={f.definition} onChange={(e) => setF({ ...f, definition: e.target.value })} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={saving || !f.title.trim() || !f.slug.trim() || f.body.trim().length < 20} onClick={save}>{saving ? 'Saving…' : 'Create'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PlaybookDialog({ id, onClose, onChanged, onOpen }: { id: number | null; onClose: () => void; onChanged: () => void; onOpen: (id: number) => void }) {
  const [pb, setPb] = useState<GtmPlaybook | null>(null)
  const [versions, setVersions] = useState<PlaybookVersion[]>([])
  const [edit, setEdit] = useState<{ title: string; description: string; body: string; note: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (id === null) return
    try {
      const res = (await playbookService.get(id)).data
      setPb(res.playbook)
      setVersions(res.versions)
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load the playbook'))
    }
  }, [id])
  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      after?.()
      await load()
      onChanged()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const dims = (pb?.definition as { dimensions?: { key: string; label: string; weight: number; looks_for?: string }[] } | null)?.dimensions

  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pb?.title ?? 'Playbook'}</DialogTitle>
          <DialogDescription>{pb ? `${label(pb.kind)} · ${pb.role.toUpperCase()}${pb.stage ? ` · ${pb.stage}` : ''} · ${pb.source === 'platform' ? 'platform default' : `your organisation · v${pb.version}`}` : 'Loading…'}</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!pb ? (error ? null : <Skeleton className="h-40" />) : (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {!pb.editable && (
                <Button size="sm" disabled={busy} onClick={() => run(async () => { const r = await playbookService.customise(pb.id); onOpen(r.data.playbook.id) })}>
                  {busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Copy className="mr-1 size-3.5" />}Customise for my organisation
                </Button>
              )}
              {pb.editable && !edit && <Button size="sm" variant="outline" onClick={() => setEdit({ title: pb.title, description: pb.description ?? '', body: pb.body ?? '', note: '' })}>Edit</Button>}
              {pb.editable && pb.status !== 'archived' && (
                <Button size="sm" variant="outline" className="text-destructive" disabled={busy}
                  onClick={() => { if (window.confirm('Archive this playbook? Agents will stop using it.')) void run(() => playbookService.archive(pb.id), onClose) }}>
                  <Archive className="mr-1 size-3.5" />Archive
                </Button>
              )}
              {pb.editable && pb.status === 'archived' && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => playbookService.update(pb.id, { status: 'active' }))}>Reactivate</Button>}
            </div>

            {edit ? (
              <div className="space-y-2">
                <Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                <Input placeholder="Description" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
                <textarea className={TEXTAREA} rows={9} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
                <Input placeholder="What changed? (kept in version history)" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy || !edit.title.trim() || edit.body.trim().length < 20}
                    onClick={() => run(() => playbookService.update(pb.id, { title: edit.title.trim(), description: edit.description || null, body: edit.body, change_note: edit.note || undefined }), () => setEdit(null))}>Save as new version</Button>
                  <Button size="sm" variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                {pb.description && <p className="text-sm text-muted-foreground">{pb.description}</p>}
                <section><h3 className="mb-1 text-sm font-semibold">Instructions</h3><p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{pb.body}</p></section>
              </>
            )}

            {dims && dims.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-semibold">Scoring dimensions</h3>
                <ul className="space-y-1 text-sm">
                  {dims.map((d) => <li key={d.key} className="flex gap-3 border-b border-border py-1"><span className="w-40 shrink-0 font-medium">{d.label} <span className="text-xs text-muted-foreground">×{d.weight}</span></span><span className="text-muted-foreground">{d.looks_for}</span></li>)}
                </ul>
              </section>
            )}
            {pb.inputs && pb.inputs.length > 0 && <p className="text-xs text-muted-foreground">Reads: {pb.inputs.map(label).join(', ')}</p>}

            <section>
              <h3 className="mb-1 text-sm font-semibold">Version history</h3>
              <ul className="space-y-1 text-sm">
                {versions.map((v) => (
                  <li key={v.version} className="flex items-center gap-3 border-b border-border py-1">
                    <Badge variant="outline">v{v.version}</Badge><span className="flex-1">{v.change_note ?? v.title}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(v.created_at, true)}</span>
                    {pb.editable && v.version !== pb.version && (
                      <button className="text-muted-foreground hover:text-foreground" title={`Restore v${v.version}`} disabled={busy}
                        onClick={() => { if (window.confirm(`Restore v${v.version} as a new version?`)) void run(() => playbookService.restore(pb.id, v.version)) }}><RotateCcw className="size-4" /></button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
