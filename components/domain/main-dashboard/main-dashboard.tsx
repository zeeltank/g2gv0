'use client'

import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  FileText,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Funnel,
  FunnelChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { KPICard } from '@/components/shared/business'
import { chartStatusColors } from '@/lib/chart-colors'

const token = (name: string) => `var(${name})`

const dashboardChartColors = {
  blue: chartStatusColors.primary,
  red: chartStatusColors.danger,
  yellow: chartStatusColors.warning,
  green: chartStatusColors.success,
  teal: token('--chart-teal'),
  orange: token('--chart-orange'),
  indigo: token('--chart-indigo'),
  track: token('--chart-track'),
  grid: token('--border'),
  tooltipCursor: token('--surface-muted'),
  axis: token('--muted-foreground'),
} as const

const metricCards = [
  {
    label: 'Total Employees',
    value: '12,548',
    trend: { value: 4.2, direction: 'up' as const, label: 'Compared to last month' },
    icon: <Users className="size-5 text-primary" />,
  },
  {
    label: 'Attendance Today',
    value: '98.4',
    unit: '%',
    trend: { value: 1.8, direction: 'up' as const, label: 'Compared to yesterday' },
    icon: <CalendarDays className="size-5 text-success" />,
  },
  {
    label: 'Pending Approvals',
    value: '86',
    trend: { value: 12.5, direction: 'down' as const, label: 'Requires your attention' },
    icon: <ClipboardCheck className="size-5 text-warning" />,
  },
  {
    label: 'Open Positions',
    value: '142',
    trend: { value: 5.3, direction: 'up' as const, label: 'Active job openings' },
    icon: <BriefcaseBusiness className="size-5 text-primary" />,
  },
  {
    label: 'Compliance Rate',
    value: '97',
    unit: '%',
    trend: { value: 2.1, direction: 'up' as const, label: 'Policy compliance' },
    icon: <ShieldCheck className="size-5 text-success" />,
  },
  {
    label: 'Overdue Tasks',
    value: '31',
    trend: { value: 19.2, direction: 'down' as const, label: 'Past due tasks' },
    icon: <CheckSquare className="size-5 text-destructive" />,
  },
]

const actionItems = [
  { count: '18', label: 'Leave Requests', state: 'Needs Approval', variant: 'destructive' as const },
  { count: '96', label: 'Performance Reviews', state: 'Pending Review', variant: 'warning' as const },
  { count: '12', label: 'Mobility Requests', state: 'Pending Action', variant: 'warning' as const },
  { count: '7', label: 'Compliance Violations', state: 'Requires Attention', variant: 'destructive' as const },
  { count: '21', label: 'Expiring Certifications', state: 'Expiring Soon', variant: 'warning' as const },
  { count: '31', label: 'Blocked Tasks', state: 'Needs Unblock', variant: 'destructive' as const },
]

const workforceData = [
  { month: 'Dec 2024', present: 9800, leave: 820, absent: 620, attendance: 96 },
  { month: 'Jan 2025', present: 10400, leave: 900, absent: 710, attendance: 97 },
  { month: 'Feb 2025', present: 9600, leave: 760, absent: 610, attendance: 95 },
  { month: 'Mar 2025', present: 10150, leave: 790, absent: 580, attendance: 95 },
  { month: 'Apr 2025', present: 9900, leave: 880, absent: 640, attendance: 95 },
  { month: 'May 2025', present: 9700, leave: 820, absent: 590, attendance: 97 },
]

const funnelData = [
  { value: 1253, name: 'Applications', fill: dashboardChartColors.blue },
  { value: 876, name: 'Screening', fill: dashboardChartColors.teal },
  { value: 432, name: 'Interview', fill: dashboardChartColors.green },
  { value: 140, name: 'Offer', fill: dashboardChartColors.yellow },
  { value: 65, name: 'Hired', fill: dashboardChartColors.red },
]

