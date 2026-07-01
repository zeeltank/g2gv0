'use client'

import React, { useState } from 'react'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  CheckCircle2,
  Circle,
  Clock,
  CalendarDays,
  BookOpen,
  MessageSquare,
  ClipboardCheck,
  StickyNote,
  Lock,
  PlayCircle,
  Award,
  Info,
  Plus,
  Send,
  Subtitles,
  Image as ImageIcon,
  Pencil,
  Trash2,
  Save,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/ui/status-badge'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lesson {
  id: string
  moduleId: string
  title: string
  type: 'video' | 'quiz' | 'document' | 'interactive'
  duration: string
  status: 'completed' | 'in-progress' | 'not-started' | 'locked'
  order: number
}

interface CourseModule {
  id: string
  title: string
  lessons: Lesson[]
  order: number
}

interface CourseMaterial {
  id: string
  name: string
  size: string
  type: string
}

interface Note {
  id: string
  timestamp: string
  lessonTitle: string
  content: string
  createdAt: string
}

interface DiscussionMessage {
  id: string
  author: string
  initials: string
  content: string
  timestamp: string
  replies: number
  isInstructor?: boolean
}

interface Assessment {
  id: string
  title: string
  type: 'quiz' | 'assignment' | 'final-exam'
  questions: number
  duration: string
  status: 'completed' | 'not-started' | 'in-progress'
  score?: number
  passingScore: number
  attempts: number
  maxAttempts: number
  associatedLesson?: string
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const COURSE_DATA = {
  id: 'course-001',
  title: 'Effective Communication Skills',
  type: 'Course',
  duration: '2h 45m',
  language: 'English',
  dueDate: '28 Jun 2025',
  daysLeft: 10,
  status: 'In Progress' as const,
  completedLessons: 2,
  totalLessons: 5,
  inProgressLessons: 1,
  notStartedLessons: 2,
  totalDuration: '2h 45m',
  timeSpent: '1h 8m',
  progressPercent: 40,
}

const COURSE_MODULES: CourseModule[] = [
  {
    id: 'mod-1',
    title: 'Module 1: Fundamentals of Communication',
    order: 1,
    lessons: [
      { id: 'l-1', moduleId: 'mod-1', title: '1.1 Introduction to Effective Communication', type: 'video', duration: '15m', status: 'completed', order: 1 },
      { id: 'l-2', moduleId: 'mod-1', title: '1.2 Barriers to Communication', type: 'video', duration: '12m', status: 'in-progress', order: 2 },
      { id: 'l-3', moduleId: 'mod-1', title: '1.3 Communication Basics Quiz', type: 'quiz', duration: '10 Questions', status: 'not-started', order: 3 },
    ],
  },
  {
    id: 'mod-2',
    title: 'Module 2: Verbal Communication',
    order: 2,
    lessons: [
      { id: 'l-4', moduleId: 'mod-2', title: '2.1 Verbal Communication', type: 'video', duration: '15m', status: 'not-started', order: 1 },
      { id: 'l-5', moduleId: 'mod-2', title: '2.2 Active Listening Skills', type: 'video', duration: '18m', status: 'locked', order: 2 },
      { id: 'l-6', moduleId: 'mod-2', title: '2.3 Verbal Communication Assessment', type: 'quiz', duration: '15 Questions', status: 'locked', order: 3 },
    ],
  },
  {
    id: 'mod-3',
    title: 'Module 3: Non-Verbal & Written Communication',
    order: 3,
    lessons: [
      { id: 'l-7', moduleId: 'mod-3', title: '3.1 Body Language & Non-Verbal Cues', type: 'video', duration: '20m', status: 'locked', order: 1 },
      { id: 'l-8', moduleId: 'mod-3', title: '3.2 Professional Writing Skills', type: 'document', duration: '25m', status: 'locked', order: 2 },
      { id: 'l-9', moduleId: 'mod-3', title: '3.3 Final Assessment', type: 'quiz', duration: '20 Questions', status: 'locked', order: 3 },
    ],
  },
]

const MATERIALS: CourseMaterial[] = [
  { id: 'mat-1', name: 'Participant Guide.pdf', size: '2.4 MB', type: 'PDF' },
  { id: 'mat-2', name: 'Communication Models.pdf', size: '1.8 MB', type: 'PDF' },
  { id: 'mat-3', name: 'Checklist.pdf', size: '1.2 MB', type: 'PDF' },
]

const ASSESSMENTS: Assessment[] = [
  { id: 'a-1', title: 'Communication Basics Quiz', type: 'quiz', questions: 10, duration: '15m', status: 'not-started', passingScore: 70, attempts: 0, maxAttempts: 3, associatedLesson: '1.3' },
  { id: 'a-2', title: 'Verbal Communication Assessment', type: 'quiz', questions: 15, duration: '20m', status: 'not-started', passingScore: 75, attempts: 0, maxAttempts: 2, associatedLesson: '2.3' },
  { id: 'a-3', title: 'Final Course Assessment', type: 'final-exam', questions: 20, duration: '30m', status: 'not-started', passingScore: 80, attempts: 0, maxAttempts: 2 },
]

const NOTES: Note[] = [
  { id: 'n-1', timestamp: '02:15', lessonTitle: '1.1 Introduction to Effective Communication', content: 'Key insight: Communication is 55% body language, 38% tone, and only 7% words.', createdAt: '25 Jun 2025' },
  { id: 'n-2', timestamp: '08:42', lessonTitle: '1.1 Introduction to Effective Communication', content: 'Remember to practice the "mirror technique" in the next team meeting.', createdAt: '25 Jun 2025' },
]

const DISCUSSIONS: DiscussionMessage[] = [
  { id: 'd-1', author: 'Priya Sharma', initials: 'PS', content: 'Can anyone share tips on how to overcome public speaking anxiety? I found lesson 1.1 very helpful but want more practice ideas.', timestamp: '2 hours ago', replies: 3 },
  { id: 'd-2', author: 'Sarah Johnson', initials: 'SJ', content: 'The section on active listening was eye-opening. I recommend the recommended reading materials as well.', timestamp: '5 hours ago', replies: 1, isInstructor: true },
  { id: 'd-3', author: 'Rahul Verma', initials: 'RV', content: 'Is there a study group forming for the final assessment? Would love to prepare together.', timestamp: '1 day ago', replies: 5 },
]

// ─── Sub-Components ──────────────────────────────────────────────────────────

// Radial progress indicator for the course progress card
function RadialProgress({ value, size = 80 }: { value: number; size?: number }) {
  const strokeWidth = 7
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/60"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-primary transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black tracking-tight text-foreground leading-none">{value}%</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">Completed</span>
      </div>
    </div>
  )
}

