'use client'

import { useEffect, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { gtmService, importService, type GtmAccount, type ImportPreview, type ImportResult } from '@/services/gtm/gtm'
import { errMsg } from './gtm-shared'

const SELECT = 'h-9 rounded-md border border-input bg-background px-2 text-sm'
const FIELD_LABEL: Record<string, string> = {
  full_name: 'Name *', email: 'Email', title: 'Job title', phone: 'Phone', linkedin_url: 'LinkedIn URL',
  role_in_deal: 'Buying role', company: 'Company', domain: 'Company website / domain', notes: 'Notes',
}

/**
 * Import contacts from a CSV. Three stages, and nothing is written until the last: choose the
 * file -> map columns and check it (a dry run that runs the same validation as the import) ->
 * import. Duplicates by email are skipped, never overwritten.
 */
export function ImportContactsDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mapping, setMapping] = useState<Record<string, number | null>>({})
  const [accounts, setAccounts] = useState<GtmAccount[]>([])
  const [defaultAccount, setDefaultAccount] = useState('')
  const [createMissing, setCreateMissing] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    void gtmService.listAccounts({}).then((r) => setAccounts(r.data.items)).catch(() => setAccounts([]))
  }, [open])

  const reset = () => { setCsv(''); setFileName(''); setPreview(null); setMapping({}); setResult(null); setError(null); setDefaultAccount(''); setCreateMissing(false) }
  const close = () => { reset(); onClose() }

  const choose = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setResult(null)
    setBusy(true)
    try {
      const text = await file.text()
      setCsv(text)
      setFileName(file.name)
      const p = (await importService.preview(text)).data
      setPreview(p)
      setMapping(p.suggested_mapping)
    } catch (e) {
      setPreview(null)
      setError(errMsg(e, 'Could not read that file'))
    } finally {
      setBusy(false)
    }
  }

  const args = (dry: boolean) => ({
    csv, mapping, dry_run: dry, create_missing_accounts: createMissing,
    default_account_id: defaultAccount ? Number(defaultAccount) : null,
  })

  const check = async () => {
    setBusy(true)
    setError(null)
    try { setResult((await importService.run(args(true))).data) } catch (e) { setError(errMsg(e)); setResult(null) } finally { setBusy(false) }
  }

  const commit = async () => {
    if (!window.confirm(`Import ${result?.summary.valid ?? 0} contact(s)? Rows that failed the check are skipped.`)) return
    setBusy(true)
    setError(null)
    try {
      const r = (await importService.run(args(false))).data
      setResult(r)
      onDone()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const problems = result?.rows.filter((r) => r.status !== 'ok' || r.warnings.length > 0) ?? []

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Import contacts from CSV</DialogTitle><DialogDescription>Check the file first; nothing is saved until you choose Import.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border p-3 text-sm">
            <Upload className="size-4" /><span>{fileName || 'Choose a .csv file'}</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void choose(e.target.files?.[0])} />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}

          {preview && (
            <>
              <p className="text-sm text-muted-foreground">{preview.row_count} data row(s). Tell G2G which column holds what:</p>
              <div className="grid gap-2 md:grid-cols-3">
                {preview.fields.map((f) => (
                  <label key={f} className="text-xs text-muted-foreground">{FIELD_LABEL[f] ?? f}
                    <select className={`${SELECT} mt-1 w-full text-foreground`} value={mapping[f] ?? ''} onChange={(e) => { setResult(null); setMapping({ ...mapping, [f]: e.target.value === '' ? null : Number(e.target.value) }) }}>
                      <option value="">— not in file —</option>
                      {preview.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="text-xs text-muted-foreground">Put every contact in this account (optional)
                  <select className={`${SELECT} mt-1 block text-foreground`} value={defaultAccount} onChange={(e) => { setResult(null); setDefaultAccount(e.target.value) }}>
                    <option value="">Match by company / domain column</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
                {!defaultAccount && <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={createMissing} onChange={(e) => { setResult(null); setCreateMissing(e.target.checked) }} />Create accounts that don&apos;t exist yet</label>}
                <Button className="ml-auto" size="sm" disabled={busy || mapping.full_name == null} onClick={check}>{busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}Check file</Button>
              </div>
            </>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge>{result.summary.valid} ready</Badge>
                <Badge variant="outline">{result.summary.duplicate} duplicate (skipped)</Badge>
                <Badge variant="outline">{result.summary.invalid} invalid (skipped)</Badge>
                {result.accounts_to_create.length > 0 && !result.committed && <span className="text-xs text-muted-foreground">Will create: {result.accounts_to_create.join(', ')}</span>}
              </div>
              {result.committed ? (
                <p className="rounded bg-green-50 p-2 text-sm text-green-900">Imported {result.summary.imported} contact(s){result.summary.accounts_created ? ` and created ${result.summary.accounts_created} account(s)` : ''}.</p>
              ) : (
                <Button size="sm" disabled={busy || result.summary.valid === 0} onClick={commit}>{busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}Import {result.summary.valid} contact(s)</Button>
              )}
              {problems.length > 0 && (
                <div className="max-h-56 overflow-y-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-left text-muted-foreground"><tr><th className="p-2">Row</th><th className="p-2">Contact</th><th className="p-2">Result</th></tr></thead>
                    <tbody>{problems.map((r) => (
                      <tr key={r.line} className="border-t border-border"><td className="p-2">{r.line}</td><td className="p-2">{r.name || '—'}{r.email ? ` · ${r.email}` : ''}</td>
                        <td className="p-2">{r.errors.map((x) => <div key={x} className="text-destructive">{x}</div>)}{r.warnings.map((x) => <div key={x} className="text-amber-700">{x}</div>)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
