'use client'

import React from "react";
import { 
  Network, 
  Layout, 
  Database, 
  ShieldCheck, 
  Lock, 
  Cloud, 
  Users, 
  Briefcase, 
  Zap,
  Code2,
  Settings,
  BarChart,
  CheckCircle2,
  Server
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ExternalLink, CircleSlash, AlertTriangle, HelpCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useSidebarNavigation } from "@/hooks/use-sidebar-navigation";
import { CAPABILITY_LIBRARY_ACCESS_LINK, TASK_MY_TASKS_ACCESS_LINK } from "@/lib/gtg-navigation";
import type {
  TaskReadinessRow,
  TaskReadinessCounts,
  TaskReadinessState,
} from "@/services/competency/task-readiness";

interface Task {
  id: number;
  critical_work_function: string;
  task: string;
  skill?: string;
  proficiency_level?: string | null;
}

interface JobroleTasksTabProps {
  tasks: Task[];
  /**
   * Readiness per task, keyed by `s_user_jobrole_task.id`. OPTIONAL, and the tab
   * renders correctly without it: readiness is a second request that may still
   * be in flight, may be refused, or may have nothing to say. A task with no
   * entry here is shown as a task, not as a failure.
   */
  readiness?: Map<number, TaskReadinessRow>;
  readinessCounts?: TaskReadinessCounts | null;
  readinessLoading?: boolean;
  readinessError?: string | null;
  /** Set when the role's tasks are mapped to no competencies at all. */
  readinessNote?: string | null;
}

/**
 * HOW EACH STATE LOOKS, AND WHY NONE OF THEM IS A BARE TICK.
 *
 * This list previously rendered the same check icon beside every task, which
 * read as "done" for work the person may not be cleared to perform at all. An
 * icon that means the same thing in every case carries no information and, worse,
 * implies the one thing the data cannot support.
 *
 * `unknown` and `unmapped` are deliberately NEUTRAL rather than warning-coloured:
 * neither is a finding about the person. Colouring an unmeasured task red would
 * make missing paperwork look like incompetence.
 */
const READINESS_STYLE: Record<TaskReadinessState, {
  label: string; icon: React.ReactNode; badge: string; hint: string;
}> = {
  cleared: {
    label: "Cleared",
    icon: <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />,
    badge: "bg-success/10 text-success border-success/20",
    hint: "Every competency this task needs is measured and at or above the role's target.",
  },
  not_cleared: {
    label: "Not cleared",
    icon: <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />,
    badge: "bg-destructive/10 text-destructive border-destructive/20",
    hint: "At least one competency this task needs is measured below the role's target.",
  },
  unknown: {
    label: "Not assessed",
    icon: <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />,
    badge: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    hint: "Nothing is known to be short, but something has not been assessed or has no target set.",
  },
  unmapped: {
    label: "Not mapped",
    icon: <CircleSlash className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-0.5" />,
    badge: "bg-muted text-muted-foreground border-border",
    hint: "No competencies are mapped to this task yet, so readiness cannot be assessed.",
  },
};

// Dynamic Icon Matcher based on Critical Work Function name
const getFunctionIcon = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("architect")) return <Network className="w-5 h-5 text-indigo-500" />;
  if (lowerName.includes("frontend") || lowerName.includes("ui") || lowerName.includes("design")) return <Layout className="w-5 h-5 text-pink-500" />;
  if (lowerName.includes("backend") || lowerName.includes("server") || lowerName.includes("api")) return <Server className="w-5 h-5 text-emerald-500" />;
  if (lowerName.includes("data")) return <Database className="w-5 h-5 text-primary" />;
  if (lowerName.includes("test") || lowerName.includes("quality") || lowerName.includes("qa")) return <ShieldCheck className="w-5 h-5 text-success" />;
  if (lowerName.includes("secur")) return <Lock className="w-5 h-5 text-red-500" />;
  if (lowerName.includes("cloud") || lowerName.includes("infra") || lowerName.includes("devops")) return <Cloud className="w-5 h-5 text-cyan-500" />;
  if (lowerName.includes("manage") || lowerName.includes("lead") || lowerName.includes("team")) return <Users className="w-5 h-5 text-orange-500" />;
  if (lowerName.includes("code") || lowerName.includes("develop")) return <Code2 className="w-5 h-5 text-violet-500" />;
  if (lowerName.includes("config") || lowerName.includes("setup")) return <Settings className="w-5 h-5 text-slate-500" />;
  if (lowerName.includes("analy") || lowerName.includes("metric")) return <BarChart className="w-5 h-5 text-yellow-500" />;
  return <Briefcase className="w-5 h-5 text-primary" />;
};

