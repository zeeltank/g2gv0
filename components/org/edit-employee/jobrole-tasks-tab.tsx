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

interface Task {
  id: number;
  critical_work_function: string;
  task: string;
  skill?: string;
  proficiency_level?: string | null;
}

interface JobroleTasksTabProps {
  tasks: Task[];
}

// Dynamic Icon Matcher based on Critical Work Function name
const getFunctionIcon = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("architect")) return <Network className="w-5 h-5 text-indigo-500" />;
  if (lowerName.includes("frontend") || lowerName.includes("ui") || lowerName.includes("design")) return <Layout className="w-5 h-5 text-pink-500" />;
  if (lowerName.includes("backend") || lowerName.includes("server") || lowerName.includes("api")) return <Server className="w-5 h-5 text-emerald-500" />;
  if (lowerName.includes("data")) return <Database className="w-5 h-5 text-blue-500" />;
  if (lowerName.includes("test") || lowerName.includes("quality") || lowerName.includes("qa")) return <ShieldCheck className="w-5 h-5 text-green-500" />;
  if (lowerName.includes("secur")) return <Lock className="w-5 h-5 text-red-500" />;
  if (lowerName.includes("cloud") || lowerName.includes("infra") || lowerName.includes("devops")) return <Cloud className="w-5 h-5 text-cyan-500" />;
  if (lowerName.includes("manage") || lowerName.includes("lead") || lowerName.includes("team")) return <Users className="w-5 h-5 text-orange-500" />;
  if (lowerName.includes("code") || lowerName.includes("develop")) return <Code2 className="w-5 h-5 text-violet-500" />;
  if (lowerName.includes("config") || lowerName.includes("setup")) return <Settings className="w-5 h-5 text-slate-500" />;
  if (lowerName.includes("analy") || lowerName.includes("metric")) return <BarChart className="w-5 h-5 text-yellow-500" />;
  return <Briefcase className="w-5 h-5 text-primary" />;
};

export function JobroleTasksTab({ tasks }: JobroleTasksTabProps) {
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

  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4 animate-in fade-in zoom-in duration-300">
        <div className="p-4 rounded-full bg-muted/50">
          <Briefcase className="size-8 opacity-50" />
        </div>
        <p>No jobrole tasks have been assigned to this profile.</p>
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
                  <div className="flex items-center gap-4 text-left">
                    <div className="p-2.5 bg-muted/50 rounded-lg shrink-0">
                      {getFunctionIcon(functionName)}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{functionName}</h3>
                      <p className="text-xs text-muted-foreground font-normal mt-0.5">
                        {groupTasks.length} {groupTasks.length === 1 ? 'Task' : 'Tasks'}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                
                <AccordionContent className="px-4 pb-5 pt-1 border-t">
                  <div className="pl-14 pr-4">
                    <ul className="space-y-4 mt-4">
                      {groupTasks.map((taskItem) => (
                        <li key={taskItem.id} className="flex items-start gap-3 group">
                          <CheckCircle2 className="w-4 h-4 text-primary/40 shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                          <span className="text-sm text-foreground/80 leading-relaxed font-medium">
                            {taskItem.task}
                          </span>
                        </li>
                      ))}
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
