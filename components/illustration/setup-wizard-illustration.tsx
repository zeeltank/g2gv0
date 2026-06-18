export function SetupWizardIllustration({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src="/setup_wizard.svg"
        alt="Setup wizard illustration"
        className="h-auto w-full max-w-full object-contain"
      />
    </div>
  )
}
