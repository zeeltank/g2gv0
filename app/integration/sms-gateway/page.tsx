import { redirect } from 'next/navigation'

export default function IntegrationSmsGatewayPage() {
  redirect('/settings?s=delivery')
}
