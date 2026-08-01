'use client'

import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, FolderPlus, Pencil, Plus, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

import type { LibraryTabConfig } from './library-config'
import type { UseTaxonomyState } from '@/hooks/use-competency-libraries'
import { LevelsOfResponsibility } from './levels-of-responsibility'

interface TaxonomyManagerProps {
  config: LibraryTabConfig
  taxonomy: UseTaxonomyState
  onClose: () => void
}

/**
 * Category / sub-category editor for one library tab.
 *
 * Renaming a node rewrites every row underneath it, so the count is shown next
 * to each node and the confirm text says how many records the rename will
 * touch. Deleting is only offered for an empty branch - the API refuses the
 * rest rather than orphaning entries.
 */
export function TaxonomyManager({ config, taxonomy, onClose }: TaxonomyManagerProps) {
  const { tree, loading, error, saving, actionMessage, actionError, retry, addNode, renameNode, deleteNode, clearMessages } =
    taxonomy

  const hasSubLevel = tree?.has_sub_level ?? Boolean(config.subCategoryKey)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null)
  const [newSub, setNewSub] = useState('')
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [categoryDraft, setCategoryDraft] = useState('')
  const [editingSub, setEditingSub] = useState<{ category: string; name: string } | null>(null)
  const [subDraft, setSubDraft] = useState('')

  const toggle = (category: string) =>
    setExpanded((current) => ({ ...current, [category]: !current[category] }))

  const submitCategory = async () => {
    const name = newCategory.trim()
    if (!name) return
    const result = await addNode({ category: name })
    if (result.ok) {
      setNewCategory('')
      setAddingCategory(false)
    }
  }

  const submitSub = async (category: string) => {
    const name = newSub.trim()
    if (!name) return
    const result = await addNode({ category, sub_category: name })
    if (result.ok) {
      setNewSub('')
      setAddingSubFor(null)
      setExpanded((current) => ({ ...current, [category]: true }))
    }
  }

  const submitRenameCategory = async (oldName: string) => {
    const name = categoryDraft.trim()
    if (!name || name === oldName) {
      setEditingCategory(null)
      return
    }
    const result = await renameNode({ category: name, old_category: oldName })
    if (result.ok) setEditingCategory(null)
  }

  const submitRenameSub = async (category: string, oldName: string) => {
    const name = subDraft.trim()
    if (!name || name === oldName) {
      setEditingSub(null)
      return
    }
    const result = await renameNode({
      category,
      old_category: category,
      sub_category: name,
      old_sub_category: oldName,
    })
    if (result.ok) setEditingSub(null)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-border p-6">
        <div className="space-y-1">
          <SheetTitle className="text-xl font-bold text-foreground">{config.singular} Taxonomy</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {hasSubLevel
              ? `Organise ${config.plural.toLowerCase()} into categories and sub-categories.`
              : `Organise ${config.plural.toLowerCase()} into ${config.categoryLabel.toLowerCase()} groups.`}
          </p>
        </div>
        <Button
          onClick={() => {
            clearMessages()
            setAddingCategory(true)
          }}
          className="h-9 shrink-0 rounded-lg font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <FolderPlus className="w-4 h-4" /> Add Category
        </Button>
      </div>

      {(actionMessage || actionError) && (
        <div
          className={cn(
            'mx-6 mt-4 flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-medium',
            actionError
              ? 'border-destructive/30 bg-destructive/5 text-destructive'
              : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600',
          )}
        >
          <span>{actionError || actionMessage}</span>
          <button onClick={clearMessages} className="text-xs opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto g2g-scrollbar p-6 space-y-3">
        {addingCategory && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <Input
              autoFocus
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitCategory()
                if (event.key === 'Escape') setAddingCategory(false)
              }}
              placeholder={`New ${config.categoryLabel.toLowerCase()} name`}
              className="h-9 bg-background"
            />
            <Button onClick={submitCategory} disabled={saving || !newCategory.trim()} className="h-9 px-4 font-bold">
              Add
            </Button>
            <Button variant="outline" onClick={() => setAddingCategory(false)} className="h-9 px-3">
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <ErrorState title="Couldn't load the taxonomy" description={error} retry={retry} />
        ) : (tree?.categories.length ?? 0) === 0 ? (
          <EmptyState
            title="No categories yet"
            description={`Add a ${config.categoryLabel.toLowerCase()} to start organising this library.`}
          />
        ) : (
          tree!.categories.map((node) => {
            const isOpen = expanded[node.category] ?? false
            const isEditing = editingCategory === node.category

            return (
              <div key={node.category} className="rounded-xl border border-border bg-card/60">
                <div className="flex items-center gap-2 p-3">
                  {hasSubLevel ? (
                    <button
                      type="button"
                      onClick={() => toggle(node.category)}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      aria-label={isOpen ? 'Collapse' : 'Expand'}
                    >
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}

                  {isEditing ? (
                    <>
                      <Input
                        autoFocus
                        value={categoryDraft}
                        onChange={(event) => setCategoryDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') submitRenameCategory(node.category)
                          if (event.key === 'Escape') setEditingCategory(null)
                        }}
                        className="h-9 bg-background"
                      />
                      <Button
                        onClick={() => submitRenameCategory(node.category)}
                        disabled={saving}
                        className="h-9 px-3"
                        aria-label="Save"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" onClick={() => setEditingCategory(null)} className="h-9 px-3" aria-label="Cancel">
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-foreground">{node.category}</p>
                        <p className="text-xs text-muted-foreground">
                          {node.total} {node.total === 1 ? config.singular.toLowerCase() : config.plural.toLowerCase()}
                          {hasSubLevel && node.sub_categories.length > 0
                            ? ` · ${node.sub_categories.length} sub-categories`
                            : ''}
                        </p>
                      </div>

                      {hasSubLevel && (
                        <button
                          type="button"
                          onClick={() => {
                            clearMessages()
                            setNewSub('')
                            setAddingSubFor(node.category)
                            setExpanded((current) => ({ ...current, [node.category]: true }))
                          }}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Add sub-category"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          clearMessages()
                          setCategoryDraft(node.category)
                          setEditingCategory(node.category)
                        }}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Rename"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          clearMessages()
                          deleteNode(node.category)
                        }}
                        disabled={saving}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                        title={
                          node.total > 0
                            ? 'Only an empty category can be removed'
                            : 'Remove this empty category'
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                {hasSubLevel && isOpen && (
                  <div className="space-y-1.5 border-t border-border px-3 py-3 pl-9">
                    {addingSubFor === node.category && (
                      <div className="flex items-center gap-2">
                        <Input
                          autoFocus
                          value={newSub}
                          onChange={(event) => setNewSub(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') submitSub(node.category)
                            if (event.key === 'Escape') setAddingSubFor(null)
                          }}
                          placeholder="New sub-category name"
                          className="h-8 bg-background text-sm"
                        />
                        <Button onClick={() => submitSub(node.category)} disabled={saving || !newSub.trim()} className="h-8 px-3 text-xs font-bold">
                          Add
                        </Button>
                        <Button variant="outline" onClick={() => setAddingSubFor(null)} className="h-8 px-2">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}

                    {node.sub_categories.length === 0 && addingSubFor !== node.category ? (
                      <p className="text-xs text-muted-foreground">No sub-categories yet.</p>
                    ) : (
                      node.sub_categories.map((sub) => {
                        const editing = editingSub?.category === node.category && editingSub.name === sub.name

                        return editing ? (
                          <div key={sub.name} className="flex items-center gap-2">
                            <Input
                              autoFocus
                              value={subDraft}
                              onChange={(event) => setSubDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') submitRenameSub(node.category, sub.name)
                                if (event.key === 'Escape') setEditingSub(null)
                              }}
                              className="h-8 bg-background text-sm"
                            />
                            <Button
                              onClick={() => submitRenameSub(node.category, sub.name)}
                              disabled={saving}
                              className="h-8 px-2"
                              aria-label="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="outline" onClick={() => setEditingSub(null)} className="h-8 px-2" aria-label="Cancel">
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            key={sub.name}
                            className="group flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2"
                          >
                            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{sub.name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{sub.total}</span>
                            <button
                              type="button"
                              onClick={() => {
                                clearMessages()
                                setSubDraft(sub.name)
                                setEditingSub({ category: node.category, name: sub.name })
                              }}
                              className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                              title="Rename"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                clearMessages()
                                deleteNode(node.category, sub.name)
                              }}
                              disabled={saving}
                              className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 disabled:opacity-40"
                              title={sub.total > 0 ? 'Only an empty sub-category can be removed' : 'Remove'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* The job role taxonomy is read alongside the responsibility ladder -
            a role's category says what it does, its level says how much it owns. */}
        {config.id === 'jobrole' && (
          <section className="space-y-3 border-t border-border pt-5">
            <div>
              <h4 className="text-sm font-bold text-foreground">Level of Responsibility</h4>
              <p className="text-xs text-muted-foreground">
                The responsibility ladder job levels are graded against. Maintained centrally.
              </p>
            </div>
            <LevelsOfResponsibility />
          </section>
        )}
      </div>

      <div className="border-t border-border p-4">
        <Button variant="outline" onClick={onClose} className="h-9 w-full rounded-lg font-bold">
          Done
        </Button>
      </div>
    </div>
  )
}
