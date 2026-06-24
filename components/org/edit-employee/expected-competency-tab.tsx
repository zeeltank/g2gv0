import React, { useState, useMemo } from "react";
import { 
  Target, 
  BookOpen, 
  Wrench, 
  HeartHandshake, 
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Medal,
  Info
} from "lucide-react";

export type CategoryType = "Skill" | "Knowledge" | "Ability" | "Attitude" | "Behaviour";

export interface CompetencyGap {
  id: string;
  title: string;
  description: string;
  expectedLevel: number;
  actualLevel: number;
}

interface ExpectedCompetencyTabProps {
  data: Record<CategoryType, CompetencyGap[]>;
}

const CategoryIcons: Record<CategoryType, React.ElementType> = {
  Skill: Target,
  Knowledge: BookOpen,
  Ability: Wrench,
  Attitude: HeartHandshake,
  Behaviour: Users,
};

export function ExpectedCompetencyTab({ data }: ExpectedCompetencyTabProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryType>("Skill");

  const currentItems = data[activeCategory] || [];
  
  // Calculate summary stats
  const stats = useMemo(() => {
    let total = 0;
    let meets = 0;
    let gaps = 0;
    let exceeds = 0;

    Object.values(data).forEach(items => {
      items.forEach(item => {
        total++;
        if (item.actualLevel === item.expectedLevel) meets++;
        else if (item.actualLevel > item.expectedLevel) exceeds++;
        else gaps++;
      });
    });

    const matchPercentage = total === 0 ? 0 : Math.round(((meets + exceeds) / total) * 100);

    return { total, meets, gaps, exceeds, matchPercentage };
  }, [data]);

  return (
    <div className="h-full flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500 pt-4">
      
      {/* Top Overview Cards */}
      <div className="shrink-0 mb-8 px-2 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-primary font-semibold mb-2">
            <Medal className="w-4 h-4" /> Role Match
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-foreground">{stats.matchPercentage}%</span>
            <span className="text-sm text-muted-foreground mb-1">Aligned</span>
          </div>
        </div>
        
        <div className="bg-emerald-50 border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold mb-2">
            <CheckCircle2 className="w-4 h-4" /> Meets Expectation
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-foreground">{stats.meets}</span>
            <span className="text-sm text-muted-foreground mb-1">Competencies</span>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold mb-2">
            <AlertTriangle className="w-4 h-4" /> Skill Gaps
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-foreground">{stats.gaps}</span>
            <span className="text-sm text-muted-foreground mb-1">Areas to improve</span>
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 dark:bg-indigo-500/10 dark:border-indigo-500/20 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-semibold mb-2">
            <TrendingUp className="w-4 h-4" /> Exceeds Role
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-foreground">{stats.exceeds}</span>
            <span className="text-sm text-muted-foreground mb-1">Advanced skills</span>
          </div>
        </div>
      </div>

      {/* Category Navigation (Segmented Control) */}
      <div className="shrink-0 mb-6 px-2">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 bg-surface p-1.5 rounded-xl border border-border/50 shadow-sm">
          {(Object.keys(CategoryIcons) as CategoryType[]).map((cat) => {
            const CatIcon = CategoryIcons[cat];
            const isActive = activeCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center justify-center w-full gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive 
                    ? "bg-primary text-white shadow-sm" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <CatIcon className="w-4 h-4" />
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Gap Analysis List Area */}
      <div className="flex-1 overflow-y-auto pb-10 px-2">
        {currentItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-surface border border-dashed rounded-2xl">
            <Info className="w-8 h-8 mb-3 opacity-50" />
            <p>No competency data available for {activeCategory}.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentItems.map((item) => {
              const gap = item.actualLevel - item.expectedLevel;
              const isMeeting = gap === 0;
              const isExceeding = gap > 0;
              const isGap = gap < 0;

              return (
                <div key={item.id} className="bg-surface border border-border/40 rounded-2xl p-5 shadow-sm flex flex-col lg:flex-row gap-6 items-start lg:items-center transition-all hover:bg-muted/20">
                  
                  {/* Info Section */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="font-bold text-foreground">{item.title}</h4>
                      {isMeeting && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 tracking-wider uppercase">Meets</span>}
                      {isExceeding && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 tracking-wider uppercase">Exceeds (+{gap})</span>}
                      {isGap && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 tracking-wider uppercase">Gap ({gap})</span>}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {/* Level Visualizer */}
                  <div className="shrink-0 w-full lg:w-64 flex flex-col gap-3">
                    
                    {/* Expected Row */}
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-muted-foreground w-16">Expected</span>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map(level => (
                          <div 
                            key={`exp-${level}`} 
                            className={`w-6 h-2 rounded-full ${level <= item.expectedLevel ? 'bg-muted-foreground/40' : 'bg-muted'}`}
                          />
                        ))}
                      </div>
                      <span className="w-4 text-right font-bold text-muted-foreground">{item.expectedLevel}</span>
                    </div>

                    {/* Actual Row */}
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className={`${isGap ? 'text-amber-600 dark:text-amber-400' : isExceeding ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400'} w-16`}>
                        Actual
                      </span>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map(level => {
                          const isActive = level <= item.actualLevel;
                          let colorClass = 'bg-muted';
                          
                          if (isActive) {
                            if (isGap) colorClass = 'bg-amber-500';
                            else if (isExceeding) colorClass = level > item.expectedLevel ? 'bg-indigo-500' : 'bg-emerald-500';
                            else colorClass = 'bg-emerald-500';
                          }

                          return (
                            <div 
                              key={`act-${level}`} 
                              className={`w-6 h-2 rounded-full ${colorClass}`}
                            />
                          );
                        })}
                      </div>
                      <span className={`w-4 text-right font-bold ${isGap ? 'text-amber-600 dark:text-amber-400' : isExceeding ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {item.actualLevel}
                      </span>
                    </div>

                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
