import { PersonAddressRoute } from '@/domain/crm/person-address-redirect'

/** The Support area's old person address (S18, 25 Nov 2026): the same redirect, keeping the Support area. */
export default function CrmSupportContactDetailRedirect() {
  return <PersonAddressRoute area="support" />
}
