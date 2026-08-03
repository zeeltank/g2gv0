'use client'

/**
 * Taxonomy Ontology — the competency graph.
 *
 * The graph itself is a separate Neo4j-backed service, so this embeds it
 * scoped to the current organisation rather than reimplementing a graph
 * renderer. That service owns the data; this owns the framing, the tenant
 * scope and the failure state.
 *
 * An iframe cannot report a failed load cross-origin, so there is no way to
 * distinguish "still loading" from "the service is down" by listening. Instead
 * the frame is given a grace period and, once elapsed, an escape hatch appears
 * alongside it — the user is never left staring at a blank rectangle with no
 * way forward.
 */

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Network, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { getLaravelContext } from '@/lib/laravel-context'
import { useAuth } from '@/hooks/use-auth'

/** The hosted graph explorer. */
const ONTOLOGY_ORIGIN = 'https://skill-ontology-neo4j.vercel.app'

/** How long to show the loading state before offering a way out. */
const LOAD_GRACE_MS = 6000

export function CmTaxonomyOntology() {
  const { user } = useAuth()
  const context = getLaravelContext(user)
  const subInstituteId = context.subInstituteId

  // Bumped to force the iframe to remount on Reload.
  const [nonce, setNonce] = useState(0)

  // Both flags are tracked as "which attempt did this happen on" rather than
  // booleans that an effect has to reset. A new attempt makes them false by
  // derivation, so nothing has to be un-set when the source changes.
  const [loadedNonce, setLoadedNonce] = useState(-1)
  const [graceNonce, setGraceNonce] = useState(-1)

  const loaded = loadedNonce === nonce
  const graceElapsed = graceNonce === nonce

  const src = useMemo(
    () => (subInstituteId ? `${ONTOLOGY_ORIGIN}/?sub_institute_id=${encodeURIComponent(subInstituteId)}` : ''),
    [subInstituteId],
  )

  useEffect(() => {
    // The only state change here happens later, in the timer callback, so
    // nothing cascades out of the effect body.
    const timer = setTimeout(() => setGraceNonce(nonce), LOAD_GRACE_MS)
    return () => clearTimeout(timer)
  }, [src, nonce])

  if (!subInstituteId) {
    return (
      <EmptyState
        icon={<Network className="h-8 w-8" />}
        title="No organisation selected"
        description="The ontology is scoped to one organisation, so it needs an active session to load."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-primary/10 bg-card/50 p-5 shadow-sm backdrop-blur-xl">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Network className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Taxonomy Ontology</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              How this organisation&apos;s competencies, job roles and taxonomies connect to each other, as a graph.
              Useful for spotting orphaned competencies and roles that share more than they appear to.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            onClick={() => setNonce((value) => value + 1)}
            className="h-9 gap-2 rounded-lg font-semibold"
          >
            <RefreshCw className="h-4 w-4" /> Reload
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(src, '_blank', 'noopener,noreferrer')}
            className="h-9 gap-2 rounded-lg font-semibold"
          >
            <ExternalLink className="h-4 w-4" /> Open full screen
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card/40">
        {!loaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card/80 p-6 backdrop-blur-sm">
            <Skeleton className="h-40 w-full max-w-2xl rounded-xl" />
            <p className="text-sm text-muted-foreground">Loading the competency graph…</p>

            {/* Cross-origin frames cannot report failure, so after the grace
                period the user gets a way forward instead of a blank panel. */}
            {graceElapsed && (
              <div className="flex flex-wrap items-center justify-center gap-2 text-center">
                <p className="w-full text-xs text-muted-foreground">
                  Still loading. The graph service may be waking up.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setNonce((value) => value + 1)}
                  className="h-8 gap-1.5 rounded-lg text-xs font-semibold"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(src, '_blank', 'noopener,noreferrer')}
                  className="h-8 gap-1.5 rounded-lg text-xs font-semibold"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open in a new tab
                </Button>
              </div>
            )}
          </div>
        )}

        <iframe
          key={nonce}
          src={src}
          title="Competency ontology graph"
          onLoad={() => setLoadedNonce(nonce)}
          // The graph is read-only and third-party: no same-origin access, no
          // top-level navigation, no downloads.
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
          referrerPolicy="no-referrer"
          className="h-[calc(100vh-19rem)] min-h-[520px] w-full border-0"
        />
      </div>
    </div>
  )
}
