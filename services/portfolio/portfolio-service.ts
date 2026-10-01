import { apiClient } from '@/services/core'
import { withLaravelParams, type LaravelContext } from '@/lib/laravel-context'
import type {
  ProductOffer,
  Partner,
  TaxonomyData,
  SignalMatchingResponse,
} from './types'

export const portfolioService = {
  async getTaxonomy(context: LaravelContext): Promise<{ status: number; data: TaxonomyData }> {
    return apiClient.get('/portfolio/taxonomy', withLaravelParams(context))
  },

  async getPortfolioStats(context: LaravelContext): Promise<{
    status: number
    data: {
      total_offers: number
      partner_sellable: number
      readiness_confirmed: number
      by_parent_product: Record<string, number>
    }
  }> {
    return apiClient.get('/portfolio/stats', withLaravelParams(context))
  },

  async getOffers(
    context: LaravelContext,
    filters?: {
      search?: string
      parent_product?: string
      readiness_status?: string
      partner_sellable?: boolean
      need?: string
      segment?: string
      page?: number
      per_page?: number
    }
  ): Promise<{
    status: number
    data: {
      data: ProductOffer[]
      current_page: number
      last_page: number
      total: number
      per_page: number
    }
  }> {
    const params: Record<string, string> = {}
    if (filters?.search) params.search = filters.search
    if (filters?.parent_product) params.parent_product = filters.parent_product
    if (filters?.readiness_status) params.readiness_status = filters.readiness_status
    if (filters?.partner_sellable !== undefined) params.partner_sellable = String(filters.partner_sellable)
    if (filters?.need) params.need = filters.need
    if (filters?.segment) params.segment = filters.segment
    if (filters?.page) params.page = String(filters.page)
    if (filters?.per_page) params.per_page = String(filters.per_page)

    return apiClient.get('/portfolio/offers', withLaravelParams(context, params))
  },

  async getOffer(context: LaravelContext, id: string | number): Promise<{ status: number; data: ProductOffer }> {
    return apiClient.get(`/portfolio/offers/${id}`, withLaravelParams(context))
  },

  async createOffer(context: LaravelContext, offer: Partial<ProductOffer>): Promise<{ status: number; message: string; data: ProductOffer }> {
    return apiClient.post('/portfolio/offers', offer, {
      params: withLaravelParams(context),
    })
  },

  async updateOffer(context: LaravelContext, id: string | number, offer: Partial<ProductOffer>): Promise<{ status: number; message: string; data: ProductOffer }> {
    return apiClient.put(`/portfolio/offers/${id}`, offer, {
      params: withLaravelParams(context),
    })
  },

  async deleteOffer(context: LaravelContext, id: string | number): Promise<{ status: number; message: string }> {
    return apiClient.delete(`/portfolio/offers/${id}`, withLaravelParams(context))
  },

  async triggerImport(context: LaravelContext, path?: string): Promise<{ status: number; message: string; data: { imported: number; updated: number; skipped: number } }> {
    return apiClient.post('/portfolio/import', { path }, {
      params: withLaravelParams(context),
    })
  },

  // Partners
  async getPartnerStats(context: LaravelContext): Promise<{
    status: number
    data: {
      total_partners: number
      active_partners: number
      pipeline_partners: number
      total_capacity: number
    }
  }> {
    return apiClient.get('/portfolio/partners/stats', withLaravelParams(context))
  },

  async getPartners(
    context: LaravelContext,
    filters?: {
      search?: string
      partner_type?: string
      status?: string
      state?: string
      segment?: string
      offer?: string
      has_capacity?: boolean
      page?: number
      per_page?: number
    }
  ): Promise<{
    status: number
    data: {
      data: Partner[]
      current_page: number
      last_page: number
      total: number
      per_page: number
    }
  }> {
    const params: Record<string, string> = {}
    if (filters?.search) params.search = filters.search
    if (filters?.partner_type) params.partner_type = filters.partner_type
    if (filters?.status) params.status = filters.status
    if (filters?.state) params.state = filters.state
    if (filters?.segment) params.segment = filters.segment
    if (filters?.offer) params.offer = filters.offer
    if (filters?.has_capacity !== undefined) params.has_capacity = String(filters.has_capacity)
    if (filters?.page) params.page = String(filters.page)
    if (filters?.per_page) params.per_page = String(filters.per_page)

    return apiClient.get('/portfolio/partners', withLaravelParams(context, params))
  },

  async getPartner(context: LaravelContext, id: string | number): Promise<{ status: number; data: Partner }> {
    return apiClient.get(`/portfolio/partners/${id}`, withLaravelParams(context))
  },

  async createPartner(context: LaravelContext, partner: Partial<Partner>): Promise<{ status: number; message: string; data: Partner }> {
    return apiClient.post('/portfolio/partners', partner, {
      params: withLaravelParams(context),
    })
  },

  async updatePartner(context: LaravelContext, id: string | number, partner: Partial<Partner>): Promise<{ status: number; message: string; data: Partner }> {
    return apiClient.put(`/portfolio/partners/${id}`, partner, {
      params: withLaravelParams(context),
    })
  },

  async deletePartner(context: LaravelContext, id: string | number): Promise<{ status: number; message: string }> {
    return apiClient.delete(`/portfolio/partners/${id}`, withLaravelParams(context))
  },

  // Signal & Opportunity Matches
  async getSignalMatches(context: LaravelContext, signalId: number): Promise<{ status: number; data: SignalMatchingResponse }> {
    return apiClient.get(`/signals/${signalId}/opportunity-matches`, withLaravelParams(context))
  },

  async getOpportunityMatches(context: LaravelContext, opportunityId: number): Promise<{ status: number; data: SignalMatchingResponse }> {
    return apiClient.get(`/signals/opportunities/${opportunityId}/opportunity-matches`, withLaravelParams(context))
  },

  async getFindingMatches(context: LaravelContext, findingId: number): Promise<{ status: number; data: SignalMatchingResponse }> {
    return apiClient.get(`/signals/ingestion/findings/${findingId}/opportunity-matches`, withLaravelParams(context))
  },

  async actOnMatch(
    context: LaravelContext,
    payload: {
      signal_type: 'signal' | 'company_opportunity' | 'opportunity' | 'ingestion_finding' | 'ingestion_signal'
      signal_id: number
      offer_id: string
      partner_id?: string | null
      action: 'review' | 'follow-up' | 'dismiss' | 'matched'
      review_notes?: string
    }
  ): Promise<{ status: number; message: string; data: unknown }> {
    return apiClient.post('/signals/matches/action', payload, {
      params: withLaravelParams(context),
    })
  },
}

