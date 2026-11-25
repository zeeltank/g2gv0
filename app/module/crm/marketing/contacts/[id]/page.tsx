import { PersonAddressRoute } from '@/domain/crm/person-address-redirect'

/**
 * A person's old address (S18, 25 Nov 2026: Contacts were merged into Organizations). The page reads the person and sends the visitor to the company's People tab, or to
 * All people when the person has no company. It stays for ever: a saved link, an Ask answer and a bookmark carry the old address.
 */
export default function CrmContactDetailRedirect() {
  return <PersonAddressRoute area="marketing" />
}
