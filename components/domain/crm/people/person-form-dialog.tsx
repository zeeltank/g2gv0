/**
 * The Add person / Edit person dialog of the S18 mock-up. It IS the former Create Contact modal, extended in place (components/domain/crm/create-contact-modal.tsx):
 * one dialog, not two, so a field added to a person is added once. This file is the name the People screens import it under.
 */
export { CreateContactModal as PersonFormDialog, personPayload, type PersonFormPicklists } from '../create-contact-modal'