const learningStats = [
  { label: 'On Track', value: 84, caption: '256 / 304', variant: 'primary' as const },
  { label: 'Excellent', value: 91, caption: '125 / 137', variant: 'success' as const },
  { label: 'On Track', value: 78, caption: '342 / 438', variant: 'indigo' as const },
]

const moduleSummaries = [
  { title: 'Organization', labelA: 'Departments', valueA: '24', labelB: 'Employees', valueB: '12,548', labelC: 'Roles', valueC: '87', icon: <Building2 className="size-5 text-primary" /> },
  { title: 'Competency', labelA: 'Frameworks', valueA: '18', labelB: 'Assessments', valueB: '342', labelC: 'Skills', valueC: '1,256', icon: <Target className="size-5 text-success" /> },
  { title: 'Talent', labelA: 'Open Positions', valueA: '142', labelB: 'Candidates', valueB: '1,253', labelC: 'Onboarding', valueC: '21', icon: <Users className="size-5 text-primary" /> },
  { title: 'LMS', labelA: 'Courses', valueA: '256', labelB: 'In Progress', valueB: '1,248', labelC: 'Completed', valueC: '3,456', icon: <GraduationCap className="size-5 text-warning" /> },
  { title: 'HRIT', labelA: 'Attendance', valueA: '98.4%', labelB: 'Leave Requests', valueB: '86', labelC: 'Payroll Runs', valueC: 'Complete', icon: <CalendarDays className="size-5 text-success" /> },
  { title: 'Tasks', labelA: 'Total Tasks', valueA: '542', labelB: 'Completed', valueB: '376', labelC: 'Overdue', valueC: '31', icon: <CheckSquare className="size-5 text-destructive" /> },
]

const insights = [
  { text: 'Attendance rate dropped by 2% in Marketing Department.', className: 'text-success' },
  { text: 'You have 18 leave requests pending approval.', className: 'text-warning' },
  { text: '31 tasks are overdue across 7 projects.', className: 'text-destructive' },
  { text: '5 employees are eligible for promotion review.', className: 'text-success' },
  { text: 'Compliance certificate for ISO 27001 expires in 9 days.', className: 'text-warning' },
]

const events = [
  ['18 Jun', 'Company Holiday', 'Independence Day', 'All Day'],
  ['19 Jun', 'Leadership Training Program', '9:00 AM - 4:00 PM', 'Conference Room A'],
  ['20 Jun', 'Candidate Interview', '10:00 AM - 12:00 PM', 'HR Office'],
  ['21 Jun', 'Payroll Processing', 'End of Month Payroll', 'All Day'],
  ['22 Jun', 'Compliance Training Deadline', 'ISO 27001 Training', 'All Day'],
]

const departmentData = [
  { name: 'Engineering', value: 3245 },
  { name: 'Sales & Marketing', value: 2850 },
  { name: 'Operations', value: 2150 },
  { name: 'Finance', value: 1450 },
  { name: 'HR', value: 1120 },
  { name: 'Others', value: 1733 },
]

const departmentColors = [
  dashboardChartColors.blue,
  dashboardChartColors.green,
  dashboardChartColors.yellow,
  dashboardChartColors.orange,
  dashboardChartColors.indigo,
  dashboardChartColors.teal,
]

function SectionLink({ children }: { children: string }) {
  return (
    <Button variant="link" size="sm" className="h-auto px-0 text-xs">
      {children}
      <ArrowRight className="size-3" aria-hidden="true" />
    </Button>
  )
}

function Widget({
  title,
  children,
  action,
  className,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 p-4 pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="p-4 pt-2">{children}</CardContent>
    </Card>
  )
}