// Course video player placeholder
function CoursePlayer({
  currentLesson,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}: {
  currentLesson: Lesson
  onPrevious: () => void
  onNext: () => void
  hasPrevious: boolean
  hasNext: boolean
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState('10:15')
  const [totalTime] = useState('45:00')
  const [progressValue, setProgressValue] = useState(23)

  return (
    <div className="flex flex-col gap-4">
      {/* Player Area */}
      <div className="relative w-full aspect-video bg-foreground/95 rounded-xl overflow-hidden group">
        {/* Simulated video player */}
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex size-16 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm text-white transition-all hover:bg-white/25 hover:scale-105"
          >
            {isPlaying ? (
              <Pause className="size-7" />
            ) : (
              <Play className="size-7 ml-1" />
            )}
          </button>
        </div>

        {/* Controls Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-3 pt-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {/* Progress bar */}
          <div className="w-full mb-3">
            <div className="relative h-1 bg-white/20 rounded-full cursor-pointer group/bar hover:h-1.5 transition-all">
              <div
                className="absolute top-0 left-0 h-full rounded-full bg-primary transition-all"
                style={{ width: `${progressValue}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 size-3 rounded-full bg-white shadow-md transition-opacity opacity-0 group-hover/bar:opacity-100"
                style={{ left: `${progressValue}%`, transform: `translateX(-50%) translateY(-50%)` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="text-white/90 hover:text-white transition-colors"
              >
                {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              <button onClick={() => setIsMuted(!isMuted)} className="text-white/90 hover:text-white transition-colors">
                {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
              <span className="text-xs font-medium text-white/80 tabular-nums">
                {currentTime} / {totalTime}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-white/90 hover:text-white transition-colors">
                <Subtitles className="size-4" />
              </button>
              <span className="text-[11px] font-bold text-white/80 px-1.5 py-0.5 rounded bg-white/10">1x</span>
              <button className="text-white/90 hover:text-white transition-colors">
                <Maximize2 className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lesson Info + Navigation */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="text-base font-bold text-foreground leading-snug truncate">
            {currentLesson.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Understand the fundamentals of communication and why it is essential in personal and professional life.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrevious}
            onClick={onPrevious}
            className="gap-1"
          >
            <ChevronLeft className="size-3.5" /> Previous
          </Button>
          <Button
            size="sm"
            disabled={!hasNext}
            onClick={onNext}
            className="gap-1"
          >
            Next <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Lesson Progress Bar */}
      <Card className="rounded-lg border-border/60 shadow-none">
        <CardContent className="p-3 flex items-center gap-3">
          <span className="text-xs font-bold text-foreground whitespace-nowrap">Lesson Progress</span>
          <Progress value={20} className="h-2 flex-1 bg-muted-foreground/15 [&>div]:bg-primary" />
          <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
            1 of 5 completed
          </span>
        </CardContent>
      </Card>
    </div>
  )
}

// What's Next - upcoming lessons carousel
function WhatsNextSection({
  lessons,
  onLessonSelect,
}: {
  lessons: Lesson[]
  onLessonSelect: (lesson: Lesson) => void
}) {
  const upcoming = lessons.filter(l => l.status === 'not-started' || l.status === 'in-progress').slice(0, 4)

  if (upcoming.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-foreground">What's Next</h3>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {upcoming.map((lesson) => (
          <button
            key={lesson.id}
            onClick={() => onLessonSelect(lesson)}
            className="flex items-center gap-3 min-w-[240px] max-w-[280px] p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-colors text-left group shrink-0"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-primary transition-colors">
              {lesson.type === 'video' ? (
                <PlayCircle className="size-5" />
              ) : lesson.type === 'quiz' ? (
                <ClipboardCheck className="size-5" />
              ) : (
                <FileText className="size-5" />
              )}
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-semibold text-foreground leading-snug truncate">{lesson.title}</span>
              <span className="text-[11px] font-medium text-muted-foreground">
                {lesson.type === 'video' ? 'Video' : lesson.type === 'quiz' ? 'Quiz' : 'Document'} · {lesson.duration}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Contents Tab - Course outline with modules and lessons
function ContentsTab({
  modules,
  currentLessonId,
  onLessonSelect,
}: {
  modules: CourseModule[]
  currentLessonId: string
  onLessonSelect: (lesson: Lesson) => void
}) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(modules.map(m => m.id))
  )

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0)
  const completedLessons = modules.reduce(
    (acc, m) => acc + m.lessons.filter(l => l.status === 'completed').length,
    0
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-base font-bold text-foreground">Course Contents</h3>
          <p className="text-xs text-muted-foreground font-medium">
            {completedLessons} of {totalLessons} lessons completed
          </p>
        </div>
        <Progress value={(completedLessons / totalLessons) * 100} className="h-2 w-32 bg-muted-foreground/15 [&>div]:bg-primary" />
      </div>

      <div className="flex flex-col border border-border/80 rounded-xl overflow-hidden">
        {modules.map((module) => (
          <div key={module.id} className="border-b border-border/60 last:border-b-0">
            {/* Module Header */}
            <button
              onClick={() => toggleModule(module.id)}
              className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/30 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <ChevronRight className={cn(
                  "size-4 text-muted-foreground transition-transform shrink-0",
                  expandedModules.has(module.id) && "rotate-90"
                )} />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-bold text-foreground truncate">{module.title}</span>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {module.lessons.filter(l => l.status === 'completed').length} / {module.lessons.length} lessons
                  </span>
                </div>
              </div>
            </button>

            {/* Lessons */}
            {expandedModules.has(module.id) && (
              <div className="flex flex-col">
                {module.lessons.map((lesson) => {
                  const isActive = lesson.id === currentLessonId
                  const isLocked = lesson.status === 'locked'

                  return (
                    <button
                      key={lesson.id}
                      onClick={() => !isLocked && onLessonSelect(lesson)}
                      disabled={isLocked}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 pl-11 text-left transition-colors border-l-2",
                        isActive
                          ? "bg-primary/5 border-l-primary"
                          : "border-l-transparent hover:bg-muted/20",
                        isLocked && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="shrink-0">
                        {lesson.status === 'completed' ? (
                          <CheckCircle2 className="size-4 text-success" />
                        ) : lesson.status === 'in-progress' ? (
                          <PlayCircle className="size-4 text-primary" />
                        ) : lesson.status === 'locked' ? (
                          <Lock className="size-4 text-muted-foreground/50" />
                        ) : (
                          <Circle className="size-4 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className={cn(
                          "text-sm font-medium truncate",
                          isActive ? "text-primary font-semibold" : "text-foreground"
                        )}>
                          {lesson.title}
                        </span>
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {lesson.type === 'video' ? 'Video' : lesson.type === 'quiz' ? 'Quiz' : lesson.type === 'document' ? 'Document' : 'Interactive'} · {lesson.duration}
                        </span>
                      </div>
                      {isActive && (
                        <Badge variant="navy" className="text-[10px] font-bold shrink-0">CURRENT</Badge>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Assessments Tab
function AssessmentsTab({ assessments }: { assessments: Assessment[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-base font-bold text-foreground">Assessments</h3>
          <p className="text-xs text-muted-foreground font-medium">
            {assessments.filter(a => a.status === 'completed').length} of {assessments.length} completed
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {assessments.map((assessment) => (
          <Card key={assessment.id} className="rounded-xl border-border/60 shadow-none hover:shadow-sm transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg",
                    assessment.status === 'completed'
                      ? "bg-success/10 text-success"
                      : "bg-muted text-muted-foreground"
                  )}>
                    <ClipboardCheck className="size-5" />
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <h4 className="text-sm font-bold text-foreground leading-snug">{assessment.title}</h4>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
                      <span>{assessment.questions} Questions</span>
                      <span className="size-1 rounded-full bg-muted-foreground/30" />
                      <span>{assessment.duration}</span>
                      <span className="size-1 rounded-full bg-muted-foreground/30" />
                      <span>Passing Score: {assessment.passingScore}%</span>
                      <span className="size-1 rounded-full bg-muted-foreground/30" />
                      <span>{assessment.attempts}/{assessment.maxAttempts} attempts used</span>
                    </div>
                    {assessment.score !== undefined && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn(
                          "text-xs font-bold",
                          assessment.score >= assessment.passingScore ? "text-success" : "text-destructive"
                        )}>
                          Score: {assessment.score}%
                        </span>
                        <Badge
                          variant={assessment.score >= assessment.passingScore ? 'success' : 'destructive'}
                          className="text-[10px] font-bold"
                        >
                          {assessment.score >= assessment.passingScore ? 'PASSED' : 'FAILED'}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  {assessment.status === 'completed' ? (
                    <StatusBadge variant="active" className="text-[10px] uppercase font-bold tracking-wider">
                      Completed
                    </StatusBadge>
                  ) : assessment.status === 'in-progress' ? (
                    <Button size="sm" className="gap-1 text-xs">
                      <PlayCircle className="size-3.5" /> Continue
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="gap-1 text-xs">
                      <PlayCircle className="size-3.5" /> Start
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Notes Tab
function NotesTab({ notes: initialNotes }: { notes: Note[] }) {
  const [notes, setNotes] = useState(initialNotes)
  const [newNote, setNewNote] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const handleAddNote = () => {
    if (!newNote.trim()) return
    const note: Note = {
      id: `n-${Date.now()}`,
      timestamp: '10:15',
      lessonTitle: '1.2 Barriers to Communication',
      content: newNote,
      createdAt: 'Today',
    }
    setNotes([note, ...notes])
    setNewNote('')
  }

  const handleDelete = (id: string) => {
    setNotes(notes.filter(n => n.id !== id))
  }

  const handleEdit = (note: Note) => {
    setEditingId(note.id)
    setEditContent(note.content)
  }

  const handleSaveEdit = (id: string) => {
    setNotes(notes.map(n => n.id === id ? { ...n, content: editContent } : n))
    setEditingId(null)
    setEditContent('')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-base font-bold text-foreground">My Notes</h3>
        <p className="text-xs text-muted-foreground font-medium">
          Personal notes are private and only visible to you
        </p>
      </div>

      {/* Add New Note */}
      <Card className="rounded-xl border-border/60 shadow-none">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note about the current lesson..."
              className="w-full h-20 resize-none rounded-lg border border-border/80 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 transition-colors"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">
                Linked to: 1.2 Barriers to Communication @ 10:15
              </span>
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="gap-1"
              >
                <Plus className="size-3.5" /> Add Note
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes List */}
      <div className="flex flex-col gap-3">
        {notes.map((note) => (
          <Card key={note.id} className="rounded-xl border-border/60 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                    <Badge variant="muted" className="text-[10px] font-bold gap-1">
                      <Clock className="size-2.5" /> {note.timestamp}
                    </Badge>
                    <span>{note.lessonTitle}</span>
                  </div>
                  {editingId === note.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full h-16 resize-none rounded-lg border border-border/80 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 transition-colors"
                      />
                      <div className="flex items-center gap-2">
                        <Button size="xs" onClick={() => handleSaveEdit(note.id)} className="gap-1">
                          <Save className="size-3" /> Save
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground leading-relaxed">{note.content}</p>
                  )}
                  <span className="text-[10px] text-muted-foreground font-medium">{note.createdAt}</span>
                </div>
                {editingId !== note.id && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon-xs" variant="ghost" onClick={() => handleEdit(note)} className="text-muted-foreground hover:text-foreground">
                      <Pencil className="size-3" />
                    </Button>
                    <Button size="icon-xs" variant="ghost" onClick={() => handleDelete(note.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {notes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-lg bg-muted/50 mb-3">
            <StickyNote className="size-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-semibold text-foreground">No notes yet</p>
          <p className="text-xs text-muted-foreground mt-1">Start taking notes while you learn</p>
        </div>
      )}
    </div>
  )
}

// Discussions Tab
function DiscussionsTab({ discussions: initialDiscussions }: { discussions: DiscussionMessage[] }) {
  const [discussions] = useState(initialDiscussions)
  const [newMessage, setNewMessage] = useState('')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-base font-bold text-foreground">Discussions</h3>
          <p className="text-xs text-muted-foreground font-medium">
            {discussions.length} discussions in this course
          </p>
        </div>
      </div>

      {/* New Discussion */}
      <Card className="rounded-xl border-border/60 shadow-none">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
              AM
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Start a discussion or ask a question..."
                className="w-full h-16 resize-none rounded-lg border border-border/80 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50 transition-colors"
              />
              <div className="flex justify-end">
                <Button size="sm" disabled={!newMessage.trim()} className="gap-1">
                  <Send className="size-3.5" /> Post
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Discussion Threads */}
      <div className="flex flex-col gap-3">
        {discussions.map((disc) => (
          <Card key={disc.id} className="rounded-xl border-border/60 shadow-none hover:shadow-sm transition-shadow">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  disc.isInstructor
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}>
                  {disc.initials}
                </div>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{disc.author}</span>
                    {disc.isInstructor && (
                      <Badge variant="navy" className="text-[9px] font-bold">INSTRUCTOR</Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground font-medium">{disc.timestamp}</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{disc.content}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <button className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors">
                      <MessageSquare className="size-3" /> {disc.replies} {disc.replies === 1 ? 'reply' : 'replies'}
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Sidebar Panels ──────────────────────────────────────────────────────────

function CourseProgressPanel() {
  return (
    <Card className="rounded-xl border-border/60 shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-4 pb-3 pt-4">
        <CardTitle className="text-sm font-bold">Course Progress</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="flex items-start gap-4">
          <RadialProgress value={COURSE_DATA.progressPercent} size={80} />
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground font-medium">Completed</span>
              <span className="font-bold text-foreground tabular-nums">{COURSE_DATA.completedLessons} / {COURSE_DATA.totalLessons}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground font-medium">In Progress</span>
              <span className="font-bold text-foreground tabular-nums">{COURSE_DATA.inProgressLessons}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground font-medium">Not Started</span>
              <span className="font-bold text-foreground tabular-nums">{COURSE_DATA.notStartedLessons}</span>
            </div>
            <div className="border-t border-border/50 pt-1.5 mt-0.5" />
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground font-medium">Total Duration</span>
              <span className="font-bold text-foreground tabular-nums">{COURSE_DATA.totalDuration}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground font-medium">Time Spent</span>
              <span className="font-bold text-foreground tabular-nums">{COURSE_DATA.timeSpent}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function UpcomingDeadlinesPanel() {
  return (
    <Card className="rounded-xl border-border/60 shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-4 pb-3 pt-4">
        <CardTitle className="text-sm font-bold">Upcoming Deadlines</CardTitle>
        <CalendarDays className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="flex items-center gap-3">
          <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-border/80 bg-background py-1.5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">JUN</span>
            <span className="text-lg font-black leading-none text-foreground">28</span>
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <span className="text-sm font-bold text-foreground leading-snug">Course Due Date</span>
            <span className="text-xs text-muted-foreground font-medium">28 Jun 2025</span>
          </div>
          <Badge variant="warning" className="text-[10px] font-bold shrink-0">
            {COURSE_DATA.daysLeft} days left
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function CourseMaterialsPanel({ materials }: { materials: CourseMaterial[] }) {
  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? materials : materials.slice(0, 3)

  return (
    <Card className="rounded-xl border-border/60 shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-4 pb-3 pt-4">
        <CardTitle className="text-sm font-bold">Course Materials</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="flex flex-col gap-2">
          {displayed.map((material) => (
            <div
              key={material.id}
              className="flex items-center gap-3 rounded-lg px-2 py-2 -mx-2 hover:bg-muted/30 transition-colors group"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted border border-border/50">
                <FileText className="size-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-0 flex-1 min-w-0">
                <span className="text-xs font-semibold text-foreground truncate">{material.name}</span>
                <span className="text-[10px] text-muted-foreground font-medium">{material.size}</span>
              </div>
              <Button
                size="icon-xs"
                variant="ghost"
                className="text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <Download className="size-3.5" />
              </Button>
            </div>
          ))}
          {materials.length > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors text-left"
            >
              {showAll ? 'Show less' : `View all materials`}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function CertificatePanel() {
  return (
    <Card className="rounded-xl border-border/60 shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-4 pb-3 pt-4">
        <CardTitle className="text-sm font-bold">Earned Certificate</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted/50">
            <Award className="size-6 text-muted-foreground/40" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs font-semibold text-foreground leading-snug">
              Complete all lessons and assessments to earn your certificate
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
              {COURSE_DATA.completedLessons}/{COURSE_DATA.totalLessons} requirements met
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Bottom navigation bar
function LessonNavigationBar({
  modules,
  currentLessonId,
  onLessonSelect,
}: {
  modules: CourseModule[]
  currentLessonId: string
  onLessonSelect: (lesson: Lesson) => void
}) {
  const allLessons = modules.flatMap(m => m.lessons)
  const currentIndex = allLessons.findIndex(l => l.id === currentLessonId)
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null

  return (
    <div className="border-t border-border bg-card/80 backdrop-blur-sm px-6 py-2.5">
      <div className="flex items-center justify-between">
        {prevLesson ? (
          <button
            onClick={() => onLessonSelect(prevLesson)}
            className="flex items-center gap-2 text-left group"
          >
            <ChevronLeft className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Previous Lesson</span>
              <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate max-w-[240px]">
                {prevLesson.title}
              </span>
            </div>
          </button>
        ) : <div />}

        {nextLesson ? (
          <button
            onClick={() => nextLesson.status !== 'locked' && onLessonSelect(nextLesson)}
            disabled={nextLesson.status === 'locked'}
            className={cn(
              "flex items-center gap-2 text-right group",
              nextLesson.status === 'locked' && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Next Lesson</span>
              <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate max-w-[240px]">
                {nextLesson.title}
              </span>
            </div>
            <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
        ) : <div />}
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function LearningDeliveryWorkspace() {
  const [activeTab, setActiveTab] = useState('learn')
  const [currentLessonId, setCurrentLessonId] = useState('l-2')

  const allLessons = COURSE_MODULES.flatMap(m => m.lessons)
  const currentLesson = allLessons.find(l => l.id === currentLessonId)!
  const currentIndex = allLessons.findIndex(l => l.id === currentLessonId)

  const handleLessonSelect = (lesson: Lesson) => {
    setCurrentLessonId(lesson.id)
    setActiveTab('learn')
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentLessonId(allLessons[currentIndex - 1].id)
    }
  }

  const handleNext = () => {
    if (currentIndex < allLessons.length - 1 && allLessons[currentIndex + 1].status !== 'locked') {
      setCurrentLessonId(allLessons[currentIndex + 1].id)
    }
  }

  const tabs = [
    { id: 'learn', label: 'Learn', icon: PlayCircle },
    { id: 'contents', label: 'Contents', icon: BookOpen },
    { id: 'assessments', label: 'Assessments', icon: ClipboardCheck },
    { id: 'notes', label: 'Notes', icon: StickyNote },
    { id: 'discussions', label: 'Discussions', icon: MessageSquare },
  ]

  return (
    <div className="flex flex-col absolute inset-0 bg-background z-10">
      {/* Course Header */}
      <div className="border-b border-border/80 bg-card px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            {/* Course thumbnail placeholder */}
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted border border-border/50">
              <ImageIcon className="size-7 text-muted-foreground/40" />
            </div>
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-foreground leading-tight">
                  {COURSE_DATA.title}
                </h1>
                <StatusBadge variant="processing" className="text-[10px] uppercase font-bold tracking-wider">
                  {COURSE_DATA.status}
                </StatusBadge>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <BookOpen className="size-3" /> {COURSE_DATA.type}
                </span>
                <span className="size-1 rounded-full bg-muted-foreground/30" />
                <span className="flex items-center gap-1">
                  <Clock className="size-3" /> {COURSE_DATA.duration}
                </span>
                <span className="size-1 rounded-full bg-muted-foreground/30" />
                <span>{COURSE_DATA.language}</span>
                <span className="size-1 rounded-full bg-muted-foreground/30" />
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3" /> Due: {COURSE_DATA.dueDate}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
              <Info className="size-3.5" /> About this course
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
              <Save className="size-3.5" /> Save & Exit
            </Button>
            <Button size="sm" className="gap-1.5 text-xs font-semibold">
              <CheckCircle2 className="size-3.5" /> Mark as Complete
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border/60 bg-card px-6">
        <div className="flex items-center gap-5">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-1.5 -mb-px pb-2.5 pt-3 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap',
                  activeTab === tab.id
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="size-3.5" />
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Tab Content */}
        <div className="flex-1 overflow-y-auto g2g-scrollbar p-6">
          {activeTab === 'learn' && (
            <div className="flex flex-col gap-6">
              <CoursePlayer
                currentLesson={currentLesson}
                onPrevious={handlePrevious}
                onNext={handleNext}
                hasPrevious={currentIndex > 0}
                hasNext={currentIndex < allLessons.length - 1 && allLessons[currentIndex + 1].status !== 'locked'}
              />
              <WhatsNextSection
                lessons={allLessons}
                onLessonSelect={handleLessonSelect}
              />
            </div>
          )}

          {activeTab === 'contents' && (
            <ContentsTab
              modules={COURSE_MODULES}
              currentLessonId={currentLessonId}
              onLessonSelect={handleLessonSelect}
            />
          )}

          {activeTab === 'assessments' && (
            <AssessmentsTab assessments={ASSESSMENTS} />
          )}

          {activeTab === 'notes' && (
            <NotesTab notes={NOTES} />
          )}

          {activeTab === 'discussions' && (
            <DiscussionsTab discussions={DISCUSSIONS} />
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-[320px] shrink-0 border-l border-border/60 overflow-y-auto g2g-scrollbar p-4 flex flex-col gap-4 bg-background/50">
          <CourseProgressPanel />
          <UpcomingDeadlinesPanel />
          <CourseMaterialsPanel materials={MATERIALS} />
          <CertificatePanel />
        </div>
      </div>

      {/* Bottom Lesson Navigation */}
      <LessonNavigationBar
        modules={COURSE_MODULES}
        currentLessonId={currentLessonId}
        onLessonSelect={handleLessonSelect}
      />
    </div>
  )
}
