import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  Lightbulb, 
  Target, 
  UserCog, 
  Megaphone, 
  Puzzle, 
  MessageSquare, 
  Wrench, 
  Briefcase, 
  BrainCircuit, 
  Network,
  Users,
  Compass,
  Star,
  Zap,
  Info
} from "lucide-react";

interface AttributeItem {
  attribute_name?: string;
  attribute_overall_description?: string;
}

interface LorData {
  level?: string;
  guiding_phrase?: string;
  essence_level?: string;
  guidance_note?: string;
  Attributes?: Record<string, AttributeItem>;
  Business_skills?: Record<string, AttributeItem>;
}

interface LorTabProps {
  data: LorData | {};
}

const cleanText = (text?: string) => text?.replace(/in SFIA/g, "").trim() || "";

// Dynamic Icon Matcher based on Attribute name
const getAttributeIcon = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("autonomy") || lowerName.includes("independent")) return <Compass className="w-5 h-5 text-indigo-500" />;
  if (lowerName.includes("influence") || lowerName.includes("lead")) return <Megaphone className="w-5 h-5 text-pink-500" />;
  if (lowerName.includes("complex") || lowerName.includes("system")) return <Puzzle className="w-5 h-5 text-emerald-500" />;
  if (lowerName.includes("communicat")) return <MessageSquare className="w-5 h-5 text-blue-500" />;
  if (lowerName.includes("problem") || lowerName.includes("solv")) return <Wrench className="w-5 h-5 text-orange-500" />;
  if (lowerName.includes("business") || lowerName.includes("commercial")) return <Briefcase className="w-5 h-5 text-cyan-500" />;
  if (lowerName.includes("knowledg") || lowerName.includes("learn")) return <BrainCircuit className="w-5 h-5 text-violet-500" />;
  if (lowerName.includes("team") || lowerName.includes("collaborat")) return <Users className="w-5 h-5 text-teal-500" />;
  if (lowerName.includes("innovat") || lowerName.includes("creat")) return <Lightbulb className="w-5 h-5 text-yellow-500" />;
  return <Star className="w-5 h-5 text-primary" />;
};

export function LorTab({ data }: LorTabProps) {
  const lorData = data as LorData;
  const [activeTab, setActiveTab] = useState<"overview" | "attributes" | "business">("overview");

  const attributes = lorData?.Attributes ? Object.values(lorData.Attributes).filter(a => cleanText(a.attribute_overall_description)) : [];
  const businessSkills = lorData?.Business_skills ? Object.values(lorData.Business_skills).filter(b => cleanText(b.attribute_overall_description)) : [];

  if (!lorData || Object.keys(lorData).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4 animate-in fade-in zoom-in duration-300">
        <div className="p-4 rounded-full bg-muted/50">
          <Target className="size-8 opacity-50" />
        </div>
        <p>No Level of Responsibility data has been assigned to this profile.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
      
      {/* Top Banner & Navigation */}
      <div className="shrink-0 mb-6 px-1">
        
        {/* Dynamic Level Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0575E6] via-[#56AAFF] to-[#0575E6] p-6 text-white shadow-md mb-6">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md shrink-0">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white/80 font-medium tracking-wider uppercase text-xs mb-1">
                Level of Responsibility
              </p>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Level {lorData.level || "Unknown"}: <span className="font-medium text-white/90">"{cleanText(lorData.guiding_phrase)}"</span>
              </h1>
            </div>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="grid grid-cols-3 gap-2 bg-surface p-1.5 rounded-xl border border-border/50 shadow-sm">
          <Button
            variant={activeTab === "overview" ? "default" : "ghost"}
            onClick={() => setActiveTab("overview")}
            className="flex items-center justify-center w-full gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap"
          >
            <Info className="w-4 h-4" /> <span className="hidden sm:inline">Description & Notes</span><span className="sm:hidden">Notes</span>
          </Button>
          <Button
            variant={activeTab === "attributes" ? "default" : "ghost"}
            onClick={() => setActiveTab("attributes")}
            className="flex items-center justify-center w-full gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap"
          >
            <Network className="w-4 h-4" /> <span className="hidden sm:inline">Responsibility Attributes</span><span className="sm:hidden">Attributes</span>
          </Button>
          <Button
            variant={activeTab === "business" ? "default" : "ghost"}
            onClick={() => setActiveTab("business")}
            className="flex items-center justify-center w-full gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap"
          >
            <Briefcase className="w-4 h-4" /> <span className="hidden sm:inline">Business Skills</span><span className="sm:hidden">Skills</span>
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pb-16 px-1">
        
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cleanText(lorData.essence_level) && (
              <div className="bg-surface border border-border/60 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <BookOpen className="w-24 h-24" />
                </div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-xl text-foreground">Description</h3>
                </div>
                <p className="text-foreground/80 leading-relaxed text-sm whitespace-pre-line relative z-10">
                  {cleanText(lorData.essence_level)}
                </p>
              </div>
            )}
            
            {cleanText(lorData.guidance_note) && (
              <div className="bg-surface border border-border/60 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Lightbulb className="w-24 h-24" />
                </div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Lightbulb className="w-5 h-5 text-amber-600" />
                  </div>
                  <h3 className="font-bold text-xl text-foreground">Guidance Notes</h3>
                </div>
                <p className="text-foreground/80 leading-relaxed text-sm whitespace-pre-line relative z-10">
                  {cleanText(lorData.guidance_note)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ATTRIBUTES TAB */}
        {activeTab === "attributes" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {attributes.length > 0 ? attributes.map((attr, idx) => (
              <div key={idx} className="bg-surface border border-border/60 rounded-2xl p-6 shadow-sm hover:-translate-y-1 hover:shadow-lg hover:border-primary/30 transition-all duration-300 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center shadow-sm shrink-0">
                    {getAttributeIcon(attr.attribute_name || "")}
                  </div>
                  <h3 className="font-bold text-lg text-foreground leading-tight">
                    {attr.attribute_name}
                  </h3>
                </div>
                <p className="text-sm text-foreground/70 leading-relaxed whitespace-pre-line flex-1">
                  {cleanText(attr.attribute_overall_description)}
                </p>
              </div>
            )) : (
              <p className="col-span-full text-center text-muted-foreground py-8 italic">No responsibility attributes found.</p>
            )}
          </div>
        )}

        {/* BUSINESS SKILLS TAB */}
        {activeTab === "business" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {businessSkills.length > 0 ? businessSkills.map((skill, idx) => (
              <div key={idx} className="bg-surface border border-border/60 rounded-2xl p-6 shadow-sm hover:-translate-y-1 hover:shadow-lg hover:border-emerald-500/30 transition-all duration-300 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center shadow-sm shrink-0">
                    {getAttributeIcon(skill.attribute_name || "")}
                  </div>
                  <h3 className="font-bold text-lg text-foreground leading-tight">
                    {skill.attribute_name}
                  </h3>
                </div>
                <p className="text-sm text-foreground/70 leading-relaxed whitespace-pre-line flex-1">
                  {cleanText(skill.attribute_overall_description)}
                </p>
              </div>
            )) : (
              <p className="col-span-full text-center text-muted-foreground py-8 italic">No business skills found.</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