function RingMetric({
  label,
  value,
  caption,
  variant,
}: {
  label: string
  value: number
  caption: string
  variant: 'primary' | 'success' | 'indigo'
}) {
  const ringColor = {
    primary: dashboardChartColors.blue,
    success: dashboardChartColors.green,
    indigo: dashboardChartColors.indigo,
  }[variant]

  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-2">
      <div className="relative size-28" aria-label={`${label} ${value}%`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[
                { name: label, value },
                { name: 'Remaining', value: 100 - value },
              ]}
              dataKey="value"
              innerRadius={39}
              outerRadius={50}
              startAngle={90}
              endAngle={-270}
            >
              <Cell fill={ringColor} />
              <Cell fill={dashboardChartColors.track} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center text-center">
          <span className="text-2xl font-bold text-foreground">{value}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{caption}</p>
      </div>
    </div>
  )
}

export function MainDashboard() {
  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Good Morning, John!</h1>
          <p className="text-sm text-muted-foreground">
            Here is what is happening across your organization today.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[10rem_10rem_10rem_auto_auto]">
          <Select
            value="all-units"
            onChange={() => undefined}
            aria-label="Business unit"
            options={[{ label: 'All Units', value: 'all-units' }]}
          />
          <Select
            value="all-departments"
            onChange={() => undefined}
            aria-label="Department"
            options={[{ label: 'All Departments', value: 'all-departments' }]}
          />
          <Select
            value="all-locations"
            onChange={() => undefined}
            aria-label="Location"
            options={[{ label: 'All Locations', value: 'all-locations' }]}
          />
          <Button variant="outline" size="default">
            <CalendarDays className="size-4" aria-hidden="true" />
            May 15, 2025
          </Button>
          <Button size="default">
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {metricCards.map((item) => (
          <KPICard
            key={item.label}
            label={item.label}
            value={item.value}
            unit={item.unit}
            trend={item.trend}
            icon={item.icon}
            size="sm"
          />
        ))}
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.05fr_1.6fr_1.2fr]">
        <Widget title="Action Center">
          <div className="space-y-2">
            {actionItems.map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-md px-1 py-1">
                <Badge variant={item.variant} className="min-w-9 justify-center">
                  {item.count}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.label}</span>
                <span className="hidden text-xs text-muted-foreground sm:inline">{item.state}</span>
                <ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" />
              </div>
            ))}
          </div>
          <div className="mt-3 text-center">
            <SectionLink>View All Actions</SectionLink>
          </div>
        </Widget>

        <Widget
          title="Workforce & Attendance Overview"
          action={<Badge variant="muted">Last 6 Months</Badge>}
        >
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={workforceData}>
                <CartesianGrid stroke={dashboardChartColors.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: dashboardChartColors.axis }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="count" tick={{ fontSize: 11, fill: dashboardChartColors.axis }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="rate" orientation="right" domain={[80, 100]} tick={{ fontSize: 11, fill: dashboardChartColors.axis }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} />
                <Tooltip cursor={{ fill: dashboardChartColors.tooltipCursor }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="count" dataKey="present" name="Present" fill={dashboardChartColors.blue} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="count" dataKey="absent" name="Absent" fill={dashboardChartColors.red} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="count" dataKey="leave" name="Leave" fill={dashboardChartColors.yellow} radius={[4, 4, 0, 0]} />
                <Line yAxisId="rate" type="monotone" dataKey="attendance" name="Attendance %" stroke={dashboardChartColors.green} strokeWidth={2.5} dot={{ r: 3, fill: dashboardChartColors.green, strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center">
            <SectionLink>View Attendance Dashboard</SectionLink>
          </div>
        </Widget>

        <Widget title="AI Insights" action={<Badge variant="navy">New</Badge>}>
          <div className="space-y-2">
            {insights.map((insight) => (
              <div key={insight.text} className="flex gap-3 rounded-md border border-border p-2">
                <BadgeCheck className={`mt-0.5 size-4 shrink-0 ${insight.className}`} aria-hidden="true" />
                <p className="text-sm text-foreground">{insight.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button size="sm">Generate Report</Button>
            <Button size="sm" variant="outline">Open Analytics</Button>
          </div>
        </Widget>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1fr_1.25fr_1fr]">
        <Widget title="Talent Acquisition Funnel" action={<Badge variant="muted">This Quarter</Badge>}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip />
                  <Funnel dataKey="value" data={funnelData} isAnimationActive>
                    {funnelData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {funnelData.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-semibold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center">
            <SectionLink>View Recruitment Dashboard</SectionLink>
          </div>
        </Widget>

        <Widget title="Learning Progress Overview">
          <div className="grid gap-4 sm:grid-cols-3">
            {learningStats.map((item) => (
              <RingMetric key={item.caption} label={item.label} value={item.value} caption={item.caption} variant={item.variant} />
            ))}
          </div>
          <div className="mt-3 text-center">
            <SectionLink>Go to Learning Dashboard</SectionLink>
          </div>
        </Widget>

        <Widget title="Upcoming Events">
          <div className="space-y-2">
            {events.map(([date, title, subtitle, time]) => (
              <div key={`${date}-${title}`} className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-3 rounded-md border border-border p-2">
                <Badge variant="outline" className="justify-center">{date}</Badge>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                  <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block">{time}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-center">
            <SectionLink>View Calendar</SectionLink>
          </div>
        </Widget>
      </section>

      <Widget title="Module Summary">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {moduleSummaries.map((module) => (
            <div key={module.title} className="rounded-lg border border-border p-3">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-md bg-muted">{module.icon}</span>
                <p className="font-semibold text-foreground">{module.title}</p>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{module.labelA}</span>
                  <span className="font-medium text-foreground">{module.valueA}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{module.labelB}</span>
                  <span className="font-medium text-foreground">{module.valueB}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{module.labelC}</span>
                  <span className="font-medium text-foreground">{module.valueC}</span>
                </div>
              </div>
              <Separator className="my-3" />
              <SectionLink>Open Module</SectionLink>
            </div>
          ))}
        </div>
      </Widget>

      <section className="grid gap-3 xl:grid-cols-[1.25fr_1.1fr_1fr]">
        <Widget title="Recent Activity">
          <div className="space-y-2">
            {[
              'Leave request approved for Sarah Johnson',
              'Interview scheduled for Product Manager role',
              'Employee onboarding completed for Michael Brown',
              'Performance review submitted by Emily Davis',
              'New task assigned in Website Redesign project',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm">
                <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-foreground">{item}</span>
                <span className="text-xs text-muted-foreground">Today</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-center">
            <SectionLink>View All Activity</SectionLink>
          </div>
        </Widget>

        <Widget title="Quick Actions">
          <div className="grid grid-cols-3 gap-2">
            {[
              [Users, 'Add Employee'],
              [CalendarDays, 'Apply Leave'],
              [CheckSquare, 'Create Task'],
              [Target, 'Assign Course'],
              [BriefcaseBusiness, 'Post Job'],
              [FileText, 'Run Payroll'],
              [BarChart3, 'Generate Report'],
              [ClipboardCheck, 'Request Approval'],
            ].map(([Icon, label]) => (
              <Button key={String(label)} variant="outline" className="h-16 flex-col gap-1 text-xs">
                <Icon className="size-4" aria-hidden="true" />
                {label as string}
              </Button>
            ))}
          </div>
        </Widget>

        <Widget title="Top Departments by Headcount">
          <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={departmentData} dataKey="value" innerRadius={38} outerRadius={64} paddingAngle={2}>
                    {departmentData.map((entry, index) => (
                      <Cell key={entry.name} fill={departmentColors[index % departmentColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1">
              {departmentData.map((dept, index) => (
                <div key={dept.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: departmentColors[index] }} />
                    <span className="truncate">{dept.name}</span>
                  </span>
                  <span className="font-medium text-foreground">{dept.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center">
            <SectionLink>View Organization Chart</SectionLink>
          </div>
        </Widget>
      </section>
    </div>
  )
}
