import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Clock, Eye, FileText, Layers } from 'lucide-react'
import { Building2, Shield, Users, GraduationCap, UsersRound } from 'lucide-react'

export interface Module {
  id: string
  title: string
  mandatory: boolean
  duration: string
  selected: boolean
  description: string
  screens: number
  features: number
}

interface ModuleCardProps {
  module: Module
  onToggle: (id: string) => void
  onViewOrganization?: () => void
}

function getModuleIcon(id: string) {
  const icons: Record<string, typeof Building2> = {
    organization: Building2,
    competency: Shield,
    talent: Users,
    lms: GraduationCap,
    hrit: UsersRound,
  }
  return icons[id] || Building2
}

function getIconColor(id: string) {
  const colors: Record<string, string> = {
    organization: 'text-primary',
    competency: 'text-success',
    talent: 'text-warning',
    lms: 'text-info',
    hrit: 'text-secondary-foreground',
  }
  return colors[id] || 'text-primary'
}

function getIconBgColor(id: string) {
  const colors: Record<string, string> = {
    organization: 'bg-primary/10',
    competency: 'bg-success/10',
    talent: 'bg-warning/10',
    lms: 'bg-info/10',
    hrit: 'bg-muted/50',
  }
  return colors[id] || 'bg-accent'
}

export function ModuleCard({ module, onToggle, onViewOrganization }: ModuleCardProps) {
  const IconComponent = getModuleIcon(module.id)
  const iconColor = getIconColor(module.id)
  const iconBgColor = getIconBgColor(module.id)

  return (
    <Card
      className={cn(
        'relative w-full pt-4 transition-all hover:scale-[1.02] hover:shadow-lg',
        module.selected
          ? 'border-primary shadow-md'
          : 'border-border shadow-sm hover:border-input',
      )}
    >
      <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
        <Checkbox
          checked={module.selected}
          onChange={() => onToggle(module.id)}
          size="lg"
          className="rounded-full border-foreground/30 bg-background shadow-sm"
          aria-label={`${module.selected ? 'Deselect' : 'Select'} ${module.title}`}
        />
      </div>
      {module.id === 'organization' && onViewOrganization && (
        <button
          type="button"
          onClick={onViewOrganization}
          className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="View Organization Profile"
        >
          <Eye className="size-4" />
        </button>
      )}

      <CardHeader className="items-center px-4 pb-3 pt-2 text-center">
        <div className="flex justify-center">
          <div className={cn('flex size-14 items-center justify-center rounded-full sm:size-16', iconBgColor)}>
            <IconComponent className={cn('size-6 sm:size-7', iconColor)} aria-hidden="true" />
          </div>
        </div>
        <CardTitle className="mt-2 min-h-10 max-w-36 text-center text-sm font-semibold leading-snug text-foreground sm:text-base">
          {module.title}
        </CardTitle>
        <CardDescription>
          <p className="mt-1 text-center text-xs leading-relaxed text-muted-foreground">
            {module.description}
          </p>
        </CardDescription>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        <div className="mx-auto mb-4 h-px w-24 bg-border" aria-hidden="true" />
        <div className="mt-4 flex items-center justify-between gap-2">
          <Badge
            variant={module.mandatory ? 'default' : 'outline'}
            tone={module.mandatory ? 'default' : 'outline'}
          >
            {module.mandatory ? 'Mandatory' : 'Optional'}
          </Badge>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
            <Clock className="size-4" aria-hidden="true" />
            {module.duration}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
