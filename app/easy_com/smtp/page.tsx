import { redirect } from 'next/navigation'

export default function EasyComSmtpPage() {
  redirect('/settings?s=delivery')
}
