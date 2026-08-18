'use client'

import React, { useState } from 'react'
import {
  AlertTriangle,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Bell,
  Flame,
  Layers,
  Target,
  Trophy,
  Users,
} from 'lucide-react'
import { CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type {
  AchievementsData,
  LearningActivity,
  LearningStreakData,
  PeerComparisonData,
  SkillProgressData,
  WeeklyGoalData,
} from '@/services/lms'
import { WidgetLink, WidgetLoading, WidgetMessage, WidgetShell } from './shared'

/* ------------------------------------------------------------------ *
 * Recent activity
 * ------------------------------------------------------------------ */

const ACTIVITY_ICON: Record<string, React.ElementType> = {
  course_completed: CheckCircle2,
  course_enrolled: BookOpen,
  deadline_due: Bell,
  session_upcoming: CalendarDays,
}

const ACTIVITY_TONE: Record<string, string> = {
  success: 'bg-success/15 text-success',
  primary: 'bg-primary/15 text-primary',
  warning: 'bg-warning/15 text-warning',
  neutral: 'bg-muted text-muted-foreground',
}

function ActivityRow({ activity, showConnector }: { activity: LearningActivity; showConnector: boolean }) {
  const Icon = ACTIVITY_ICON[activity.type] ?? BookOpen

  return (
    <div className="relative flex gap-4">
      {showConnector && (
        <div className="absolute bottom-[-24px] left-[15px] top-[30px] z-0 w-px border-l-2 border-dashed border-border/60" />
      )}
      <div className="relative z-10 mt-0.5 shrink-0">
        <div
          className={cn(
            'flex size-8 items-center justify-center rounded-full',
            ACTIVITY_TONE[activity.tone] ?? ACTIVITY_TONE.neutral,
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-[13px] font-medium leading-relaxed text-foreground">{activity.text}</p>
        <span className="text-[11px] font-semibold text-muted-foreground">{activity.time}</span>
      </div>
    </div>
  )
}

export function RecentActivityWidget({
  activities,
  loading,
  error,
}: {
  activities: LearningActivity[]
  loading: boolean
  error: string | null
}) {
  const [open, setOpen] = useState(false)
  const preview = activities.slice(0, 5)

  return (
    <>
      <WidgetShell
        title="Recent Activity"
        headerAction={
          activities.length > preview.length ? (
            <WidgetLink label="View All" onClick={() => setOpen(true)} />
          ) : null
        }
      >
        {loading ? (
          <WidgetLoading />
        ) : error ? (
          <WidgetMessage icon={AlertTriangle} tone="danger" title="Couldn't load activity" description={error} />
        ) : preview.length === 0 ? (
          <WidgetMessage
            icon={Layers}
            title="No recent activity"
            description="Your enrolments and scheduled events will appear here."
          />
        ) : (
          <CardContent className="flex-1 overflow-auto p-5">
            <div className="flex flex-col gap-6">
              {preview.map((activity, index) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  showConnector={index !== preview.length - 1}
                />
              ))}
            </div>
          </CardContent>
        )}
      </WidgetShell>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Recent Activity</SheetTitle>
            <SheetDescription>
              Derived from your enrolments and the learning calendar.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-6 pt-2">
            {activities.map((activity, index) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                showConnector={index !== activities.length - 1}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Achievements
 * ------------------------------------------------------------------ */

function AchievementRow({ achievement }: { achievement: AchievementsData['achievements'][number] }) {
  return (
    <div className="flex items-start gap-3 border-b border-border/50 px-5 py-3.5 last:border-b-0 hover:bg-muted/30">
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          achievement.earned ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground/60',
        )}
      >
        <Trophy className="size-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h4 className="truncate text-sm font-semibold leading-tight text-foreground">
          {achievement.title}
        </h4>
        <p className="line-clamp-2 text-[11px] font-medium text-muted-foreground">
          {achievement.description}
        </p>
        <p className="text-[11px] font-semibold text-muted-foreground">
          {achievement.earned && achievement.earned_date
            ? `Earned ${achievement.earned_date}`
            : achievement.progress}
        </p>
      </div>
      <StatusBadge
        variant={achievement.earned ? 'success' : 'inactive'}
        size="sm"
        className="shrink-0 text-[10px] font-bold uppercase tracking-wider"
      >
        {achievement.earned ? 'Earned' : 'Locked'}
      </StatusBadge>
    </div>
  )
}

export function AchievementsWidget({
  achievements,
  loading,
  error,
}: {
  achievements: AchievementsData | null
  loading: boolean
  error: string | null
}) {
  const [open, setOpen] = useState(false)
  const all = achievements?.achievements ?? []
  const earned = all.filter((achievement) => achievement.earned).length

  return (
    <>
      <WidgetShell
        title="Achievements"
        headerAction={all.length > 0 ? <WidgetLink label="View All" onClick={() => setOpen(true)} /> : null}
        footerAction={
          all.length > 0 ? (
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs font-semibold text-muted-foreground">Earned</span>
              <span className="text-sm font-black text-foreground">
                {earned}
                <span className="text-muted-foreground"> / {all.length}</span>
              </span>
            </div>
          ) : null
        }
      >
        {loading ? (
          <WidgetLoading />
        ) : error ? (
          <WidgetMessage icon={AlertTriangle} tone="danger" title="Couldn't load achievements" description={error} />
        ) : all.length === 0 ? (
          <WidgetMessage
            icon={Award}
            title="No achievements configured"
            description="Your organisation has not defined any learning achievements yet."
          />
        ) : (
          <CardContent className="flex-1 overflow-auto p-0">
            {all.slice(0, 4).map((achievement, index) => (
              <AchievementRow key={`${achievement.title}-${index}`} achievement={achievement} />
            ))}
          </CardContent>
        )}
      </WidgetShell>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="p-6 pb-2">
            <SheetTitle>Achievements</SheetTitle>
            <SheetDescription>
              {earned} of {all.length} earned.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col">
            {all.map((achievement, index) => (
              <AchievementRow key={`${achievement.title}-${index}`} achievement={achievement} />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Skill progress
 * ------------------------------------------------------------------ */

const PROFICIENCY_VARIANT = {
  Beginner: 'inactive',
  Intermediate: 'processing',
  Advanced: 'success',
} as const

export function SkillProgressWidget({
  skillProgress,
  loading,
  error,
}: {
  skillProgress: SkillProgressData | null
  loading: boolean
  error: string | null
}) {
  const skills = skillProgress?.skill_progress ?? []
  const overall = skillProgress?.overall

  return (
    <WidgetShell
      title="Skill Progress"
      headerAction={
        overall && overall.total_skills > 0 ? (
          <span className="text-xs font-semibold text-muted-foreground">
            {overall.overall_progress_percentage}% overall
          </span>
        ) : null
      }
    >
      {loading ? (
        <WidgetLoading />
      ) : error ? (
        <WidgetMessage icon={AlertTriangle} tone="danger" title="Couldn't load skill progress" description={error} />
      ) : skills.length === 0 ? (
        <WidgetMessage
          icon={Target}
          title="No skills mapped yet"
          description="Skills assigned to you in the competency matrix will show their progress here."
        />
      ) : (
        <CardContent className="flex-1 overflow-auto p-5">
          <div className="flex flex-col gap-4">
            {skills.map((skill, index) => (
              <div key={`${skill.skill_name}-${index}`} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {skill.skill_name}
                    </span>
                    {skill.sub_category && (
                      <span className="truncate text-[11px] font-medium text-muted-foreground">
                        {skill.sub_category}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge
                      variant={PROFICIENCY_VARIANT[skill.proficiency_level] ?? 'inactive'}
                      size="sm"
                      className="text-[10px] font-bold uppercase tracking-wider"
                    >
                      {skill.proficiency_level}
                    </StatusBadge>
                    <span className="w-9 text-right text-xs font-bold text-foreground">
                      {skill.progress_percentage}%
                    </span>
                  </div>
                </div>
                <Progress
                  value={skill.progress_percentage}
                  className="h-1.5 bg-muted-foreground/20 [&>div]:bg-primary"
                />
                <span className="text-[11px] font-medium text-muted-foreground">
                  {skill.courses_completed} of {skill.total_courses} courses completed
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </WidgetShell>
  )
}

/* ------------------------------------------------------------------ *
 * Learning stats (streak + weekly goal + peer rank)
 * ------------------------------------------------------------------ */

function StatBlock({
  icon: Icon,
  label,
  value,
  caption,
  progress,
  tone,
}: {
  icon: React.ElementType
  label: string
  value: string
  caption: string
  progress?: number
  tone: 'primary' | 'success' | 'warning'
}) {
  const toneClass =
    tone === 'success' ? 'bg-success/15 text-success' : tone === 'warning' ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'
  const barClass =
    tone === 'success' ? '[&>div]:bg-success' : tone === 'warning' ? '[&>div]:bg-warning' : '[&>div]:bg-primary'

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/20 p-4">
      <div className="flex items-center gap-3">
        <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', toneClass)}>
          <Icon className="size-4" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <span className="text-lg font-black leading-tight text-foreground">{value}</span>
        </div>
      </div>
      {typeof progress === 'number' && (
        <Progress
          value={Math.min(Math.max(progress, 0), 100)}
          className={cn('h-1.5 bg-muted-foreground/20', barClass)}
        />
      )}
      <span className="text-[11px] font-medium text-muted-foreground">{caption}</span>
    </div>
  )
}

export function LearningStatsWidget({
  streak,
  weeklyGoal,
  peerComparison,
  loading,
  error,
}: {
  streak: LearningStreakData | null
  weeklyGoal: WeeklyGoalData | null
  peerComparison: PeerComparisonData | null
  loading: boolean
  error: string | null
}) {
  const hasAny = streak || weeklyGoal || peerComparison

  return (
    <WidgetShell title="Learning Stats">
      {loading ? (
        <WidgetLoading rows={3} />
      ) : error ? (
        <WidgetMessage icon={AlertTriangle} tone="danger" title="Couldn't load learning stats" description={error} />
      ) : !hasAny ? (
        <WidgetMessage
          icon={Flame}
          title="No stats yet"
          description="Your streak, weekly hours and peer standing appear once you have activity."
        />
      ) : (
        <CardContent className="grid flex-1 gap-3 overflow-auto p-5 sm:grid-cols-2 xl:grid-cols-3">
          {streak && (
            <StatBlock
              icon={Flame}
              tone="warning"
              label="Current Streak"
              value={`${streak.current_streak} ${streak.current_streak === 1 ? 'day' : 'days'}`}
              progress={streak.progress_percentage}
              caption={
                streak.days_to_go > 0
                  ? `${streak.days_to_go} days to your ${streak.goal}-day goal · best ${streak.best_streak}`
                  : `Goal of ${streak.goal} days reached · best ${streak.best_streak}`
              }
            />
          )}
          {weeklyGoal && (
            <StatBlock
              icon={Target}
              tone="primary"
              label="Hours This Week"
              value={`${weeklyGoal.current_hours} / ${weeklyGoal.goal_hours} h`}
              progress={weeklyGoal.progress_percentage}
              caption={
                weeklyGoal.remaining_hours > 0
                  ? `${weeklyGoal.remaining_hours} h remaining this week`
                  : 'Weekly goal reached'
              }
            />
          )}
          {peerComparison && (
            <StatBlock
              icon={Users}
              tone="success"
              label="Peer Standing"
              value={`#${peerComparison.rank} of ${peerComparison.total_peers}`}
              progress={peerComparison.percentile}
              caption={peerComparison.message}
            />
          )}
        </CardContent>
      )}
    </WidgetShell>
  )
}
