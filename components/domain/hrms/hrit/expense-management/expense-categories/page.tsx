'use client'

import * as React from 'react'
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/ui/status-badge'
import { Switch } from '@/components/ui/switch'
import { GtgPageHeader } from '@/components/shell/gtg-page-header'
import { getLaravelContext } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import { expenseService, type ExpenseCategory, type ExpenseCategoryInput } from '@/services/hrms/expenses'
import { formatMoney } from '../shared'

type FormState = {
  name: string
  code: string
  max_amount: string
  description: string
  requires_receipt: boolean
  active: boolean
}

const EMPTY: FormState = { name: '', code: '', max_amount: '', description: '', requires_receipt: false, active: true }

/**
 * Expense Categories - what an employee can claim, with an optional limit per
 * expense and whether a bill reference is mandatory. HR / admin only to change;
 * the server enforces that, whatever this screen shows.
 */
export default function ExpenseCategoriesPage() {
  const context = React.useMemo(() => getLaravelContext(), [])

  const [categories, setCategories] = React.useState<ExpenseCategory[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const [editing, setEditing] = React.useState<ExpenseCategory | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(EMPTY)
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState('')

  const [deleting, setDeleting] = React.useState<ExpenseCategory | null>(null)
  const [deleteBusy, setDeleteBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await expenseService.categories(context)
      setCategories(response?.data ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load categories.')
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [context])

  React.useEffect(() => {
    void load()
  }, [load])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((p) => ({ ...p, [key]: value }))

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setFormError('')
    setDialogOpen(true)
  }

  function openEdit(category: ExpenseCategory) {
    setEditing(category)
    setForm({
      name: category.name,
      code: category.code ?? '',
      max_amount: category.max_amount != null ? String(category.max_amount) : '',
      description: category.description ?? '',
      requires_receipt: category.requires_receipt,
      active: Number(category.status) === 1,
    })
    setFormError('')
    setDialogOpen(true)
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setFormError('')
    if (!form.name.trim()) return setFormError('Give the category a name.')
    if (form.max_amount !== '' && !(Number(form.max_amount) >= 0)) return setFormError('The limit must be zero or more.')

    const payload: ExpenseCategoryInput = {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      description: form.description.trim() || undefined,
      max_amount: form.max_amount === '' ? null : Number(form.max_amount),
      requires_receipt: form.requires_receipt,
      status: form.active ? 1 : 0,
    }

    setSaving(true)
    try {
      const response = editing
        ? await expenseService.updateCategory(context, editing.id, payload)
        : await expenseService.createCategory(context, payload)
      setDialogOpen(false)
      await load()
      setNotice(response?.message || 'Saved.')
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not save the category.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      const response = await expenseService.deleteCategory(context, deleting.id)
      setDeleting(null)
      await load()
      setNotice(response?.message || 'Category deleted.')
    } catch (cause) {
      setDeleting(null)
      setNotice(cause instanceof Error ? cause.message : 'Could not delete the category.')
    } finally {
      setDeleteBusy(false)
    }
  }

  const columns: Column<ExpenseCategory>[] = [
    {
      id: 'name',
      header: 'Category',
      render: (_, row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{row.name}</span>
          {(row.code || row.description) && (
            <span className="text-xs text-muted-foreground">{[row.code, row.description].filter(Boolean).join(' · ')}</span>
          )}
        </div>
      ),
    },
    {
      id: 'max_amount',
      header: 'Limit per expense',
      render: (_, row) => (
        <span className="text-sm">{row.max_amount != null ? formatMoney(row.max_amount) : 'No limit'}</span>
      ),
    },
    {
      id: 'requires_receipt',
      header: 'Bill reference',
      render: (_, row) => <span className="text-sm">{row.requires_receipt ? 'Required' : 'Optional'}</span>,
    },
    {
      id: 'item_count',
      header: 'Used on',
      render: (_, row) => <span className="text-sm">{row.item_count ?? 0} line{(row.item_count ?? 0) === 1 ? '' : 's'}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      render: (_, row) => {
        const active = Number(row.status) === 1
        return <StatusBadge status={active ? 'Active' : 'Inactive'} variant={active ? 'active' : 'inactive'} />
      },
    },
    {
      id: 'id',
      header: 'Action',
      render: (_, row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)} aria-label={`Edit ${row.name}`} className="cursor-pointer">
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleting(row)}
            aria-label={`Delete ${row.name}`}
            className="cursor-pointer text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500 ease-out">
      <GtgPageHeader
        title="Expense Categories"
        description="The kinds of expense people can claim, with an optional limit per expense and whether a bill reference is required."
        actions={
          <Button onClick={openCreate} className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" /> Add Category
          </Button>
        }
      />

      {notice && <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</div>}

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

      <Card className="rounded-2xl border-border/50 bg-card/50 shadow-xs">
        <div className="flex justify-end border-b border-border/40 p-3">
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading} className="cursor-pointer">
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={categories}
            isLoading={loading}
            getRowId={(row) => String(row.id)}
            emptyState={
              error ? null : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <p>No categories yet. Add the kinds of expense people can claim, e.g. Travel, Meals, Accommodation.</p>
                  <Button size="sm" className="mt-3" onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Add the first category
                  </Button>
                </div>
              )
            }
            className="overflow-visible rounded-none border-0 [&_th]:bg-transparent [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_td]:py-4"
          />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Category' : 'Add Category'}</DialogTitle>
            <DialogDescription>Employees pick a category for each line of an expense claim.</DialogDescription>
          </DialogHeader>

          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Travel" maxLength={100} required />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="e.g. TRV" maxLength={20} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Limit per expense (₹)</Label>
              <Input type="number" min={0} step="0.01" value={form.max_amount} onChange={(e) => set('max_amount', e.target.value)} placeholder="Leave empty for no limit" />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional" maxLength={1000} />
            </div>

            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <Switch checked={form.requires_receipt} onChange={(e) => set('requires_receipt', e.target.checked)} />
              <span>
                Bill / receipt reference required
                <span className="block text-xs text-muted-foreground">A claim with this category cannot be submitted without one.</span>
              </span>
            </label>

            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <Switch checked={form.active} onChange={(e) => set('active', e.target.checked)} />
              <span>
                Active
                <span className="block text-xs text-muted-foreground">Inactive categories are hidden from new claims; existing claims keep them.</span>
              </span>
            </label>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Category'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && !deleteBusy && setDeleting(null)}
        title={`Delete "${deleting?.name ?? ''}"?`}
        description={
          deleting && (deleting.item_count ?? 0) > 0
            ? `This category is used on ${deleting.item_count} expense line${deleting.item_count === 1 ? '' : 's'}, so it cannot be deleted. Set it to Inactive instead.`
            : 'This removes the category. It cannot be undone.'
        }
        confirmLabel="Delete"
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
