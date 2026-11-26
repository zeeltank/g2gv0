'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, MessageCircle, Mail, MoreHorizontal, Pencil, Phone, Send, Star, StarOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SectionCard } from '@/components/shared/business/shared'
import { PageTabs, TabPanel, tabButtonId, tabPanelId } from '@/components/shared/scaffolds/page-tabs'
import { useConfirm } from '@/components/shared/scaffolds/use-confirm'
import { CustomFieldsSection } from '@/domain/organization/edit-employee/custom-fields-section'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { contactPatch } from '@/lib/facts/model'
import type { LaravelContext } from '@/lib/laravel-context'
import { CHIP_BASE, CHIP_TONE, NOTICE_TONE } from '@/lib/org-accounts/tones'
import { describePlatformError } from '@/lib/platform/client'
import { saveCustomFieldValues } from '@/lib/platform/custom-field-values'
import { cn } from '@/lib/utils'
import { contactsService, withContactExtras } from '@/services/crm/contacts'
import type { FactsApi } from '@/services/facts/api-types'
import type { Fact } from '@/services/facts/types'
import type { Contact } from '@/types/crm'
import { BulkSendMessageDialog } from '../bulk-send-message-dialog'
import { CreateContactModal } from '../create-contact-modal'
import { useAssignableEmployees, employeeName } from '../lead-employees'
import { CrmScheduleTab } from '../crm-schedule-tab'
import { SendEmailDialog } from '../send-email-dialog'
import { SendSmsDialog } from '../send-sms-dialog'
import { PersonDeals } from './person-deals'
import { personInitials, personName } from './person-model'
import { PersonOverview } from './person-overview'
import { PersonEmails, PersonFiles, PersonHistory, PersonNotes } from './person-tabs'
import { PersonTransferDialog } from './person-transfer-dialog'
import { usePeopleRights } from './people-rights'

export interface PersonPanelProps {
  context: LaravelContext
  personId: number
  /** Asked for by the Back button (phone layout of the People tab, the drawer of All people) and after the person was deleted. */
  onClose?: () => void
  /** The person changed (edited, Primary changed, transferred, deleted): whoever lists people reads the list again. */
  onChanged?: () => void
  /** Shows the person's company under the name, as a link to its page. A company's own People tab leaves it out: the company is the page. */
  showCompany?: boolean
  /** For tests: the Consent line and the Evidence section read the facts API through it (the panel itself passes nothing). */
  factsService?: FactsApi
}

type Loaded = { kind: 'loading' } | { kind: 'error'; message: string; status: number | null } | { kind: 'ready'; contact: Contact }
type Notice = { tone: 'success' | 'error'; text: string }

const TAB_IDS = ['overview', 'deals', 'schedule', 'notes', 'files', 'emails', 'history'] as const
type TabId = (typeof TAB_IDS)[number] | 'custom'

const TAB_LABELS: Record<TabId, string> = {
  overview: 'Overview', deals: 'Deals', schedule: 'Schedule', notes: 'Notes', files: 'Files', emails: 'Emails', history: 'History', custom: 'Custom',
}

/**
 * One person of a company, as the S18 mock-up draws them: the header (avatar, name, Primary and Role, title, department, CON number), the actions (Email, SMS,
 * WhatsApp, Call, Edit, Make or Remove primary, and in the "..." menu Transfer ownership and Delete) and the tabs Overview, Deals, Schedule, Notes, Files,
 * Emails, History and (only when the organisation defines custom fields) Custom. It holds every section of the former Contact page and reuses the tab
 * components of every other CRM record.
 *
 * The People tab of a company and T3's drawer in All people both mount it; it reads the person itself, by `personId`, so the two need pass nothing else.
 */
export function PersonPanel(props: PersonPanelProps) {
  // One body per person: switching person resets every tab, dialog and notice.
  return <PersonPanelBody key={props.personId} {...props} />
}

