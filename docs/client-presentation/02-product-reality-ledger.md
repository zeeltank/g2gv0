# 02 Product reality ledger (Slice 0)

> **Round 2 correction, 2026-11-24 (read this first; it overrides the older text below where they differ).**
> Owner decision: every product is complete, so **no customer slide, clip or PowerPoint carries a status label** (no LIVE / PARTIAL / CONCEPTUAL badge, no "works today / partly built", no "ahead" or "not built" panel, no dashed "design intent" lines). The "suggested badge" headings below are kept as history only. What stays is the evidence rule: a customer slide shows only what a file or a screen proves, and limits live in the presenter notes (`limits` in the story file), never on the slide.
> Re-read in source on 2026-11-24 (`next_lms_erp`, `lms_k12`), with the effect on the deck:
> 1. **Practice results become career evidence automatically: built in the backend** (`ConceptOutcomeRecorded` to the queued `GeneratePalEvidenceListener` to `PalAdaptiveEvidenceAdapter`; needs at least 2 mastered concepts and a running queue worker, production worker not confirmed). Surprise 6 below is **wrong on this point**. Slide 13 now shows two solid connections (exam to career evidence, practice mastery to career evidence), with the 2-concept minimum kept in the presenter notes.
> 2. **Learning goal:** a student can record a career aspiration and how sure they are (`student_aspirations`); there is still no learning target (mastery, grade, chapter) and the PAL plan stays read-only. Slides say "career aspiration", never "learning goal".
> 3. **Principal's morning:** a real leadership overview exists (`/enterprise-brain`: health score, what changed, what is at risk, priority actions). It is not a daily brief; at-risk students and classes come from attendance only, and teachers needing development sit on a different page. Slide 14 says "leadership overview" and nothing more.
> 4. **Staff gap suggests or assigns learning in schools: absent.** No K-12 responder, listener or route. The K-12 CCB screen has an **Assign Learning button that calls routes which do not exist**: never click it in a demo, never show it in a clip. This is a product bug to fix, not a slide claim.
> 5. **Insight's decision step:** the academic-risk case offers approve and reject; a third choice (defer) exists in the backend and on the fee screen only. Slide 11 shows approve and reject.
> 6. **Product naming:** the UI is branded "Teach Connect"; the words Scholar Core / Learn / CCB / Insight / Compass never appear in it. Clips are rendered in two versions (Scholar frame with the UI name visible, and the UI name hidden) and one is chosen by the rule in `11-explainer-style-notes.md`.

What each ScholarClone product really is in code, what a slide may say, and what it must not say. Date 2026-11-23.
Repos read (read-only): `next_lms_erp` 6ac0b5047 (branch milan1) = K-12 Laravel/Blade backend "NL"; `lms_k12` 1b2b99bb = Next.js front end for NL "K12"; `hp_erp` 03a4b219 = G2G backend; `g2gv0` fea8fd3 = G2G front end.
Tags: **verified** = I re-read it in source myself; **scout** = a read-only sub-agent reported it, not re-checked. "Built in code" means route + controller/service + table + UI file exist. It does **not** mean production data or a live deployment (the scout did not read production rows; the NL notes call the 27 `pal_*` tables "sparsely populated").

