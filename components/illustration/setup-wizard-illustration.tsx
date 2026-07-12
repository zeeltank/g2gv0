'use client'

import Image from 'next/image'

export function SetupWizardIllustration({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Image
        src="/setup_wizard.svg"
        alt="Setup wizard illustration"
        width={800}
        height={600}
        className="h-auto w-full max-w-full object-contain"
      />
    </div>
  )
}
