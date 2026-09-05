'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { Briefcase, Globe, MapPin, Clock, Users, ArrowRight, Inbox } from 'lucide-react'
import {
  careersApi,
  formatDeadline,
  formatSalaryRange,
  type CareersOrganisation,
  type CareersPosting,
} from '@/lib/careers-api'

/**
 * A company's open roles. Public: no login, no shell, no sidebar.
 *
 * This page deliberately does NOT use GtgAppShell or GtgPageShell. Both mount
 * useSidebarNavigation(), whose query needs a Laravel token, and both render a
 * header that assumes a signed-in user. A candidate has neither.
 *
 * Layout is keyed to @container/careers rather than viewport breakpoints, so the
 * page is correct however it is embedded. Nothing in the existing Talent screens
 * is touched by any of this.
 */
export default function CareersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)

  const [org, setOrg] = useState<CareersOrganisation | null>(null)
  const [postings, setPostings] = useState<CareersPosting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // `loading` already starts true and this page remounts on a route-param
    // change, so setting it synchronously here only triggers a cascading render.
    careersApi
      .organisation(slug)
      .then((data) => {
        if (cancelled) return
        setOrg(data.organisation)
        setPostings(data.postings)
        setError(null)
      })
      .catch((cause) => {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : 'This careers page could not be loaded.')
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [slug])

  return (
    <div className="@container/careers mx-auto w-full max-w-5xl px-4 py-8 @2xl/careers:px-6 @2xl/careers:py-12">
      {loading ? <PageSkeleton /> : error ? <PageError message={error} /> : org ? (
        <>
          <header className="rounded-xl border border-border bg-card p-6 @2xl/careers:p-8">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Careers
            </span>
            <h1 className="mt-1.5 text-2xl font-bold text-foreground @2xl/careers:text-3xl">
              {org.name}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {org.industry && (
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="size-3.5" aria-hidden="true" />
                  {org.industry}
                </span>
              )}
              {org.address && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {org.address}
                </span>
              )}
              {org.website && (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  <Globe className="size-3.5" aria-hidden="true" />
                  Company website
                </a>
              )}
            </div>
          </header>

          <div className="mt-8 flex items-baseline justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-foreground">
              Open roles
              <span className="ml-1.5 tabular-nums text-muted-foreground">{postings.length}</span>
            </h2>
          </div>

          {postings.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed p-10 text-center">
              <Inbox className="mx-auto mb-3 size-7 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">No open roles right now</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {org.name} is not advertising any positions at the moment. Do check back — new roles
                appear here as soon as they are published.
              </p>
            </div>
          ) : (
            <ul className="mt-3 grid grid-cols-1 gap-3 @3xl/careers:grid-cols-2">
              {postings.map((posting) => (
                <li key={posting.id}>
                  <PostingCard slug={slug} posting={posting} />
                </li>
              ))}
            </ul>
          )}

          <p className="mt-10 text-center text-xs text-muted-foreground">
            Applications are reviewed by {org.name}&apos;s hiring team.
          </p>
        </>
      ) : null}
    </div>
  )
}

function PostingCard({ slug, posting }: { slug: string; posting: CareersPosting }) {
  const salary = formatSalaryRange(posting.salary_min, posting.salary_max)
  const closes = formatDeadline(posting.deadline)

  return (
    <Link
      href={`/careers/${slug}/jobs/${posting.id}`}
      className="group flex h-full flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {posting.department && (
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {posting.department}
        </span>
      )}

      <h3 className="mt-1 text-base font-semibold text-foreground">{posting.title}</h3>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {posting.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden="true" />
            {posting.location}
          </span>
        )}
        {posting.employment_type && (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden="true" />
            {posting.employment_type}
          </span>
        )}
        {posting.positions !== null && (
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden="true" />
            <span className="tabular-nums">{posting.positions}</span>
            {posting.positions === 1 ? ' opening' : ' openings'}
          </span>
        )}
      </div>

      {posting.skills.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {posting.skills.slice(0, 5).map((skill) => (
            <li
              key={skill}
              className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {skill}
            </li>
          ))}
          {posting.skills.length > 5 && (
            <li className="px-1 py-0.5 text-[11px] text-muted-foreground tabular-nums">
              +{posting.skills.length - 5}
            </li>
          )}
        </ul>
      )}

      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div className="min-w-0">
          {salary && (
            <p className="truncate text-sm font-semibold tabular-nums text-foreground">{salary}</p>
          )}
          {closes && <p className="mt-0.5 text-[11px] text-muted-foreground">Closes {closes}</p>}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
          View &amp; apply
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  )
}

function PageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-36 rounded-xl bg-muted/50" />
      <div className="mt-8 h-3 w-24 rounded bg-muted/50" />
      <div className="mt-3 grid grid-cols-1 gap-3 @3xl/careers:grid-cols-2">
        <div className="h-44 rounded-xl bg-muted/40" />
        <div className="h-44 rounded-xl bg-muted/40" />
      </div>
    </div>
  )
}

function PageError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center" role="alert">
      <p className="text-sm font-semibold text-destructive">This careers page could not be opened</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
