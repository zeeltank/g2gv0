"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, CircleAlert, Clock3, Download, FileCheck2, Info, Network, Rocket, ShieldCheck, SkipForward, Users } from "lucide-react";
import { ProtectedLayout } from "@/components/auth/protected-layout";
import { SetupWizardLayout } from "@/components/settings/setup-wizard-layout";
import type { SetupStep } from "@/components/settings/setup-progress-tracker";
import { Alert } from "@/components/ui/alert";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/gtg-auth";
import { EMPTY_ONBOARDING, type OnboardingSummary } from "@/lib/onboarding";

const STEPS: SetupStep[] = [
  { id: "modules", label: "Module Selection" },
  { id: "organization", label: "Organization Details" },
  { id: "department", label: "Department Setup" },
  { id: "employee", label: "Employee Import" },
  { id: "review", label: "Portal Review" },
  { id: "golive", label: "Go Live" },
];
const COMPLETED = new Set(["modules", "organization", "department", "employee"]);

type ReviewCardData = {
  title: string;
  icon: typeof CheckCircle2;
  tone: "primary" | "success" | "warning";
  route: string;
  action: string;
  configured: boolean;
  details: [string, string][];
};

export default function PortalReviewPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [summary, setSummary] = useState<OnboardingSummary>(EMPTY_ONBOARDING);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [checked, setChecked] = useState({ warnings: false, settings: false, year: false });
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const loadSummary = useCallback(async () => {
    if (!user) return;
    setLoadError(false);
    try {
      const response = await fetch(`/api/onboarding?userId=${encodeURIComponent(user.id)}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      setSummary(await response.json());
    } catch { setLoadError(true); } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => {
    const refresh = () => loadSummary();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [loadSummary]);

  const configuredSections = [summary.selectedModules.length > 0, Boolean(summary.organization), summary.departments.length > 0, Boolean(summary.employees)].filter(Boolean).length;
  const completedSections = configuredSections + Number(Boolean(summary.roles));
  const readiness = useMemo(() => Math.round((configuredSections / 4) * 80 + Number(checked.settings) * 10 + Number(checked.year) * 10), [configuredSections, checked]);

  const cards: ReviewCardData[] = [
    {
      title: "Selected Modules", icon: CheckCircle2, tone: "primary",
      route: "/settings/module-configuration", action: "Manage Modules",
      configured: summary.selectedModules.length > 0,
      details: [["Selected Modules", String(summary.selectedModules.length)], ["Module Names", summary.selectedModules.map((module) => module.name).join(", ") || "Not configured"]],
    },
    {
      title: "Organization Details", icon: Building2, tone: "success",
      route: "/module/m1/org-setup/org-profile", action: "View Details",
      configured: Boolean(summary.organization),
      details: [["Company Name", summary.organization?.companyName || "Not configured"], ["Time Zone", summary.organization?.timeZone || "Not configured"], ["Currency", summary.organization?.currency || "Not configured"], ["Financial Year", summary.organization?.financialYear || "Not configured"]],
    },
    {
      title: "Department Setup", icon: Network, tone: "primary",
      route: "/module/m1/org-setup/dept-management", action: "Manage Departments",
      configured: summary.departments.length > 0,
      details: [["Total Departments", String(summary.departments.length)], ["Department Names", summary.departments.join(", ") || "Not configured"]],
    },
    {
      title: "Employee Import", icon: Users, tone: "primary",
      route: "/module/m1/user-management/employee-directory", action: "Review Employees",
      configured: Boolean(summary.employees),
      details: [["Total Employees", String(summary.employees?.total ?? 0)], ["Successfully Imported", String(summary.employees?.successful ?? 0)], ["Warnings", String(summary.employees?.warnings ?? 0)], ["Errors", String(summary.employees?.errors ?? 0)]],
    },
    {
      title: "Roles & Permissions", icon: ShieldCheck, tone: "warning",
      route: "/module/m1/user-management/role-permissions", action: "View Roles",
      configured: Boolean(summary.roles),
      details: [["Total Roles", String(summary.roles?.roles.length ?? 0)], ["Role Names", summary.roles?.roles.join(", ") || "Not configured"], ["Permissions Set", String(summary.roles?.permissionCount ?? 0)]],
    },
  ];

  function downloadSummary() {
    const body = [
      `${summary.organization?.companyName || "HRMS"} - Portal Review Summary`, "",
      `Selected modules: ${summary.selectedModules.map((module) => module.name).join(", ") || "Not configured"}`,
      `Organization: ${summary.organization?.companyName || "Not configured"}`,
      `Departments (${summary.departments.length}): ${summary.departments.join(", ") || "Not configured"}`,
      `Employees: ${summary.employees?.total ?? 0} total, ${summary.employees?.successful ?? 0} successful, ${summary.employees?.warnings ?? 0} warnings, ${summary.employees?.errors ?? 0} errors`,
      `Roles: ${summary.roles?.roles.join(", ") || "Not configured"}`,
      `Readiness: ${readiness}%`,
    ].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url; link.download = "portal-review-summary.txt"; link.click();
    URL.revokeObjectURL(url);
  }
  function saveDraft() {
    localStorage.setItem("gtg-portal-review-draft", JSON.stringify({ checked, savedAt: new Date().toISOString() }));
    setSaved(true);
  }
  function goLive() {
    localStorage.setItem("gtg-portal-live", "true");
    setOpen(false); router.push("/dashboard");
  }

  return <ProtectedLayout><SetupWizardLayout currentStep={5} steps={STEPS} completedSteps={COMPLETED}>
    <div className="mx-auto w-full max-w-[1500px] space-y-5 pb-6">
      <Card><CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Portal Review</h1><p className="mt-1 text-sm text-muted-foreground">Review all the configurations before you go live.</p></div>
          <Button variant="outline" size="lg" onClick={downloadSummary}><Download />Download Summary</Button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_repeat(4,1fr)]">
          <div className="rounded-lg border border-border p-4"><div className="flex justify-between gap-3 text-sm"><b>Overall Progress</b><span>{readiness}% Complete</span></div><Progress className="mt-3" value={readiness} /></div>
          <Metric label="Completed" value={String(completedSections)} icon={CheckCircle2} tone="success" />
          <Metric label="In Progress" value={completedSections > 0 && completedSections < 5 ? "1" : "0"} icon={Clock3} tone="primary" />
          <Metric label="Pending" value={String(5 - completedSections)} icon={CircleAlert} tone="warning" />
          <Metric label="Skipped" value="0" icon={SkipForward} tone="muted" />
        </div>
      </CardContent></Card>
      <Card><CardContent className="p-5">
        <Timeline />
        {loading && <p className="mt-6 text-sm text-muted-foreground">Loading your onboarding configuration...</p>}
        {loadError && <Alert variant="destructive" className="mt-6"><CircleAlert /><span>Could not load the latest onboarding data. <button className="font-semibold underline" onClick={loadSummary}>Try again</button></span></Alert>}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {cards.map((card) => <ReviewCard key={card.title} {...card} onClick={() => router.push(card.route)} />)}
          <Readiness score={readiness} onClick={downloadSummary} />
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr_0.7fr]">
          <Card className="shadow-none">
            <CardHeader className="p-5 pb-3"><CardTitle className="text-base">Validation Checklist</CardTitle></CardHeader>
            <CardContent className="space-y-3 px-5 pb-5">
              <CheckRow label="Organization details are complete" done={Boolean(summary.organization)} />
              <CheckRow label="At least one module is selected" done={summary.selectedModules.length > 0} />
              <CheckRow label="Departments are created" done={summary.departments.length > 0} />
              <CheckRow label="Employees are imported" done={Boolean(summary.employees && summary.employees.total > 0)} />
              <CheckRow label="Admin user is created and active" done={Boolean(summary.roles && summary.roles.roles.length > 0)} />
              {summary.employees && summary.employees.warnings > 0 && <div className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2"><CircleAlert className="size-4 text-warning" />{summary.employees.warnings} employee{summary.employees.warnings > 1 ? "s have" : " has"} warnings</span><Badge variant={checked.warnings ? "success" : "warning"}>{checked.warnings ? "Resolved" : "Warning"}</Badge></div>}
              <p className="text-xs text-muted-foreground">{Number(Boolean(summary.organization)) + Number(summary.selectedModules.length > 0) + Number(summary.departments.length > 0) + Number(Boolean(summary.employees && summary.employees.total > 0)) + Number(Boolean(summary.roles && summary.roles.roles.length > 0)) + (summary.employees && summary.employees.warnings > 0 ? (checked.warnings ? 1 : 0) : 1)}/6 validations complete</p>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader className="p-5 pb-3"><CardTitle className="text-base">Action Required</CardTitle></CardHeader>
            <CardContent className="space-y-2 px-5 pb-5">
              <Action icon={Users} title={summary.employees && summary.employees.warnings > 0 ? `Review ${summary.employees.warnings} Employee Warning${summary.employees.warnings > 1 ? "s" : ""}` : "Review Employee Records"} description={summary.employees && summary.employees.warnings > 0 ? "Some employee records need your attention." : "All employee records imported successfully."} done={checked.warnings} onClick={() => setChecked((x) => ({ ...x, warnings: true }))} />
              <Action icon={Info} title="Verify Organization Settings" description="Review your organization preferences." done={checked.settings} onClick={() => setChecked((x) => ({ ...x, settings: true }))} />
              <Action icon={FileCheck2} title="Confirm Financial Year" description="Make sure the financial year is correct." done={checked.year} onClick={() => setChecked((x) => ({ ...x, year: true }))} />
            </CardContent>
          </Card>
          <Card className="border-success/30 bg-success/5 shadow-none"><CardContent className="flex h-full flex-col items-center justify-center p-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-success text-success-foreground"><Check className="size-6" /></span>
            <h2 className="mt-4 text-lg font-semibold text-success">Ready to Go Live</h2>
            <p className="mt-1 max-w-56 text-sm text-muted-foreground">Your HRMS portal is ready. Make it available for all users.</p>
            <Button className="mt-5 w-full bg-success hover:bg-success/90" size="lg" onClick={() => setOpen(true)}><Rocket />Go Live</Button>
            <Button variant="link" onClick={saveDraft}>{saved ? "Draft Saved" : "Save as Draft"}</Button>
          </CardContent></Card>
        </div>
        {saved && <Alert variant="success" className="mt-5"><CheckCircle2 /><span>Your portal review draft has been saved locally.</span></Alert>}
        <div className="mt-5 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
          <Button variant="outline" size="lg" onClick={() => router.push("/organization/setup")}><ArrowLeft />Back to Employee Import</Button>
          <Button size="lg" onClick={() => setOpen(true)}>Go Live<ArrowRight /></Button>
        </div>
      </CardContent></Card>
    </div>
    <AlertDialog open={open} onOpenChange={setOpen}><AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Make your portal live?</AlertDialogTitle><AlertDialogDescription>This finishes setup and opens the HRMS portal to your users. Settings remain editable afterward.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button className="bg-success hover:bg-success/90" onClick={goLive}><Rocket />Confirm Go Live</Button></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </SetupWizardLayout></ProtectedLayout>;
}
type Icon = typeof Check;

function Metric({ label, value, icon: I, tone }: { label: string; value: string; icon: Icon; tone: "success" | "primary" | "warning" | "muted" }) {
  const color = { success: "bg-success text-success-foreground", primary: "bg-primary text-primary-foreground", warning: "bg-warning text-warning-foreground", muted: "bg-muted text-muted-foreground" }[tone];
  return <div className="flex items-center gap-3 rounded-lg border border-border p-4"><span className={cn("flex size-8 items-center justify-center rounded-full", color)}><I className="size-4" /></span><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div></div>;
}

function Timeline() {
  return <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{STEPS.map((step, i) => {
    const done = i < 4; const current = i === 4;
    return <li className="relative text-center" key={step.id}>
      {i > 0 && <span className={cn("absolute right-1/2 top-4 hidden h-px w-full lg:block", done ? "bg-success" : "border-t border-dashed border-border")} />}
      <span className={cn("relative mx-auto flex size-8 items-center justify-center rounded-full border text-sm font-semibold", done && "border-success bg-success text-success-foreground", current && "border-primary bg-primary/10 text-primary ring-4 ring-primary/10", !done && !current && "border-border text-muted-foreground")}>{done ? <Check className="size-4" /> : i + 1}</span>
      <p className="relative mt-2 text-xs font-semibold">{step.label}</p><p className={cn("mt-1 text-xs", done ? "text-success" : current ? "text-primary" : "text-muted-foreground")}>{done ? "Completed" : current ? "In Progress" : "Pending"}</p>
    </li>;
  })}</ol>;
}

function ReviewCard({ title, icon: I, tone, action, details, onClick }: ReviewCardData & { onClick: () => void }) {
  return <Card className="flex min-h-72 flex-col overflow-hidden shadow-none">
    <div className="flex items-center gap-3 border-b border-border bg-muted/30 p-4"><span className={cn("flex size-10 items-center justify-center rounded-lg", tone === "success" ? "bg-success/10 text-success" : tone === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary")}><I className="size-5" /></span><div><h2 className="text-sm font-semibold">{title}</h2><p className="text-xs font-medium text-success">Completed</p></div></div>
    <CardContent className="flex flex-1 flex-col p-4"><dl className="space-y-3">{details.map(([label, value]) => <div className="border-b border-border pb-2 last:border-0" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className={cn("text-xs font-semibold", label === "Warnings" && "text-warning", label === "Errors" && "text-destructive", label === "Successfully Imported" && "text-success")}>{value}</dd></div>)}</dl><Button variant="outline" className="mt-auto w-full border-primary/40 text-primary" onClick={onClick}>{action}</Button></CardContent>
  </Card>;
}

function Readiness({ score, onClick }: { score: number; onClick: () => void }) {
  return <Card className="min-h-72 border-success/20 bg-success/5 shadow-none"><CardContent className="flex h-full flex-col items-center p-4 text-center">
    <span className="flex size-10 items-center justify-center rounded-lg bg-success/10 text-success"><Rocket className="size-5" /></span><h2 className="mt-2 text-sm font-semibold">Portal Readiness</h2>
    <div className="mt-4 flex size-28 items-center justify-center rounded-full border-[9px] border-success/20 border-r-success border-t-success"><div><p className="text-3xl font-bold">{score}%</p><p className="text-[10px] text-muted-foreground">Readiness Score</p></div></div>
    <p className="mt-4 text-xs font-medium text-success">Your portal is almost ready to go live!</p><Button variant="outline" className="mt-auto w-full border-primary/40 text-primary" onClick={onClick}>View Summary</Button>
  </CardContent></Card>;
}

function CheckRow({ label, done }: { label: string; done: boolean }) {
  return <div className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2">{done ? <CheckCircle2 className="size-4 text-success" /> : <CircleAlert className="size-4 text-warning" />}{label}</span><Badge variant={done ? "success" : "warning"}>{done ? "Completed" : "Pending"}</Badge></div>;
}

function Action({ icon: I, title, description, done, onClick }: { icon: Icon; title: string; description: string; done: boolean; onClick: () => void }) {
  return <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3"><span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", done ? "bg-success/10 text-success" : "bg-primary/10 text-primary")}><I className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{title}</p><p className="text-[11px] text-muted-foreground">{description}</p></div><Button size="sm" variant="outline" disabled={done} onClick={onClick}>{done ? "Done" : "Review"}</Button></div>;
}
