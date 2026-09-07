'use client'

import { useEffect, useMemo, useState, use } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Briefcase,
  Building2,
  Clock,
  Globe,
  Inbox,
  MapPin,
  Search,
  SlidersHorizontal,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
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
 * It DOES use the design system's primitives - Card, Badge, Button, Input,
 * Select - so the page a candidate sees is recognisably the same product as the
 * one HR uses. It was previously hand-rolled with bare divs and its own colours,
 * which is why it read as a different application.
 *
 * Layout is keyed to @container/careers rather than viewport breakpoints, so the
 * page is correct however it is embedded.
 */

const ALL = 'all'

/** Every filter reads from the postings themselves, so nothing is ever offered
 *  that would return an empty list. */
function optionsFrom(postings: CareersPosting[], pick: (p: CareersPosting) => string | null) {
  const values = Array.from(new Set(postings.map(pick).filter((v): v is string => Boolean(v && v.trim()))))
  return values.sort((a, b) => a.localeCompare(b))
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export default function CareersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)

  const [org, setOrg] = useState<CareersOrganisation | null>(null)
  const [postings, setPostings] = useState<CareersPosting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState(ALL)
  const [location, setLocation] = useState(ALL)
  const [employment, setEmployment] = useState(ALL)

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
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const departments = useMemo(() => optionsFrom(postings, (p) => p.department), [postings])
  const locations = useMemo(() => optionsFrom(postings, (p) => p.location), [postings])
  const employments = useMemo(() => optionsFrom(postings, (p) => p.employment_type), [postings])

  /* Filtering is client-side on purpose: the API returns every open role for an
     organisation, and that list is small enough that a round trip per keystroke
     would be slower and less reliable than filtering what is already here. */
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return postings.filter((posting) => {
      if (department !== ALL && posting.department !== department) return false
      if (location !== ALL && posting.location !== location) return false
      if (employment !== ALL && posting.employment_type !== employment) return false
      if (!term) return true
      const haystack = [posting.title, posting.department, posting.location, ...posting.skills]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [postings, search, department, location, employment])

  const filtered = department !== ALL || location !== ALL || employment !== ALL || search.trim() !== ''

  return (
    <div className="@container/careers min-h-screen bg-muted/30">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 @3xl/careers:px-6 @3xl/careers:py-12">

        {/* ── Who is hiring ──────────────────────────────────────────── */}
        {loading && !org ? (
          <Card className="shadow-sm">
            <CardContent className="flex flex-col gap-3 p-6">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-72" />
              <Skeleton className="h-4 w-96" />
            </CardContent>
          </Card>
        ) : org ? (
          <Card className="overflow-hidden shadow-sm">
            <CardContent className="flex flex-col gap-5 p-6 @2xl/careers:p-8">
              <div className="flex items-start gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
                  {initials(org.name)}
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Careers
                  </span>
                  <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground @2xl/careers:text-3xl">
                    {org.name}
                  </h1>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                {org.industry && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="size-4 shrink-0" aria-hidden="true" />
                    <span className="capitalize">{org.industry}</span>
                  </span>
                )}
                {org.address && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-4 shrink-0" aria-hidden="true" />
                    {org.address}
                  </span>
                )}
                {org.website && (
                  <a
                    href={org.website}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-1.5 font-medium text-primary hover:underline"
                  >
                    <Globe className="size-4 shrink-0" aria-hidden="true" />
                    Company website
                  </a>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                <Badge variant="secondary" className="gap-1.5">
                  <Briefcase className="size-3.5" aria-hidden="true" />
                  {postings.length} open {postings.length === 1 ? 'role' : 'roles'}
                </Badge>
                {departments.length > 0 && (
                  <Badge variant="outline">
                    {departments.length} {departments.length === 1 ? 'team' : 'teams'}
                  </Badge>
                )}
                {locations.length > 0 && (
                  <Badge variant="outline">
                    {locations.length} {locations.length === 1 ? 'location' : 'locations'}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {error && (
          <Card className="border-destructive/40 shadow-sm">
            <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
              <p className="text-sm font-semibold text-destructive">{error}</p>
              <p className="text-xs text-muted-foreground">
                Check the address, or ask whoever shared this link to send it again.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Filters. Only once there is enough to filter. ───────────── */}
        {postings.length > 3 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                className="h-10 pl-9"
                placeholder="Search roles, teams or skills…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search open roles"
              />
            </div>
            {departments.length > 1 && (
              <div className="w-[190px]">
                <Select
                  value={department}
                  onChange={setDepartment}
                  options={[
                    { value: ALL, label: 'All teams' },
                    ...departments.map((value) => ({ value, label: value })),
                  ]}
                />
              </div>
            )}
            {locations.length > 1 && (
              <div className="w-[180px]">
                <Select
                  value={location}
                  onChange={setLocation}
                  options={[
                    { value: ALL, label: 'All locations' },
                    ...locations.map((value) => ({ value, label: value })),
                  ]}
                />
              </div>
            )}
            {employments.length > 1 && (
              <div className="w-[170px]">
                <Select
                  value={employment}
                  onChange={setEmployment}
                  options={[
                    { value: ALL, label: 'Any type' },
                    ...employments.map((value) => ({ value, label: value })),
                  ]}
                />
              </div>
            )}
            {filtered && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch('')
                  setDepartment(ALL)
                  setLocation(ALL)
                  setEmployment(ALL)
                }}
              >
                <SlidersHorizontal className="mr-1.5 size-4" aria-hidden="true" />
                Clear
              </Button>
            )}
          </div>
        )}

        {/* ── The roles ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Open roles
            </h2>
            {!loading && (
              <span className="text-xs text-muted-foreground">
                {filtered ? `${visible.length} of ${postings.length}` : visible.length}
              </span>
            )}
          </div>

          {loading &&
            Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="shadow-sm">
                <CardContent className="flex flex-col gap-3 p-5">
                  <Skeleton className="h-5 w-64" />
                  <Skeleton className="h-4 w-96" />
                </CardContent>
              </Card>
            ))}

          {!loading && postings.length === 0 && !error && (
            <Card className="border-dashed shadow-none">
              <CardContent className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                <Inbox className="size-9 text-muted-foreground/40" aria-hidden="true" />
                <p className="text-base font-semibold text-foreground">No open roles right now</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  {org?.name ?? 'This organisation'} is not advertising any positions at the moment.
                  Do check back — new roles appear here as soon as they are published.
                </p>
              </CardContent>
            </Card>
          )}

          {!loading && postings.length > 0 && visible.length === 0 && (
            <Card className="border-dashed shadow-none">
              <CardContent className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                <Search className="size-8 text-muted-foreground/40" aria-hidden="true" />
                <p className="text-sm font-semibold text-foreground">Nothing matches that</p>
                <p className="text-xs text-muted-foreground">
                  There {postings.length === 1 ? 'is' : 'are'} {postings.length} open{' '}
                  {postings.length === 1 ? 'role' : 'roles'} — try a broader search.
                </p>
              </CardContent>
            </Card>
          )}

          {visible.map((posting) => {
            const salary = formatSalaryRange(posting.salary_min, posting.salary_max)
            const closes = formatDeadline(posting.deadline)

            return (
              <Link
                key={posting.id}
                href={`/careers/${slug}/jobs/${posting.id}`}
                className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Card className="shadow-sm transition-colors group-hover:border-primary/50">
                  <CardContent className="flex flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <h3 className="text-base font-bold text-foreground group-hover:text-primary">
                          {posting.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {posting.department && (
                            <span className="flex items-center gap-1.5">
                              <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
                              {posting.department}
                            </span>
                          )}
                          {posting.location && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                              {posting.location}
                            </span>
                          )}
                          {posting.employment_type && (
                            <span className="flex items-center gap-1.5">
                              <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                              {posting.employment_type}
                            </span>
                          )}
                          {posting.positions && posting.positions > 1 && (
                            <span className="flex items-center gap-1.5">
                              <Users className="size-3.5 shrink-0" aria-hidden="true" />
                              {posting.positions} openings
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight
                        className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                        aria-hidden="true"
                      />
                    </div>

                    {posting.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {posting.skills.slice(0, 6).map((skill) => (
                          <Badge key={skill} variant="secondary" className="font-normal">
                            {skill}
                          </Badge>
                        ))}
                        {posting.skills.length > 6 && (
                          <Badge variant="outline" className="font-normal">
                            +{posting.skills.length - 6}
                          </Badge>
                        )}
                      </div>
                    )}

                    {(salary || closes) && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs">
                        {salary && <span className="font-semibold text-foreground">{salary}</span>}
                        {closes && (
                          <span className={cn('text-muted-foreground')}>Applications close {closes}</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        <p className="pt-2 text-center text-xs text-muted-foreground">
          Applications are reviewed by {org?.name ?? 'the'} hiring team. After you apply you will get a
          personal link to follow your application — no account needed.
        </p>
      </div>
    </div>
  )
}
