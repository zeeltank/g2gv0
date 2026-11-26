'use client'

import { useId, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { SearchInput } from '@/components/ui/search-input'
import { Skeleton } from '@/components/ui/skeleton'
import { CHIP_BASE, chipClass } from '@/lib/workflows/tones'
import type { WorkflowRecipe } from '@/services/gtm/workflows'

export type RecipesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: WorkflowRecipe[] }

const SEARCH_FROM = 8

/** True when a recipe matches what was typed: its title, its sentence or the step names. */
export function matchesRecipe(recipe: WorkflowRecipe, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  return [recipe.title, recipe.sentence, ...recipe.actions.map((a) => a.label)].some((text) => text.toLowerCase().includes(q))
}

/**
 * The ready-made automations as cards: what each one does in one sentence, whether it asks for approval, and one button, "Add as draft". A recipe
 * already added says "Already added" and cannot be added twice. Used as the empty state of the list and again from the "New automation" menu.
 */
export function RecipeGallery({ recipes, adding, canAdd, onAdd, onRetry }: {
  recipes: RecipesState
  /** The key of the recipe being added right now. */
  adding: string | null
  canAdd: boolean
  onAdd: (recipe: WorkflowRecipe) => void
  onRetry: () => void
}) {
  const [query, setQuery] = useState('')
  const idPrefix = useId()
  const items = useMemo(() => (recipes.status === 'ready' ? recipes.items : []), [recipes])
  const shown = useMemo(() => items.filter((r) => matchesRecipe(r, query)), [items, query])

  if (recipes.status === 'loading') {
    return (
      <div role="status" aria-label="Loading ready-made automations" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
      </div>
    )
  }
  if (recipes.status === 'error') {
    return <ErrorState title="Ready-made automations could not be loaded" description={recipes.message} retry={onRetry} />
  }
  if (items.length === 0) {
    return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">There are no ready-made automations yet. Start from scratch instead.</p>
  }

  return (
    <div className="space-y-3">
      {items.length >= SEARCH_FROM && (
        <div className="max-w-sm">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ready-made automations…"
            aria-label="Search ready-made automations"
            name="recipe-search"
            autoComplete="off"
            spellCheck={false}
            icon={<Search className="size-4" aria-hidden="true" />}
          />
        </div>
      )}
      {shown.length === 0 && <p className="text-sm text-muted-foreground">No ready-made automation matches “{query.trim()}”. Try fewer words.</p>}
      <ul aria-label="Ready-made automations" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {shown.map((recipe) => {
          const added = recipe.installed_workflow_id !== null
          const titleId = `${idPrefix}-${recipe.key}`
          return (
            <li key={recipe.key} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4">
              <div className="min-w-0 space-y-1.5">
                <h3 id={titleId} className="text-pretty break-words text-sm font-semibold text-foreground">{recipe.title}</h3>
                <p className="break-words text-sm text-muted-foreground">{recipe.sentence}</p>
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-2">
                  {(recipe.consequential || recipe.requires_approval) && <span className={`${CHIP_BASE} ${chipClass('caution')}`}>Needs approval</span>}
                </span>
                <Button
                  size="sm"
                  variant={added ? 'outline' : 'default'}
                  disabled={added || !canAdd || adding !== null}
                  aria-describedby={titleId}
                  onClick={() => onAdd(recipe)}
                >
                  {added ? 'Already added' : adding === recipe.key ? 'Adding…' : 'Add as draft'}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