## 1. Surprises that change the deck
1. **Two stacks.** ScholarClone K-12 = `next_lms_erp` + `lms_k12`. `hp_erp` + `g2gv0` are the **G2G corporate** stack (HR, competency, LMS, CRM). The full CCB loop (role map, course map, event reactor) exists only in the G2G stack, for employees. (scout)
2. **"Signals" is not Insight.** Signals in hp_erp/g2gv0 is a sales-prospecting engine. The school-leadership engine is the NL "Brain", UI in `lms_k12/app/enterprise-brain`. Never show Signals screens as Scholar Insight. (scout)
3. **Insight is narrower than its copy.** One cross-function correlation exists (attendance vs results, only when 6 or more classes match), per-function signals and a health score, plus an on-demand risk agent. The page's "traces weak results to their root" is stronger than the code. (CrossModuleInsights.php function list: verified; rest scout)
4. **No learner-set learning goal exists.** The PAL plan is a derived read-only projection; `LearningPlanService` "deliberately owns no table" (verified, LearningPlanService.php:27). The master prompt's "Learning goal" step must read "plan derived from the diagnostic", not "student sets a goal".
5. **IPIP does not exist** in the K-12 repos (verified: the only hit is the portfolio file's own text). NCDG is a content tag, not an assessment (scout). Career interest uses the O*NET Interest Profiler, MBTI and student aspirations (scout).
6. **Only one learner-to-career connection is event-driven:** a submitted online exam fires `ExamSubmitted` (onlineExamController.php:248) mapped to `GenerateAssessmentEvidenceListener` (EventServiceProvider.php:25-26), which writes career evidence (verified to the listener; the writer chain is scout). PAL practice reaches Compass only via a manual artisan command (scout).
7. **CCB "evidence" does not feed the gap.** Gaps are computed from ratings (assessment scoring, self or manager rating), not from evidence rows (scout). So the CCB slide must say "ratings", with evidence kept as supporting record.
8. **CCB to Learn is verified, but for employees.** `events:react` runs every 10 minutes (hp_erp routes/console.php:133, verified) and `CapabilityGapResponder` assigns a mapped course or raises a request (file exists: verified; behaviour scout). Not a K-12 student loop.

## 2. Capability ledger (what the deck may claim)
Suggested badge uses your label set. "You said all six are built", so each row's badge is a **proposal for you to confirm**, not a downgrade.

### Scholar Core (NL): suggested badge LIVE (owner to confirm)
| Capability | Verdict | Evidence (scout unless marked) | May say | Must not say |
|---|---|---|---|---|
| Admissions | Built in code | routes/admission.php:15-16, 8 controllers, 33 views | enquiry, registration, follow-up, reports | conversion numbers |
| Student records | Built | routes/student.php (174 routes), ~45 controllers | one student record across the school | "single login" until confirmed |
| Fees | Built | routes/fees.php (163 routes, online fees, NACH, cheque reconciliation) | collection, online payment via the school's gateway | savings figures |
| Attendance (student + staff) | Built | student.php, hrms.php | daily marking, reports | biometric/automatic claims |
| HR / payroll | Built, old Blade UI | routes/hrms.php, 17 payroll views | salary structure, monthly payroll, PDF, Form 16 | "modern UI" (it is legacy) |
| Examinations / results | Built | routes/result.php (141 routes), CBSE and co-scholastic | exam creation, marks entry, report cards | board-approval claims |
| Parent communication | Built staff-to-parent | SMS/email/notification to parents, WhatsApp reply, PTM booking | staff reach parents; PTM booking | a parent portal (none found) |

### Scholar Learn (NL + K12): suggested badge PARTIAL
| Step | Verdict | Evidence | May say | Must not say |
|---|---|---|---|---|
| Assessment to diagnosis | Built | pal/diagnostic routes; DiagnosticScorer concept breakdown with weak / moderate / strong bands (cut-offs 40 / 70) | finds which concepts a student is weak in | accuracy %, "AI diagnoses" |
| Plan | Built, **derived**, no goal object | LearningPlanService (owns no table: verified) | plan drawn from the diagnostic | student-set goals |
| Content recommendation, practice | Built | RecommendationEngine, AdaptiveLearningService | next content and practice at the right difficulty | personalised "for every student" as a proven result |
| Evaluation, next step | Built | PracticeOutcomeService decides one action (escalate, remediate, reteach, mastery check, advance); BKT engine; ESO next-action | one clear next action after practice | mastery-rate or speed-up figures |
| AI help for teachers | Built (API + K12 UI) | question and content generation via a provider chain resolved from DB | drafts questions and activities for teacher review | "replaces teachers"; "reviewed before students see it" is a **site claim not yet checked in code** |
Open check: which AI provider/model runs in production lives in the DB (scout did not read it); do not name a model on a slide.

### Scholar CCB: suggested badge PARTIAL for a school
| Step | Verdict | Note |
|---|---|---|
| Role to competencies | Built in G2G stack; K-12 copy has **no role map** | scout |
| Ratings (KASBA) | Built (both) | rating sources: assessment, self, manager |
| Evidence | Partial: stored, does **not** feed the gap | scout |
| Gap, development plan, progress | Built (G2G stack; older copy in NL) | scout |
| Course map and auto-assign | **G2G employee LMS only** | verified schedule, scout behaviour |
Deck wording: "Role, competencies, ratings, gaps, development plan, progress". Show a teacher scenario as **illustrative**. Do not claim the course-assignment loop for K-12 teachers.

### Scholar Insight: suggested badge PARTIAL
Built: per-function signal rules (fees, attendance, admissions, results, HR, library, transport), health score from 8 dimensions, one attendance-vs-results correlation, on-demand AcademicRiskAgent joining assessment decline + attendance risk + missed assignments into a case with a recommendation (no scheduler entry found in `Kernel.php`: verified; other scheduler files not checked). May say "brings signals from several functions to one view; helps spot where attention is needed". Must not say "traces weak results to their root", "predicts", or "identifies at-risk students early".

### Scholar Compass: suggested badge PARTIAL
Built: interest profiler, MBTI, aspirations, alignment recommendation and narrator. **Needs a Neo4j graph**: confirm it runs in production. May say "interests, aspirations and learning evidence". Must not say "competencies" or "KASBA" for students (no link), IPIP, or any career outcome.

### Scholar One: suggested badge CONCEPTUAL as a platform layer
Verified connections only: (a) submitted exam to career evidence (verified to the listener); (b) attendance + results to an Insight correlation, and the on-demand risk case (scout; function list verified). Everything else on slide 13 is labelled **conceptual**: Learn practice to Compass (manual command only), CCB to Compass (crosswalk empty until HR fills it), CCB to Learn for school teachers, any view joining Learn + CCB + Compass. "One login and shared records, nothing entered twice" is a site claim: **not verified**.

## 2b. Corrections after re-reading source (2026-11-23, later)
The scout's report was re-read line by line before any slide used it. What changed:
- **The K-12 copy of the competency module does have a role map** (`routes/competency_management.php:200-203, 317-319`), plus rating (146-148), gap (157) and development-plan actions (122-131). The scout said it had none; that was wrong. What it does **not** have is the staff-wide progress roster (`capability-progress`), which exists only in the G2G stack. So on slide 10: Role and Competencies are built, Progress is partial ("action by action").
- **Rating sources** (assessment, self, assessor) are verified only in hp_erp's `RatingWriter`, not in the K-12 copy, so no school slide states them.
- **Compass route line numbers** from the scout were wrong (those lines are timetable routes). The real routes are `lms.php:405 intrestQuestions`, `:299 lmsMBTIPaper`, `:418-419 studentAspiration`, `:435 careerRecommendation`. "O*NET" was not found in the controller, so it is not named.
- **Report cards**: no route named report card was found; slides say "result reports".
- **Core, Learn, Insight, Compass claims** used on slides were re-read in source and are now `verified` at route / code level. "Verified" means the code is there, not that it ran or has production data.
- Still not verified anywhere: production data, a graph service for career alignment, which AI model runs, any review step for AI-drafted questions, and "one login".

## 3. Decisions I need from you at this checkpoint
(Answered by the owner on 2026-11-23: badges approved; wording corrections approved; "one login" and "AI questions reviewed" not used; no customer named; discovery call kit prepared; real screenshots only. See `00-PROGRESS.md`.)
1. Approve or edit the suggested badges above (Core LIVE; Learn, CCB, Insight, Compass PARTIAL; One CONCEPTUAL as a layer). If you want all six shown as plain "available", say so and I will keep the limits only in speaker notes.
2. Slide wording fixes that follow from the code: "Learning goal" becomes "plan drawn from the diagnostic"; CCB "Evidence" becomes "Ratings"; Compass drops "competencies".
3. May the deck state "one login, nothing entered twice" and "AI questions are reviewed before students see them"? Both are unverified site claims.
4. Name Anand Niketan or any customer? Default no.
5. Can a real principal or trustee sit for a recorded 20-minute discovery call (Slice 1 adds the capture sheet)? There is no buyer language in the CRM.
6. Is the K-12 platform available to show live (screens for screenshots)? No real screenshots exist; slots stay labelled placeholders until supplied.
