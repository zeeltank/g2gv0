# 03 Storyboard: ScholarClone client presentation (Slice 1 draft)

Generated from `content/scholarclone.story.json` by `scripts/client-presentation/check-story.mjs --render`. Edit the JSON, not this file.

**Owner decisions applied**

- Badges approved: Core LIVE; Learn, CCB, Insight, Compass PARTIAL; One CONCEPTUAL. Actual and planned functionality are always shown apart.
- Wording corrected to match code: learning goal -> plan drawn from the diagnosis; CCB evidence -> ratings; Compass drops competencies.
- Not used until independently verified: 'one login, nothing entered twice'; 'AI questions are reviewed before students see them'.
- No customer named without explicit written permission.
- Buyer claims only after a real recorded discovery call; never invented.
- Real screenshots from an authorised environment; labelled placeholders until received.
- Story direction approved (conditional) on 2026-11-23: every fact traceable; illustrative never shown as real; PARTIAL distinguished from LIVE; no unsupported marketing claims; existing G2G Sales Training untouched. Not yet approval of the rendered deck.
- Slide 15 invitation wording approved. Slide 8 mastery-paths line removed until independently verified.
- Discovery call arranged by the internal Sales/Management team; no invented feedback; explicit recording consent first. Screenshots only from an authorised staging/demo environment, personal data masked, source and licence register kept.
- 2026-11-24: all six products are presented as complete. No status labels (LIVE, PARTIAL, CONCEPTUAL) and no 'not built yet' panels appear anywhere a customer can see. A capability appears only when a file or a screen proves it; what the code review could not find stays in the presenter-only 'limits' of each slide.

## Slide 1: hook

**Takeaway.** The school promoter stops and asks what they are missing.

**On the slide**

- What is your school not seeing?
- Even when it has the data, the reports and the software.
- Discover what becomes possible when your school starts connecting the dots.

**Visual.** A real photograph of a modern Indian classroom in soft morning light, slightly out of focus. A few fine points of light hover above desks; faint lines start between two or three points, then fade. The picture never fully resolves. No logo, no product name, no interface, no robot.

**Motion (and what it means).** GSAP timeline: slow rack-focus between two depth planes; points of light appear, lines draw (DrawSVG) and dissolve before they connect. Headline words settle with SplitText, one beat apart. Meaning carried: something is there but not yet connected. Reduced motion: a still frame with the points visible and no drawing.

**Say.** Pause on the question. Do not explain anything. Let them answer first: what do you think a school like yours might not be seeing?

**Ask.** What would you say your school is not seeing today?

**Transition.** You already hold a lot of information. Let us look at where it comes from.

**Image slots.** img-hook (photo): Modern Indian school classroom, students and teacher, natural light, shallow depth of field. Licensed photo; AI image only if the owner says yes.

## Slide 2: hidden-question

**Takeaway.** The problem is often not missing data; it is data that has not been connected.

**On the slide**

- What if the information your school already has could help you see more clearly?
- Student performance
- Attendance
- Fees
- Teacher activities
- Examinations
- School operations
- Parent communication
- Learning activities
- The challenge is not always missing data. Sometimes it is connecting what you already have.

**Visual.** A real photograph of a principal at a desk, seen from behind or in profile, face not the focus. Eight labels sit around them as quiet paper-like tags.

**Motion (and what it means).** GSAP: the eight tags drift in from their own depth and settle; a single thread then passes between two of them and holds. Meaning carried: the sources exist; connection is what is missing. Motion layout for the tag ring uses Motion (layout) so the ring re-flows on resize.

**Say.** Every school already produces all of these. Ask which of them the principal sees together on one day.

**Ask.** Which two of these do you look at side by side today?

**Transition.** Let us make this real with one student.

**Image slots.** img-principal (photo): School principal at a desk in an Indian school office, not looking at camera. Licensed photo.

## Slide 3: familiar-situation

**Takeaway.** Recording a problem is not the same as knowing the next learning step.

**On the slide**

- A student keeps struggling. The school has the records. What happens next?
- Examination marks
- Classroom observations
- A parent's concern
- Recorded: the problem is written down.
- Understood: the gap is found, the next learning step is clear, and progress is reviewed.
- Illustrative situation, to validate with you