function PersonPanelBody({ context, personId, onClose, onChanged, showCompany = false, factsService }: PersonPanelProps) {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const rights = usePeopleRights()
  const { confirm, confirmDialog } = useConfirm()
  const id = String(personId)
  const idPrefix = `person-${id}`

  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' })
  // A fact accepted in the Evidence section can write one of the person's own fields. The panel takes the written value on top of the person it holds, until a
  // newer person arrives (a reload): the patch is tied to the object it was made on.
  const [patched, setPatched] = useState<{ base: Contact; values: Record<string, string> } | null>(null)
  const [tab, setTab] = useState<TabId>('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [smsOpen, setSmsOpen] = useState(false)
  const [whatsappOpen, setWhatsappOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [emailVersion, setEmailVersion] = useState(0)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)

  const [customValues, setCustomValues] = useState<Record<number, string | null>>({})
  const [hasCustomFields, setHasCustomFields] = useState(false)
  const [savingCustom, setSavingCustom] = useState(false)
  const [customNotice, setCustomNotice] = useState<string | null>(null)

  const employees = useAssignableEmployees(context, true)

  const load = useCallback(async () => {
    try {
      const response = await contactsService.get(context, id)
      setLoaded({ kind: 'ready', contact: response.data })
    } catch (reason) {
      const status = (reason as { status?: unknown } | null)?.status
      setLoaded({
        kind: 'error',
        status: typeof status === 'number' ? status : null,
        message: status === 404 ? 'This person was not found. They may have been deleted.' : reason instanceof Error ? reason.message : 'This person could not be loaded.',
      })
    }
  }, [context, id])

  useEffect(() => { queueMicrotask(() => { void load() }) }, [load])

  const base = loaded.kind === 'ready' ? loaded.contact : null
  const contact = useMemo<Contact | null>(() => (base && patched && patched.base === base ? { ...base, ...patched.values } : base), [base, patched])

  const showWrittenFact = (fact: Fact) => {
    const values = contactPatch(fact)
    if (values && base) setPatched((previous) => ({ base, values: { ...(previous && previous.base === base ? previous.values : {}), ...values } }))
  }

  if (loaded.kind === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading person…
      </div>
    )
  }
  if (loaded.kind === 'error' || !contact) {
    return (
      <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <p>{loaded.kind === 'error' ? loaded.message : 'This person could not be loaded.'}</p>
        <div className="flex gap-2">
          {loaded.kind === 'error' && loaded.status !== 404 && <Button size="sm" variant="outline" onClick={() => { setLoaded({ kind: 'loading' }); void load() }}>Try again</Button>}
          {onClose && <Button size="sm" variant="outline" onClick={onClose}>Back</Button>}
        </div>
      </div>
    )
  }

  const name = personName(contact)
  const fullName = personName(contact, true)
  const hasCompany = Boolean(contact.organizationId)
  const number = contact.mobile || contact.phone
  const tabs = (hasCustomFields ? [...TAB_IDS, 'custom' as const] : [...TAB_IDS]).map((tabId) => ({ id: tabId, label: TAB_LABELS[tabId] }))
  const activeTab: TabId = tab === 'custom' && !hasCustomFields ? 'overview' : tab
  const noRight = (right: 'edit' | 'delete') => `You do not have the ${right} right on people.`

  const afterChange = () => { void load(); onChanged?.() }

  const togglePrimary = async () => {
    if (busy) return
    setBusy(true)
    setNotice(null)
    const wasPrimary = Boolean(contact.isPrimary)
    try {
      const response = wasPrimary ? await contactsService.clearPrimary(context, id) : await contactsService.setPrimary(context, id)
      const next = response.data?.id ? withContactExtras(response.data) : { ...contact, isPrimary: !wasPrimary }
      setLoaded({ kind: 'ready', contact: { ...contact, ...next, isPrimary: next.isPrimary ?? !wasPrimary } })
      setNotice({ tone: 'success', text: wasPrimary ? `${name} is no longer the primary contact.` : `${name} is now the primary contact${contact.organizationName ? ` of ${contact.organizationName}` : ''}.` })
      onChanged?.()
    } catch (reason) {
      setNotice({ tone: 'error', text: reason instanceof Error ? reason.message : 'The primary contact could not be changed.' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${name}?`,
      description: 'The person moves to the Recycle Bin. Their notes, files and emails are kept, and the person can be restored from there.',
      confirmLabel: 'Delete person',
    })
    if (!ok) return
    try {
      await contactsService.delete(context, id)
      onChanged?.()
      onClose?.()
    } catch (reason) {
      setNotice({ tone: 'error', text: reason instanceof Error ? reason.message : 'The person could not be deleted.' })
    }
  }

  const saveCustomFields = async () => {
    setSavingCustom(true)
    setCustomNotice(null)
    try {
      await saveCustomFieldValues('crm_contacts', Number(id), customValues)
      setCustomNotice('Saved.')
    } catch (cause: unknown) {
      setCustomNotice(describePlatformError(cause, 'Could not save these fields.'))
    } finally {
      setSavingCustom(false)
    }
  }

  return (
    <div className="space-y-4" data-person-panel={id}>
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 p-4">
          {onClose && (
            <Button data-person-back variant="ghost" size="icon" onClick={onClose} aria-label="Back to people" title="Back to people">
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Button>
          )}
          <div aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-foreground">
            {personInitials(contact)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-foreground">
              <span>{fullName}</span>
              {contact.isPrimary && <span data-pill="primary" className={cn(CHIP_BASE, CHIP_TONE.info)}><Star className="size-3" aria-hidden="true" />Primary</span>}
              {contact.contactRole && <span data-pill="role" className={cn(CHIP_BASE, CHIP_TONE.neutral)}>{contact.contactRole}</span>}
            </h2>
            <p className="text-sm text-muted-foreground">
              {[contact.title, contact.department, contact.contactNo].filter(Boolean).join(' · ') || ' '}
              {showCompany && (
                <>
                  {' · '}
                  {hasCompany ? (
                    <button type="button" data-person-company className="text-foreground underline underline-offset-2 hover:text-primary" onClick={() => router.push(`${resolveAccessLink('/module/crm/marketing/organizations')}/${contact.organizationId}`)}>
                      {contact.organizationName || 'Company'}
                    </button>
                  ) : 'No company'}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 px-4 pb-4" role="group" aria-label="Actions">
          <Button size="sm" onClick={() => setComposeOpen(true)}>
            <Mail className="mr-1.5 size-4" aria-hidden="true" />Email
          </Button>
          <Button size="sm" variant="outline" disabled={!number} title={number ? undefined : 'This person has no phone number.'} onClick={() => setSmsOpen(true)}>
            <Send className="mr-1.5 size-4" aria-hidden="true" />SMS
          </Button>
          <Button size="sm" variant="outline" disabled={!number} title={number ? undefined : 'This person has no phone number.'} onClick={() => setWhatsappOpen(true)}>
            <MessageCircle className="mr-1.5 size-4" aria-hidden="true" />WhatsApp
          </Button>
          {number ? (
            <Button size="sm" variant="outline" asChild>
              <a href={`tel:${number.replace(/[^\d+]/g, '')}`}><Phone className="mr-1.5 size-4" aria-hidden="true" />Call</a>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled title="This person has no phone number."><Phone className="mr-1.5 size-4" aria-hidden="true" />Call</Button>
          )}
          <Button size="sm" variant="outline" disabled={!rights.edit} title={rights.edit ? undefined : noRight('edit')} onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 size-4" aria-hidden="true" />Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-action="primary"
            disabled={!rights.edit || !hasCompany || busy}
            title={!rights.edit ? noRight('edit') : !hasCompany ? 'A person needs a company before it can be the primary contact.' : undefined}
            onClick={() => void togglePrimary()}
          >
            {contact.isPrimary ? <StarOff className="mr-1.5 size-4" aria-hidden="true" /> : <Star className="mr-1.5 size-4" aria-hidden="true" />}
            {contact.isPrimary ? 'Remove primary' : 'Make primary'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" aria-label="More actions"><MoreHorizontal className="size-4" aria-hidden="true" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={!rights.edit} onSelect={() => setTransferOpen(true)}>Transfer ownership</DropdownMenuItem>
              <DropdownMenuItem disabled={!rights.delete} className="text-destructive focus:text-destructive" onSelect={() => void remove()}>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {notice && (
        <div role="status" data-notice={notice.tone} className={cn('rounded-lg border p-3 text-sm', NOTICE_TONE[notice.tone])}>{notice.text}</div>
      )}

      <PageTabs tabs={tabs} active={activeTab} onChange={(next) => setTab(next as TabId)} label="Person sections" idPrefix={idPrefix} />

      <TabPanel id="overview" active={activeTab} idPrefix={idPrefix}>
        <PersonOverview
          contact={contact}
          ownerName={contact.assignedToName ?? employeeName(employees, contact.assignedTo)}
          factsService={factsService}
          onWroteRecord={showWrittenFact}
        />
      </TabPanel>
      <TabPanel id="deals" active={activeTab} idPrefix={idPrefix}>
        <PersonDeals context={context} personId={id} />
      </TabPanel>
      <TabPanel id="schedule" active={activeTab} idPrefix={idPrefix}>
        <CrmScheduleTab linkedType="CONTACT" linkedId={id} recordLabel={name} />
      </TabPanel>
      <TabPanel id="notes" active={activeTab} idPrefix={idPrefix}>
        <PersonNotes context={context} personId={id} />
      </TabPanel>
      <TabPanel id="files" active={activeTab} idPrefix={idPrefix}>
        <PersonFiles context={context} personId={id} />
      </TabPanel>
      <TabPanel id="emails" active={activeTab} idPrefix={idPrefix}>
        <PersonEmails context={context} personId={id} onCompose={() => setComposeOpen(true)} version={emailVersion} />
      </TabPanel>
      <TabPanel id="history" active={activeTab} idPrefix={idPrefix}>
        <PersonHistory context={context} personId={id} />
      </TabPanel>

      {/* Always mounted (hidden, not unmounted) so onFieldsLoaded can tell whether the organisation defines custom fields before that tab is even listed. */}
      <div
        {...(hasCustomFields ? { role: 'tabpanel', id: tabPanelId(idPrefix, 'custom'), 'aria-labelledby': tabButtonId(idPrefix, 'custom') } : {})}
        hidden={activeTab !== 'custom'}
      >
        <SectionCard title="Custom fields">
          <CustomFieldsSection
            recordTable="crm_contacts"
            recordId={Number(id)}
            values={customValues}
            onChange={setCustomValues}
            onFieldsLoaded={(fields) => setHasCustomFields(fields.length > 0)}
          />
          {hasCustomFields && (
            <div className="flex items-center gap-3 pt-4">
              <Button size="sm" disabled={savingCustom || !rights.edit} title={rights.edit ? undefined : noRight('edit')} onClick={() => void saveCustomFields()}>
                {savingCustom && <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />}
                Save
              </Button>
              {customNotice && <span className="text-xs text-muted-foreground">{customNotice}</span>}
            </div>
          )}
        </SectionCard>
      </div>

      <CreateContactModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice({ tone: 'success', text: message }); setEditOpen(false); afterChange() }}
        contact={contact}
        lockedOrganization={null}
      />
      <PersonTransferDialog
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        onTransferred={(message) => { setNotice({ tone: 'success', text: message }); setTransferOpen(false); afterChange() }}
        personId={id}
      />
      <SendSmsDialog
        isOpen={smsOpen}
        onClose={() => setSmsOpen(false)}
        onSent={(message) => { setNotice({ tone: 'success', text: message }); setSmsOpen(false) }}
        defaultToNumber={number}
        relatedType="contact"
        relatedId={id}
      />
      <BulkSendMessageDialog
        isOpen={whatsappOpen}
        onClose={() => setWhatsappOpen(false)}
        onSent={(message) => { setNotice({ tone: 'success', text: message }); setWhatsappOpen(false) }}
        relatedType="contact"
        ids={[id]}
        recipients={[{ id, name, email: contact.email, phone: number }]}
        initialChannel="whatsapp"
      />
      <SendEmailDialog
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={(message) => { setNotice({ tone: 'success', text: message }); setComposeOpen(false); setEmailVersion((v) => v + 1) }}
        linkedType="CONTACT"
        linkedId={id}
        defaultToAddress={contact.email}
      />
      {confirmDialog}
    </div>
  )
}