export function JobroleTasksTab({
  tasks,
  readiness,
  readinessCounts,
  readinessLoading = false,
  readinessError = null,
  readinessNote = null,
}: JobroleTasksTabProps) {
  /*
   * Navigation goes through the user's own menu tree, never a hand-written
   * path. resolveAccessLink also checks the caller can actually open the
   * target, so a link they have no rights to degrades instead of landing them
   * on an empty shell - which is exactly how the department drawer's "Create
   * in Library" button broke.
   */
  const router = useRouter();
  const { resolveAccessLink } = useSidebarNavigation();
  // Group tasks by critical_work_function
  const groupedTasks = React.useMemo(() => {
    return tasks.reduce((acc, task) => {
      const groupName = task.critical_work_function || "General Tasks";
      if (!acc[groupName]) {
        acc[groupName] = [];
      }
      acc[groupName].push(task);
      return acc;
    }, {} as Record<string, Task[]>);
  }, [tasks]);

  const groupKeys = Object.keys(groupedTasks);

  /** Not-cleared tasks per work function, so a collapsed group can say so. */
  const groupNotCleared = React.useMemo(() => {
    const out: Record<string, number> = {};
    if (!readiness) return out;
    for (const [name, group] of Object.entries(groupedTasks)) {
      out[name] = group.filter((t) => readiness.get(t.id)?.state === 'not_cleared').length;
    }
    return out;
  }, [groupedTasks, readiness]);

  /*
   * Reachable at last.
   *
   * The parent used to substitute five invented software-engineering tasks
   * whenever the API returned none, so this branch could never run and a
   * receptionist was shown "Design scalable backend systems".
   */
  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4 text-muted-foreground animate-in fade-in zoom-in duration-300">
        <div className="rounded-full bg-muted/50 p-4">
          <Briefcase className="size-8 opacity-50" />
        </div>
        <p>No job role tasks have been assigned to this profile.</p>
        <p className="max-w-md text-center text-xs">
          Tasks belong to a job role and are authored in Capability Library. Assigning this employee a
          job role that has tasks will populate this tab.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push(resolveAccessLink(CAPABILITY_LIBRARY_ACCESS_LINK))}>
            <ExternalLink className="mr-2 size-3.5" aria-hidden="true" /> Capability Library
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push(resolveAccessLink(TASK_MY_TASKS_ACCESS_LINK))}>
            <ExternalLink className="mr-2 size-3.5" aria-hidden="true" /> Task Management
          </Button>
        </div>
      </div>
    );
  }

  // Generate an array of group names to set them all as open by default
  const defaultOpenItems = groupKeys.map((_, index) => `item-${index}`);

  return (
    <div className="h-full flex flex-col md:flex-row gap-8 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
      
      {/* Left Column: Title & Info */}
      <div className="w-full md:w-80 shrink-0 border-r pr-6 flex flex-col">
        <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10">
          <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-4">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Critical Work Functions</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Review the core responsibilities and granular tasks required for this specific role. Expand each section to see the detailed task breakdown.
          </p>
          
          <div className="mt-6 pt-6 border-t border-primary/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Functions</span>
              <span className="font-bold text-foreground">{groupKeys.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-muted-foreground">Total Tasks</span>
              <span className="font-bold text-foreground">{tasks.length}</span>
            </div>
          </div>

          {/* READINESS SUMMARY.
              Degrades in three directions rather than one: still loading, refused,
              or loaded-but-nothing-mapped each say something different, and a
              single "no data" would collapse them into a shrug. */}
          <div className="mt-6 pt-6 border-t border-primary/10">
            <h3 className="text-sm font-semibold text-foreground mb-3">Task Readiness</h3>

            {readinessLoading && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Checking against this role&apos;s competency targets…
              </p>
            )}

            {!readinessLoading && readinessError && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Readiness is unavailable right now, so the tasks below are listed without it.
                <span className="mt-1 block text-[11px] text-muted-foreground/70">{readinessError}</span>
              </p>
            )}

            {!readinessLoading && !readinessError && readinessCounts && (
              <>
                <div className="space-y-2">
                  {(['cleared', 'not_cleared', 'unknown', 'unmapped'] as const).map((state) => {
                    const n = readinessCounts[state]
                    if (!n) return null
                    const style = READINESS_STYLE[state]
                    return (
                      <div key={state} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          {style.icon}
                          {style.label}
                        </span>
                        <span className="font-bold text-foreground">{n}</span>
                      </div>
                    )
                  })}
                </div>

                {/* The headline a manager is looking for, stated in words rather
                    than left to be read off four counters. */}
                {readinessCounts.not_cleared > 0 && (
                  <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs leading-relaxed text-destructive">
                    Not cleared for {readinessCounts.not_cleared} of {readinessCounts.total} tasks —
                    a competency each one needs is measured below this role&apos;s target.
                  </p>
                )}
                {readinessNote && (
                  <p className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                    {readinessNote}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Accordion Task List */}
      <div className="flex-1 overflow-y-auto pb-16 pr-4">
        <Accordion type="multiple" defaultValue={defaultOpenItems} className="space-y-4">
          {groupKeys.map((functionName, index) => {
            const groupTasks = groupedTasks[functionName];
            
            return (
              <AccordionItem 
                key={index} 
                value={`item-${index}`} 
                className="bg-surface border rounded-xl overflow-hidden shadow-sm data-[state=open]:border-primary/20 data-[state=open]:shadow-md transition-all px-2"
              >
                <AccordionTrigger className="hover:no-underline px-4 py-4">
                  <div className="flex flex-1 items-center gap-4 text-left">
                    <div className="p-2.5 bg-muted/50 rounded-lg shrink-0">
                      {getFunctionIcon(functionName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-foreground">{functionName}</h3>
                      <p className="text-xs text-muted-foreground font-normal mt-0.5">
                        {groupTasks.length} {groupTasks.length === 1 ? 'Task' : 'Tasks'}
                      </p>
                    </div>
                    {/* Surfaced on the COLLAPSED header, because a work function
                        holding a not-cleared task is the thing you must not have
                        to expand five sections to discover. */}
                    {groupNotCleared[functionName] > 0 && (
                      <span className="mr-2 shrink-0 rounded-full border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                        {groupNotCleared[functionName]} not cleared
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                
                <AccordionContent className="px-4 pb-5 pt-1 border-t">
                  <div className="pl-14 pr-4">
                    <ul className="space-y-4 mt-4">
                      {groupTasks.map((taskItem) => {
                        const row = readiness?.get(taskItem.id)
                        const style = row ? READINESS_STYLE[row.state] : null

                        return (
                          <li key={taskItem.id} className="flex items-start gap-3 group">
                            {/* No readiness for this task means readiness has not
                                arrived or was refused — NOT that the task is
                                unmapped. The neutral dot says nothing rather than
                                asserting a state the client never received. */}
                            {style
                              ? style.icon
                              : <CheckCircle2 className="w-4 h-4 text-primary/40 shrink-0 mt-0.5 group-hover:text-primary transition-colors" />}

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm text-foreground/80 leading-relaxed font-medium">
                                  {taskItem.task}
                                </span>
                                {style && (
                                  <span
                                    title={style.hint}
                                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}
                                  >
                                    {style.label}
                                  </span>
                                )}
                              </div>

                              {/* THE COMPETENCIES THAT PRODUCED THE VERDICT.
                                  A state with no reasoning behind it is something
                                  to argue with; the numbers make it checkable. */}
                              {row && row.competencies.length > 0 && (
                                <ul className="mt-2 space-y-1">
                                  {row.competencies.map((c) => (
                                    <li key={c.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                                      <span className={c.state === 'below' ? 'font-medium text-destructive' : 'text-muted-foreground'}>
                                        {c.name}
                                      </span>
                                      {c.is_mandatory && (
                                        <span className="rounded bg-destructive/10 px-1 text-[9px] font-bold uppercase text-destructive">
                                          Mandatory
                                        </span>
                                      )}
                                      <span className="text-muted-foreground/70">
                                        {/* NULL is "not assessed", never 0 — a zero
                                            would read as a score of nothing. */}
                                        {c.level === null ? 'not assessed' : `level ${c.level}`}
                                        {c.required !== null ? ` · target ${c.required}` : ' · no target set'}
                                      </span>
                                      {/* A level speaking for part of a competency
                                          must not read as a complete measurement. */}
                                      {c.level !== null && c.coverage > 0 && c.coverage < 1 && (
                                        <span className="text-amber-600">{Math.round(c.coverage * 100)}% measured</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

    </div>
  );
}
