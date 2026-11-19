import { redirect } from 'next/navigation'

export default function IntegrationEmailSmtpPage() {
  redirect('/settings?s=delivery')
}
