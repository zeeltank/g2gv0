import { ApiError } from '@/services/core'

/**
 * A refusal from the Organisation 360 API that keeps the whole body. ApiError keeps only message, errors and detail; the 409 of
 * create-crm-organisation also carries a `code` ("deleted_name_exists") and the id of the deleted organisation, and a screen cannot offer
 * "Restore it instead?" without them.
 */
export class OrgAccountsApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    errors: Record<string, string[]> | undefined,
    detail: string | undefined,
    readonly code: string | null,
    readonly deletedOrganizationId: number | null,
  ) {
    super(message, status, errors, detail)
    this.name = 'OrgAccountsApiError'
  }
}

/** True for the 409 that says a deleted CRM organisation holds the name; the caller may ask to restore it. */
export function isDeletedNameConflict(error: unknown): error is OrgAccountsApiError {
  return error instanceof OrgAccountsApiError && error.status === 409 && error.code === 'deleted_name_exists'
}
