import { redirect } from 'next/navigation'
import { fieldsHref } from '@/lib/platform/fields-tabs'

/**
 * CRM's "Master Fields" screen was merged into Field settings (26 Nov 2026; owner decision): its picklist values, tax rates, lead scoring and assignment, web-to-lead and SLA policy
 * consoles are tabs of /platform-services/fields-configuration?module=crm, beside the custom fields. This address only sends a visitor on, to the first of those tabs. A temporary
 * (307) redirect that stays for ever: a bookmark or a saved link carries it. The menu row behind it (id 202) is deleted by hp_erp's `crm:retire-master-fields-menu` command; on a host
 * that still has it, the sidebar does not draw it (lib/signals-nav.ts).
 */
export default function CrmMasterFieldsRedirect(): never {
  redirect(fieldsHref('picklists'))
}
