import React, { useState } from "react";
import { CheckCircle2, Circle, GraduationCap, Wrench, ChevronRight, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Skill {
  skill_id: number;
  skill: string;
  category?: string;
  knowledge: string[];
  ability: string[];
  attitude: string[];
  behaviour: string[];
  validated?: boolean;
}

interface JobroleSkillTabProps {
  employee: any;
  skills: Skill[];
}

export function JobroleSkillTab({ employee, skills }: JobroleSkillTabProps) {
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(skills.length > 0 ? skills[0].skill_id : null);
  const [validationState, setValidationState] = useState<Record<string, boolean>>({});

  const selectedSkill = skills.find(s => s.skill_id === selectedSkillId);

  const toggleValidation = (type: string, index: number, value: boolean) => {
    setValidationState(prev => ({
      ...prev,
      [`${selectedSkillId}-${type}-${index}`]: value
    }));
  };

  const setOverallProficiency = (value: boolean) => {
    setValidationState(prev => ({
      ...prev,
      [`${selectedSkillId}-overall`]: value
    }));
  };

  if (!skills || skills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4 animate-in fade-in zoom-in duration-300">
        <div className="p-4 rounded-full bg-muted/50">
          <GraduationCap className="size-8 opacity-50" />
        </div>
        <p>No jobrole skills have been assigned to this profile.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500 relative">
      
      {/* Sidebar: Skills List */}
      <div className="w-full md:w-80 shrink-0 flex flex-col gap-3 overflow-y-auto pr-2 pb-16">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Required Skills</h3>
        {skills.map((skill) => {
          const isSelected = skill.skill_id === selectedSkillId;
          const isProficient = validationState[`${skill.skill_id}-overall`] === true;
          
          return (
            <button
              key={skill.skill_id}
              onClick={() => setSelectedSkillId(skill.skill_id)}
              className={`flex items-center justify-between p-3 rounded-xl transition-all border text-left cursor-pointer ${
                isSelected 
                  ? 'bg-primary/5 border-primary/20 shadow-sm' 
                  : 'bg-surface border-border/40 hover:border-primary/30 hover:bg-surface-muted'
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {isProficient ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/30 shrink-0" />
                )}
                <span className={`text-sm truncate ${isSelected ? 'font-semibold text-primary' : 'font-medium text-foreground'}`}>
                  {skill.skill}
                </span>
              </div>
              {isSelected && <ChevronRight className="w-4 h-4 text-primary shrink-0 ml-2" />}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pb-16 pr-2">
        {selectedSkill ? (
          <div className="flex flex-col gap-8 max-w-4xl">
            
            {/* Header & Overall Proficiency */}
            <div className="bg-surface border rounded-2xl p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
              
              <div className="relative z-10">
                <h2 className="text-2xl font-bold text-foreground mb-2">{selectedSkill.skill}</h2>
                <p className="text-muted-foreground mb-6">Assess your proficiency and validate the specific knowledge and ability requirements below.</p>
                
                <div className="flex items-center gap-4 bg-background p-4 rounded-xl border border-border/50 inline-flex">
                  <span className="text-sm font-medium">Are you proficient in this skill?</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setOverallProficiency(true)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer active:scale-95 ${
                        validationState[`${selectedSkill.skill_id}-overall`] === true 
                          ? 'bg-emerald-500 text-white shadow-md' 
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setOverallProficiency(false)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer active:scale-95 ${
                        validationState[`${selectedSkill.skill_id}-overall`] === false 
                          ? 'bg-red-500 text-white shadow-md' 
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Knowledge Section */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-primary font-semibold pb-2 border-b">
                  <GraduationCap className="w-5 h-5" />
                  <h3>Knowledge</h3>
                </div>
                <div className="space-y-3">
                  {selectedSkill.knowledge.length > 0 ? selectedSkill.knowledge.map((item, index) => {
                    const isYes = validationState[`${selectedSkill.skill_id}-knowledge-${index}`] === true;
                    const isNo = validationState[`${selectedSkill.skill_id}-knowledge-${index}`] === false;
                    
                    return (
                      <div key={index} className="bg-surface border p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-sm text-foreground/90 leading-relaxed mb-4">{item}</p>
                        <div className="flex items-center justify-end gap-2 border-t pt-3 mt-2">
                          <button
                            onClick={() => toggleValidation('knowledge', index, true)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                              isYes ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" /> Yes
                          </button>
                          <button
                            onClick={() => toggleValidation('knowledge', index, false)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                              isNo ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent'
                            }`}
                          >
                            No
                          </button>
                        </div>
                      </div>
                    );
                  }) : <p className="text-sm text-muted-foreground italic">No specific knowledge requirements listed.</p>}
                </div>
              </div>

              {/* Ability Section */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-primary font-semibold pb-2 border-b">
                  <Wrench className="w-5 h-5" />
                  <h3>Ability</h3>
                </div>
                <div className="space-y-3">
                  {selectedSkill.ability.length > 0 ? selectedSkill.ability.map((item, index) => {
                    const isYes = validationState[`${selectedSkill.skill_id}-ability-${index}`] === true;
                    const isNo = validationState[`${selectedSkill.skill_id}-ability-${index}`] === false;
                    
                    return (
                      <div key={index} className="bg-surface border p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-sm text-foreground/90 leading-relaxed mb-4">{item}</p>
                        <div className="flex items-center justify-end gap-2 border-t pt-3 mt-2">
                          <button
                            onClick={() => toggleValidation('ability', index, true)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                              isYes ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" /> Yes
                          </button>
                          <button
                            onClick={() => toggleValidation('ability', index, false)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                              isNo ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent'
                            }`}
                          >
                            No
                          </button>
                        </div>
                      </div>
                    );
                  }) : <p className="text-sm text-muted-foreground italic">No specific ability requirements listed.</p>}
                </div>
              </div>

              {/* Attitude Section */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-primary font-semibold pb-2 border-b">
                  <Circle className="w-5 h-5" />
                  <h3>Attitude</h3>
                </div>
                <div className="space-y-3">
                  {selectedSkill.attitude.length > 0 ? selectedSkill.attitude.map((item, index) => {
                    const isYes = validationState[`${selectedSkill.skill_id}-attitude-${index}`] === true;
                    const isNo = validationState[`${selectedSkill.skill_id}-attitude-${index}`] === false;
                    
                    return (
                      <div key={index} className="bg-surface border p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-sm text-foreground/90 leading-relaxed mb-4">{item}</p>
                        <div className="flex items-center justify-end gap-2 border-t pt-3 mt-2">
                          <button
                            onClick={() => toggleValidation('attitude', index, true)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                              isYes ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" /> Yes
                          </button>
                          <button
                            onClick={() => toggleValidation('attitude', index, false)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                              isNo ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent'
                            }`}
                          >
                            No
                          </button>
                        </div>
                      </div>
                    );
                  }) : <p className="text-sm text-muted-foreground italic">No specific attitude requirements listed.</p>}
                </div>
              </div>

              {/* Behaviour Section */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-primary font-semibold pb-2 border-b">
                  <CheckCircle2 className="w-5 h-5" />
                  <h3>Behaviour</h3>
                </div>
                <div className="space-y-3">
                  {selectedSkill.behaviour.length > 0 ? selectedSkill.behaviour.map((item, index) => {
                    const isYes = validationState[`${selectedSkill.skill_id}-behaviour-${index}`] === true;
                    const isNo = validationState[`${selectedSkill.skill_id}-behaviour-${index}`] === false;
                    
                    return (
                      <div key={index} className="bg-surface border p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-sm text-foreground/90 leading-relaxed mb-4">{item}</p>
                        <div className="flex items-center justify-end gap-2 border-t pt-3 mt-2">
                          <button
                            onClick={() => toggleValidation('behaviour', index, true)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                              isYes ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" /> Yes
                          </button>
                          <button
                            onClick={() => toggleValidation('behaviour', index, false)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                              isNo ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent'
                            }`}
                          >
                            No
                          </button>
                        </div>
                      </div>
                    );
                  }) : <p className="text-sm text-muted-foreground italic">No specific behaviour requirements listed.</p>}
                </div>
              </div>
            </div>

          </div>
        ) : null}
      </div>

      {/* Sticky Action Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t flex items-center justify-between z-10">
        <p className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-alert w-3.5 h-3.5" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="8" y2="12"></line><line x1="12" x2="12.01" y1="16" y2="16"></line></svg> Please review all items carefully before saving your changes.
        </p>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button type="button" variant="outline" className="flex-1 sm:flex-none">
            Reset Skill
          </Button>
          <Button type="submit" className="flex-1 sm:flex-none">
            Save Validations
          </Button>
        </div>
      </div>

    </div>
  );
}