**Visual.** A student at a desk with a notebook (real photograph, face turned away). Three record cards float beside the student. A fourth, empty card reads only a question mark.

**Motion (and what it means).** GSAP Flip: the three cards slide together into one stack, then the stack splits into the two columns (Recorded / Understood), so the viewer sees the same records either left on a shelf or carried forward. Meaning carried: same information, two outcomes.

**Say.** Make clear this is an illustration, not a customer story. Ask them to recognise it, not to agree with us.

**Ask.** Does this happen in your school? What usually happens after the marks are in?

**Transition.** So what separates a record from a next step?

**Image slots.** img-student (photo): Indian school student writing in a notebook, face turned or hands only. Licensed photo.

## Slide 4: info-to-action

**Takeaway.** Information becomes useful only when it moves through understanding to action and review.

**On the slide**

- Information is not yet action.
- School information
- Understanding
- Identifying the gap
- Deciding what to do
- Taking action
- Reviewing progress
- Where does your school's information stop today?
- Which of these matters most to you?
- A principal's morning
- A student who is struggling
- A teacher who needs development
- A difficult leadership decision
- A student exploring a future

**Visual.** One clean line with six nodes, large type, plenty of space. No architecture diagram, no AI imagery.

**Motion (and what it means).** GSAP DrawSVG draws the line node by node as the presenter advances; each node lights only when its step is spoken. After the sixth, five chips appear (Motion AnimatePresence). Choosing a chip routes to the matching scenario (slides 14, 8, 10, 11, 12) and returns to this slide. Nothing is scored.

**Say.** Walk the line slowly. Then stop and ask where their information stops. Let the leader pick the chip; follow the leader, not the script.

**Ask.** Where does your school's information stop today? Which situation matters most to you?

**Transition.** Let us look at how a school can close that gap.

## Slide 5: introducing

**Takeaway.** ScholarClone connects information, supports decisions and helps the school act.

**On the slide**

- ScholarClone
- An integrated intelligent K–12 platform designed to help schools connect information, support better decisions and take meaningful action.  _[C-POS: owner-confirmed]_
- School Intelligence means helping a school understand what its information is telling it, where attention is needed and what action may be appropriate next.  _[C-DEF: owner-confirmed]_

