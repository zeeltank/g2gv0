'use client'

import React, { useMemo, useState } from 'react'
import {
  BadgeCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { useMyCertifications } from '@/hooks/use-my-certifications'
import type { MyCertificationItem, MyComplianceKey } from '@/services/competency/my-certifications'

/**
 * MY CERTIFICATIONS — the employee's own credentials, read-only.
 *
 * ── WHY THIS IS A SCREEN AND NOT A TAB ON cm-certifications ─────────────────
 *
 * That screen already has a "My Certifications" tab, and a tab cannot express
 * ownership: its filter is a user_id sent from the browser over an endpoint
 * that answers for whatever id it is handed, and the screen around it can
 * create, edit, verify, revoke and delete anyone's records. Granting an
 * employee the module so they could see their own certificate also granted them
 * edit on a colleague's; withholding it left them unable to see their own.
 *
 * This screen calls one endpoint that takes no subject parameter, so there is
 * nothing on this page that can be pointed at a colleague.
 *
 * ── WHY IT IS A CARD LIST AND NOT THE ADMIN TABLE ───────────────────────────
 *
 * An employee holds a handful of credentials, not hundreds. A sortable,
 * paginated, twelve-filter table over four rows is the admin screen's shape,
 * and reusing it here would have meant reusing its controls too. What an
 * employee needs is "is anything about to expire, and where is my certificate"
 * — so expiry leads, and the download sits on the row.
 *
 * ── WHY THE TILES FILTER CLIENT-SIDE ────────────────────────────────────────
 *
 * The tiles are derived from the rows already on screen, so they can never
 * offer a state the data does not contain, and clicking one cannot produce an
 * empty table that reads as "none found" when it means "impossible choice".
 * That is the failure this module has elsewhere — a literal option list over
 * live data — and the cheapest way not to repeat it is to have no literal list.
 */

/** Compliance key -> how the row is presented. Server decides the key. */
const COMPLIANCE_PRESENTATION: Record<
  MyComplianceKey,
  { label: string; tone: string; icon: React.ReactNode; badge: string }
> = {
  compliant: {
    label: 'Compliant',
    tone: 'bg-primary/10 text-primary',
    icon: <CheckCircle2 className="w-5 h-5" />,
    badge: 'active',
  },
  expiring: {
    label: 'Expiring Soon',
    tone: 'bg-amber-500/10 text-amber-600',
    icon: <Clock className="w-5 h-5" />,
    badge: 'pending',
  },
  non_compliant: {
    label: 'Needs Attention',
    tone: 'bg-destructive/10 text-destructive',
    icon: <AlertCircle className="w-5 h-5" />,
    badge: 'inactive',
  },
}

function SummaryTile({
  icon,
  tone,
  label,
  value,
  hint,
  loading,
  onClick,
  active,
}: {
  icon: React.ReactNode
  tone: string
  label: string
  value: number | null
  hint: string
  loading: boolean
  onClick?: () => void
  active?: boolean
}) {
  return (
    <Card
      className={`shadow-sm transition-colors ${onClick ? 'cursor-pointer hover:border-primary/40' : ''} ${
        active ? 'border-primary/50 ring-1 ring-primary/20' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-5 flex flex-col justify-between h-full">
        <div className="flex items-start justify-between mb-2">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tone}`}>{icon}</div>
        </div>
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="h-8 w-16 mt-1" />
          ) : (
            <p className="text-2xl font-bold text-foreground mt-1">{value === null ? '--' : value}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * The expiry line, which is the reason most people open this page.
 *
 * `days_to_expiry` null and 0 mean different things and are never conflated:
 * null is "does not expire", 0 is "expires today".
 */
function ExpiryLine({ item }: { item: MyCertificationItem }) {
  if (!item.expiry_date) {
    return <span className="text-muted-foreground">Does not expire</span>
  }

  const days = item.days_to_expiry
  const label = item.expiry_date_label ?? item.expiry_date

  if (days === null) {
    return <span className="text-foreground">{label}</span>
  }
  if (days < 0) {
    return (
      <span className="text-destructive font-medium">
        {label} · expired {Math.abs(days)} {Math.abs(days) === 1 ? 'day' : 'days'} ago
      </span>
    )
  }
  if (days === 0) {
    return <span className="text-destructive font-medium">{label} · expires today</span>
  }

  return (
    <span className={days <= 60 ? 'text-amber-600 font-medium' : 'text-foreground'}>
      {label} · {days} {days === 1 ? 'day' : 'days'} left
    </span>
  )
}

function DocumentButton({ doc }: { doc: MyCertificationItem['documents'][number] }) {
  const name = doc.file_name || doc.title || (doc.is_file ? 'Certificate' : 'Link')

  // A row can exist with nothing to open. Disabled beats linking to "null".
  if (!doc.url) {
    return (
      <Button variant="outline" size="sm" disabled title="This attachment has no file or link recorded">
        <FileText className="w-4 h-4 mr-1.5" />
        {name}
      </Button>
    )
  }

  return (
    <Button variant="outline" size="sm" asChild>
      <a
        href={doc.url}
        target="_blank"
        rel="noopener noreferrer"
        /*
         * `download` only takes effect same-origin; these files are served from
         * Spaces, so the browser opens them in a new tab instead. Labelling the
         * control Download and having it open a viewer is honest — the file is
         * reachable either way — and the icon distinguishes a stored file from
         * an external link.
         */
        download={doc.is_file ? name : undefined}
      >
        {doc.is_file ? <Download className="w-4 h-4 mr-1.5" /> : <ExternalLink className="w-4 h-4 mr-1.5" />}
        {name}
      </a>
    </Button>
  )
}

function CertificationCard({ item }: { item: MyCertificationItem }) {
  const presentation = COMPLIANCE_PRESENTATION[item.compliance_key] ?? COMPLIANCE_PRESENTATION.compliant

  const facts: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'Issued by', value: item.issuing_body || '--' },
    { label: 'Type', value: item.certification_type || '--' },
    { label: 'Credential ID', value: item.credential_id || '--' },
    { label: 'Issued on', value: item.issued_date_label ?? '--' },
    { label: 'Expires', value: <ExpiryLine item={item} /> },
    {
      label: 'Verification',
      value: item.verification_status ? (
        <StatusBadge status={item.verification_status} label={item.verification_status} />
      ) : (
        '--'
      ),
    },
  ]

  return (
    <Card className="shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${presentation.tone}`}>
              {presentation.icon}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground break-words">{item.name || 'Untitled certification'}</h3>
              {/* The reason, in the server's words, so it matches what HR sees. */}
              <p className="text-xs text-muted-foreground mt-0.5">{item.compliance_reason}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={presentation.badge} label={presentation.label} />
            {item.status_label ? <StatusBadge status={item.status ?? ''} label={item.status_label} /> : null}
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 mt-4 text-sm">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">{fact.label}</dt>
              <dd className="text-foreground break-words mt-0.5">{fact.value}</dd>
            </div>
          ))}
        </dl>

        {item.notes ? (
          <p className="text-sm text-muted-foreground mt-4 whitespace-pre-line border-t border-border pt-3">
            {item.notes}
          </p>
        ) : null}

        <div className="mt-4 border-t border-border pt-3">
          {item.documents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No certificate file attached. HR records the document against this credential.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {item.documents.map((doc) => (
                <DocumentButton key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function MyCertifications() {
  const { loading, error, items, summary, truncated, reload } = useMyCertifications()

  /**
   * Which compliance group the tiles have narrowed to, or null for all.
   *
   * Client-side over the rows already loaded. An employee has a handful of
   * credentials, so a round trip per tile would be slower and would let the
   * tiles and the list disagree while one was in flight.
   */
  const [focus, setFocus] = useState<MyComplianceKey | null>(null)

  const visible = useMemo(
    () => (focus ? items.filter((item) => item.compliance_key === focus) : items),
    [items, focus],
  )

  const toggle = (key: MyComplianceKey) => setFocus((current) => (current === key ? null : key))

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BadgeCheck className="w-6 h-6 text-primary" />
            My Certifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            The credentials recorded against you, and the certificate files attached to them.
          </p>
        </div>
        <Button variant="outline" onClick={reload} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryTile
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="bg-primary/10 text-primary"
          label="Compliant"
          value={summary?.compliant ?? null}
          hint="Valid and in date"
          loading={loading}
          active={focus === 'compliant'}
          onClick={() => toggle('compliant')}
        />
        <SummaryTile
          icon={<Clock className="w-5 h-5" />}
          tone="bg-amber-500/10 text-amber-600"
          label="Expiring Soon"
          value={summary?.expiring ?? null}
          hint="Within the next 60 days"
          loading={loading}
          active={focus === 'expiring'}
          onClick={() => toggle('expiring')}
        />
        <SummaryTile
          icon={<AlertCircle className="w-5 h-5" />}
          tone="bg-destructive/10 text-destructive"
          label="Needs Attention"
          value={summary?.non_compliant ?? null}
          hint="Expired or revoked"
          loading={loading}
          active={focus === 'non_compliant'}
          onClick={() => toggle('non_compliant')}
        />
      </div>

      {truncated ? (
        <p className="text-xs text-muted-foreground">
          Showing the first 200 credentials. Contact HR if you expect to see more.
        </p>
      ) : null}

      {error ? (
        <ErrorState
          title="Could not load your certifications"
          description={error}
          retry={reload}
        />
      ) : loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-44 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="w-10 h-10" />}
          title="No certifications recorded yet"
          description="Certifications are issued and recorded by HR. Once one is added against your name it appears here, with any certificate file attached to it."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="w-10 h-10" />}
          title={`Nothing in "${COMPLIANCE_PRESENTATION[focus as MyComplianceKey]?.label ?? 'that group'}"`}
          description="Select the tile again to see all of your certifications."
          action={
            <Button variant="outline" onClick={() => setFocus(null)}>
              Show all
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {visible.map((item) => (
            <CertificationCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

export default MyCertifications
