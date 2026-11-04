import type { Account360CampaignEntry, EntityRelationship, KnowledgeSource, SignalInboxItem } from '@/types/crm'
import type { OrgDealLine } from '@/services/org-accounts/types'

/**
 * What the merged Account 360 tab still takes from GET /api/crm/account360/{id}: the sections the identity 360 does not have (recent campaigns, knowledge
 * sources, relationships and the CRM signal inbox). The endpoint answers camel case; only the fields the tab reads are named here. The contacts and the
 * deals come from the identity 360 instead, which adds the GTM side and the consent status.
 */
export interface OldAccount360 {
  campaigns: Account360CampaignEntry[]
  knowledgeSources: Array<Pick<KnowledgeSource, 'id' | 'sourceType' | 'title' | 'url' | 'confidence' | 'verified' | 'collectedAt'>>
  relationships: Array<Pick<EntityRelationship, 'id' | 'fromType' | 'fromId' | 'toType' | 'toId' | 'relationshipType' | 'confidence' | 'source' | 'verified'>>
  signals: Array<Pick<SignalInboxItem, 'id' | 'title' | 'classification' | 'sourceName' | 'sourceUrl' | 'publishedAt'>>
}

/** The stages of a CRM opportunity that are over. GTM deals carry no such stage here: their own `closed_at` is what the open count in "why now" uses. */
const CLOSED_CRM_STAGES: readonly string[] = ['Closed Won', 'Closed Lost']

/** The deals worth looking at now: a CRM opportunity not closed won or lost, and every GTM deal the 360 lists (a closed one is told apart by its stage). */
export function openDealLines(deals: readonly OrgDealLine[]): OrgDealLine[] {
  return deals.filter((deal) => deal.source !== 'crm' || !CLOSED_CRM_STAGES.includes(deal.stage ?? ''))
}

/** "70%" for a confidence of 0.7, or null when none is recorded. */
export function confidenceText(value: number | null | undefined): string | null {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` : null
}

const words = (value: string) => value.replace(/_/g, ' ')

/** "subsidiary of organization #999": the kind of relationship and what is on the other end. */
export function relationshipText(relationship: Pick<EntityRelationship, 'fromType' | 'fromId' | 'toType' | 'toId' | 'relationshipType'>, organizationId: string): string {
  const isFrom = relationship.fromType === 'organization' && String(relationship.fromId) === String(organizationId)
  const type = isFrom ? relationship.toType : relationship.fromType
  const id = isFrom ? relationship.toId : relationship.fromId
  return `${words(relationship.relationshipType)} ${isFrom ? '→' : '←'} ${type} #${id}`
}

/** What a contact's consent status says, in words: "Consent: opted in". A GTM contact has none recorded (null) and says nothing. */
export function consentText(status: string | null | undefined): string | null {
  return status ? `Consent: ${words(status)}` : null
}

/** What a signal in the CRM inbox is: "buying signal", "unclassified". */
export function classificationText(classification: string | null | undefined): string {
  return words(classification || 'unclassified')
}