**Visual.** ScholarClone logo ring from the brand assets (the product page's own embedded logo), set on a calm field in brand navy and blue. First appearance of the product name in the deck.

**Motion (and what it means).** The opening line pattern from slide 4 closes into the logo ring (GSAP morph of the line into the ring). Meaning carried: the platform is the answer to the line you just saw.

**Say.** Only now introduce the name. Read the definition once in plain words. Tell them the deck will always mark what works today and what is ahead.

**Ask.** Does that match how you would describe what you need?

**Transition.** Here is how the pieces fit together.

**Image slots.** img-logo (brand): ScholarClone logo ring extracted from the product page. Owner to confirm the file to use.

## Slide 6: ecosystem

**Takeaway.** Six products around one idea, each with an honest status.

**On the slide**

- Six products, one idea: see, decide, act.
- Scholar One: Integrated Intelligent School Platform  _[C-NAMES: verified]_
- Scholar Core: Intelligent School Operations  _[C-NAMES: verified]_
- Scholar Learn: AI-Powered Personalised Learning  _[C-NAMES: verified]_
- Scholar CCB: Competence and Capability Intelligence  _[C-NAMES: verified]_
- Scholar Insight: School Intelligence  _[C-NAMES: verified]_
- Scholar Compass: Student Career Intelligence  _[C-NAMES: verified]_
- One intelligent platform connecting the entire school.  _[C-NAMES: verified]_

**Visual.** Core at the base as the foundation; Learn, CCB and Compass around it; Insight above; One drawn as a ring around all. Not six equal cards.

**Motion (and what it means).** GSAP builds the diagram from the base up, one product per beat. Motion layoutId lets a tapped product expand into its own slide (7 to 12) and shrink back. Meaning carried: how the products relate and which are ready.

**Say.** Do not read all six. Say what each one is for in one phrase, then point at the badges: this is where we are honest about status.

**Ask.** Which of these would you start with if you had to choose one?

**Transition.** Start with the part that runs the school every day.

## Slide 7: core

**Takeaway.** The everyday work of the school moves from registers into workflows.

**On the slide**

- The everyday work of the school, off the registers and into workflows
- Fees: collection, online payment through the school's payment gateway, and cheque reconciliation.  _[C-CORE-FEE: verified]_
- Attendance: daily student and staff attendance with reports.  _[C-CORE-ATT: verified]_
- Examinations: exam creation, marks entry and result reports.  _[C-CORE-EXM: verified]_
- Also: admissions, student records, staff payroll, and messages to parents.  _[C-CORE-ADM: verified]_
- School situation (typical, to validate): collection, registers and marks are kept by hand and compiled at the end.  _[C-ILL: owner-confirmed]_
- What could become easier: a clearer picture of collection, absence and results without compiling by hand.
- Screenshot to be supplied from an authorised environment.

**Visual.** Three real screenshot frames (fees, attendance, marks entry) set in a device frame, with labelled placeholders until received. Never a fake interface.

**Motion (and what it means).** Motion layout: three rows open one at a time to reveal today, challenge, what the product does, value. GSAP only animates the frame entrance. Meaning carried: one row at a time keeps attention on a single workflow.

**Say.** Pick the one workflow the leader cares about. Detail for the other four is in the notes and a supporting slide.

**Ask.** Where do you currently find out something has gone wrong in fees or attendance?

**Transition.** Operations tell you what happened. Learning shows what to do about it for a student.

**Image slots.** shot-fees (screenshot): Fee collection screen, demo data, authorised environment. | shot-attendance (screenshot): Student attendance marking screen, demo data. | shot-marks (screenshot): Marks entry or report card screen, demo data.

## Slide 8: learn

**Takeaway.** From 'which students failed' to 'what each student should learn next'.

**On the slide**

- From 'who failed' to 'what to learn next'
- Assessment
- Diagnosis  _[C-LRN-DIAG: verified]_
- Plan drawn from the diagnosis  _[C-LRN-PLAN: verified]_
- Content for the weak concepts  _[C-LRN-REC: verified]_
- Practice at the right level  _[C-LRN-PRAC: verified]_
- Evaluation
- Next learning step  _[C-LRN-NEXT: verified]_
- A diagnostic that finds weak concepts, a plan drawn from it, recommended content, adaptive practice and one clear next action.  _[C-LRN-NEXT: verified]_
- Screenshot to be supplied from an authorised environment.

**Visual.** A horizontal journey with seven steps, a student photograph at the start and a real diagnostic screenshot frame (placeholder) at the third step.

**Motion (and what it means).** GSAP timeline follows one student's journey; a marker travels step to step on advance. Motion handles the step panel that opens under each marker. Meaning carried: the order of the learning loop and where the student is in it.

**Say.** In plain words: find what the student does not yet understand, plan from it, practise, check, then decide what comes next. Say clearly that students do not set their own goals in the product today.

**Ask.** How does a teacher find out today which concept a student is stuck on?

**Transition.** Teachers carry the rest of this load. Here is where AI helps them.

**Image slots.** shot-diagnostic (screenshot): Diagnostic result with concept breakdown, demo student.

## Slide 9: teacher-ai

**Takeaway.** AI helps teachers prepare; it does not replace them.

**On the slide**

- Less time preparing, more time coaching
- AI can draft questions and learning content for school staff to use.  _[C-LRN-GEN: verified]_
- Chapter content can become flashcards, true/false questions or a short presentation.  _[C-LRN-H5P: verified]_
- What could become easier: repeated preparation, more activity options for different learning needs, and more time to coach and mentor.
- AI supports the teacher. The teacher stays in charge of the classroom.
- Chapter content  _[C-LRN-H5P: verified]_
- Flashcards  _[C-LRN-H5P: verified]_
- True/false questions  _[C-LRN-H5P: verified]_
- A short presentation  _[C-LRN-H5P: verified]_
- Screenshot to be supplied from an authorised environment.

**Visual.** A real photograph of a teacher with a small group of students, with a short before/after pair of generated items (an example question set) shown as a real screenshot placeholder.

**Motion (and what it means).** Motion shared-layout: one chapter paragraph expands into three activity options and back. Meaning carried: one source, several forms.

**Say.** Keep it concrete: the teacher picks a chapter and gets drafts to adjust. Do not promise checking or approval steps until verified.

**Ask.** Which part of preparation takes most of your teachers' time today?

**Transition.** Teachers also need support to grow. Here is how that can be tracked.

**Image slots.** img-teacher (photo): Indian school teacher with small group of students, natural light. Licensed photo. | shot-generate (screenshot): Question or content generation screen, demo data.

## Slide 10: ccb

**Takeaway.** Staff development moves from occasional training to ratings, gaps, a plan and tracked progress.

**On the slide**

- From occasional training to continuing development
- Role  _[C-CCB-ROLE: verified]_
- Competencies  _[C-CCB-ROLE: verified]_
- Ratings  _[C-CCB-RATE: verified]_
- Gap  _[C-CCB-GAP: verified]_
- Development plan  _[C-CCB-PLAN: verified]_
- Progress, action by action  _[C-CCB-PLAN: verified]_
- Staff are rated on each competency, a gap view shows where they stand, and a development plan with actions can be updated.  _[C-CCB-RATE: verified]_
- Illustrative teacher situation, to validate with you
- Screenshot to be supplied from an authorised environment.

**Visual.** A real photograph of a teacher in a staff room or corridor. A six-step journey strip.

**Motion (and what it means).** GSAP draws the journey; the 'Gap' step pulses once, the only place the strip pulses. Meaning carried: the gap is the pivot between knowing and developing.

**Say.** Use an unnamed teacher. Describe ratings, a gap view and a development plan with actions that can be updated.

**Ask.** How do you know today whether a training you ran changed what a teacher can do?

**Transition.** Everything so far produces signals. Leaders need them in one place.

**Image slots.** img-staffroom (photo): Teacher in school corridor or staff room, Indian context, licensed photo. | shot-gap (screenshot): Competency gap or development plan screen, demo data.

## Slide 11: insight

**Takeaway.** Signals from different functions help a leader see where attention is needed, and a person decides.

**On the slide**

- See where attention is needed. Decide. Review.
- Information  _[C-INS-SIG: verified]_
- Identify a gap  _[C-INS-CORR: verified]_
- Understand the situation  _[C-INS-CASE: verified]_
- Decide an action  _[C-INS-GATE: verified]_
- Monitor progress
- Signals from several functions, an attendance and results comparison across classes, and an academic-risk case that joins results, attendance and assignments. Recommendations wait for a person to approve or reject them.  _[C-INS-GATE: verified]_
- This shows association between measures, not cause.
- Illustrative case, to validate with you
- Fall in assessment results  _[C-INS-CASE: verified]_
- Attendance risk  _[C-INS-CASE: verified]_
- Missed assignments  _[C-INS-CASE: verified]_
- One case, with a recommended action  _[C-INS-CASE: verified]_
- Approve  _[C-INS-GATE: verified]_
- Reject  _[C-INS-GATE: verified]_
- Screenshot to be supplied from an authorised environment.

**Visual.** A single case card (real screenshot placeholder), a hand over an approve / reject / defer choice. Not a dashboard wall.

**Motion (and what it means).** GSAP: three signal threads converge into the case card; Motion AnimatePresence swaps the card between approve, reject and defer states. Meaning carried: three signals become one decision a person makes.

**Say.** This is decision support, not automation. Say the comparison shows a link, not a cause. Do not describe it as a forecast or as finding students early.

**Ask.** When a report arrives, who decides what happens next, and where is that recorded?

**Transition.** One more thread: where does a student's future fit in?

**Image slots.** shot-case (screenshot): Academic-risk case with recommendation, demo data.

## Slide 12: compass

**Takeaway.** Career conversations can start from a student's interests and learning evidence.

**On the slide**

- A career conversation that starts from evidence
- Students can answer interest questions and a personality questionnaire, and record their aspirations and how sure they are.  _[C-CMP-PROF: verified]_
- An aspiration is compared with interests and learning evidence. When the evidence is thin, the result says so and does not guess.  _[C-CMP-ALIGN: verified]_
- This guides exploration. It does not forecast a student's career.
- Illustrative situation, to validate with you
- Interests  _[C-CMP-PROF: verified]_
- Learning evidence  _[C-CMP-ALIGN: verified]_
- Aspiration  _[C-CMP-PROF: verified]_
- Aligned  _[C-CMP-ALIGN: verified]_
- Not aligned  _[C-CMP-ALIGN: verified]_
- Not enough evidence  _[C-CMP-ALIGN: verified]_
- Screenshot to be supplied from an authorised environment.

**Visual.** A real photograph of a senior-class student with a counsellor, neutral and warm. A screenshot frame for the alignment result (placeholder).

**Motion (and what it means).** GSAP brings two circles (interests, learning evidence) together; the overlap shows the alignment result; if the circles stay apart a labelled 'not enough evidence' state shows instead. Meaning carried: honesty when evidence is missing.

**Say.** Lead with the honest part: when there is not enough evidence the product says so. Never say competencies or any career outcome.

**Ask.** What does career guidance look like for your senior classes today?

**Transition.** Now the part that matters most: how these connect.

**Image slots.** img-counsel (photo): Senior student with a school counsellor, Indian context, licensed photo. | shot-alignment (screenshot): Career alignment result screen, demo data.

## Slide 13: connected

**Takeaway.** Information from one part of the school reaches the others without being re-entered.

**On the slide**

- How the pieces work together
- School operations
- Student learning
- Leadership
- Career exploration
- A submitted online exam, and concepts a student masters in practice, are added to that student's career evidence automatically.  _[C-ONE-EVID: verified]_
- Attendance and results are compared across classes.  _[C-ONE-ATTRES: verified]_
- Results, attendance and assignments are joined into one risk case.  _[C-ONE-RISK: verified]_

**Visual.** Four domains placed as a map and three solid connections. Clean line drawing, no glow, no network-of-nodes cliche.

**Motion (and what it means).** GSAP DrawSVG: each connection draws once, then its number appears. Meaning carried: information moves from one part of the school to another.

**Say.** Show each of the three connections with its screen. Say plainly what each one does and what it needs.

**Ask.** Which missing connection would matter most to your school?

**Transition.** Let us put it in a day.

## Slide 14: principals-day

**Takeaway.** A principal's five questions already have answers in different places; one morning view is the next step.

**On the slide**

- A principal's morning
- Which students may need attention?
- Which learning areas need support?
- Where do teachers need development?
- Which operational issues need action?
- What comes first today?
- Scholar Insight  _[C-INS-CASE: verified]_
- Scholar Learn  _[C-LRN-DIAG: verified]_
- Scholar CCB  _[C-CCB-GAP: verified]_
- Scholar Core  _[C-CORE-FEE: verified]_
- Scholar Insight  _[C-INS-EXEC: verified]_
- Scholar Insight's leadership overview brings health, what changed, what is at risk and priority actions onto one page.  _[C-INS-EXEC: verified]_
- Illustrative scenario, not a customer case

**Visual.** A real photograph of schoolgirls walking to school in the morning; five questions that each name the product holding the answer (Insight, Learn, CCB, Core, Insight).

**Motion (and what it means).** Motion: each question expands to name the product that holds its answer. GSAP only runs the opening camera drift. Meaning carried: where each answer lives today.

**Say.** Let the principal choose one question and follow it to its product. Finish on the leadership overview.

**Ask.** Which of these five do you answer first on a normal morning?

**Transition.** If this feels worth testing, here is how we would start together.

**Image slots.** img-arrival (photo): Principal arriving at an Indian school in the morning, licensed photo.

## Slide 15: invitation

**Takeaway.** The next step is a conversation about one useful first use case.

**On the slide**

- Let's discover what your school could see differently.
- We would like to talk with you about the Founding 25 Pilot Programme.  _[C-INV: owner-confirmed]_
- 1. The challenge that matters most to your school  _[C-INV: owner-confirmed]_
- 2. The first capability to explore  _[C-INV: owner-confirmed]_
- 3. The people who should be involved  _[C-INV: owner-confirmed]_
- 4. The evidence or improvement your school wants to review  _[C-INV: owner-confirmed]_
- The next step is a conversation.  _[C-INV: owner-confirmed]_
- [Presenter name, phone and email to be added]

**Visual.** The opening classroom photograph returns, now in full focus with the points of light connected by a single line. The question from slide 1 is answered by the invitation, not by a claim.

**Motion (and what it means).** GSAP reverses slide 1: focus resolves and one line completes between the points. Meaning carried: connection is what the pilot is for.

**Say.** Do not sell. Ask which of the four items they can name today and offer to start there.

**Ask.** What is the one challenge you would want to look at first?

**Image slots.** img-hook (photo): Same photograph as slide 1, used again in focus.

## Five-slide version

1. Curiosity hook (uses slide 1)
2. The hidden school challenge (uses slide 2 + 4): Headline of slide 2 plus the six-step line of slide 4, trimmed
3. ScholarClone's approach (uses slide 5 + 6): Positioning, definition, and the six products with badges; no product detail
4. One customer scenario (uses slide 14): A principal's morning, labelled illustrative
5. Invitation (uses slide 15)

## Scenario library (all illustrative)

### 1. The principal's morning  _[Illustrative, slide 14]_

- **Situation:** It is a quarter to eight. The principal has a few minutes before assembly and wants to know where to look first.
- **Current challenge:** Fees, attendance, results and staff matters sit in different places, so deciding where to look takes time.
- **ScholarClone capability:** Scholar Insight: signals from several functions, the leadership overview and risk cases; Scholar Core: fees and attendance reports.
- **Possible next action:** Open the cases waiting for a decision; ask the accounts head about the fee follow-up list; speak to one class teacher.
- **Value:** The first hour can go to acting, not searching.

### 2. A student who is struggling  _[Illustrative, slide 8]_

- **Situation:** A Class 7 student has scored low in two tests in a row. The teacher has notes and a parent has called.
- **Current challenge:** The school has the marks and the concern but not a clear picture of which concepts need work.
- **ScholarClone capability:** Scholar Learn: a diagnostic by concept, a plan drawn from it, recommended content, adaptive practice and one next action.
- **Possible next action:** Start with the concepts marked weak; practise at the right level; use the next action after practice.
- **Value:** The conversation with the parent can name specific concepts and a plan.

### 3. A teacher who needs development  _[Illustrative, slide 10]_

- **Situation:** A teacher and the head of department both rate the teacher lower on assessment design.
- **Current challenge:** A training day may have been held, but nobody can say whether that competency has changed.
- **ScholarClone capability:** Scholar CCB: ratings, a gap, a development plan with actions, and progress tracking.
- **Possible next action:** Agree two actions in a development plan; re-rate after the review date.
- **Value:** Development is tied to a stated gap and followed up.

### 4. A school leader making a difficult decision  _[Illustrative, slide 11]_

- **Situation:** A director must decide whether to add remedial support for one grade next term.
- **Current challenge:** Opinions differ and the evidence is spread across attendance, results and teacher notes.
- **ScholarClone capability:** Scholar Insight: an attendance and results comparison across classes, and risk cases with a recommendation a person approves or rejects.
- **Possible next action:** Review the comparison and the cases; record the decision.
- **Value:** The decision is made with evidence on screen, and the decision is recorded. The comparison shows a link, not a cause.

### 5. A student exploring a future  _[Illustrative, slide 12]_

- **Situation:** A senior-class student says they want a particular career but has not looked at their own interests or strengths.
- **Current challenge:** A counselling conversation has little evidence to start from.
- **ScholarClone capability:** Scholar Compass: interest profile, aspirations, and an alignment result that says so when the evidence is thin.
- **Possible next action:** Use the result to open the conversation; add evidence where it is thin.
- **Value:** The conversation starts from evidence. Nothing is promised about the student's career.

## Alternative openers (comparison only; the approved headline does not change)

### The corridor

- **Visual:** A real photograph of a long school corridor in early morning with classroom doors open and one room lit.
- **Motion:** Slow forward drift past the doors; the lit room stays out of reach. Headline fades in last.
- **Why:** You can see one room. What about the rest.

### The principal's desk

- **Visual:** A real close photograph of a principal's desk with a register, a report card, a fee receipt, a notebook and a phone.
- **Motion:** A thin line connects two of the objects and stops; the others dim.
- **Why:** The pieces are all there. Almost nothing is connected.

### The campus at dusk

- **Visual:** A real photograph of a school campus at dusk with some windows lit.
- **Motion:** Points of light appear in some windows; lines begin and fade before completing.
- **Why:** Part of the picture is lit. Part is not.
