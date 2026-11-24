# 10 My Learning wiring (EXECUTED on db3 on 2026-11-23 after the owner's explicit go)

Date 2026-11-23. This file began as the plan; the steps below were executed the same evening after the owner's explicit go (see "What was done" at the end). The plan text is kept as written.

## What the code already allows (read, no change needed)
`components/domain/lms/delivery/learning-delivery-workspace.tsx` (`lessonKind`, lines 83-100) treats a lesson whose type is `link` or `url` as a link lesson that opens its address; only links to `/sales-training/<product>` and the interactive-course origin get their own player. So a plain **link lesson that points at the new route** needs **no edit to any existing file** and leaves the old Sales Training untouched:

`<front-end origin>/module/lms/learning/client-presentation/scholarclone` (full deck), `...?mode=short` (five-slide version), `...?slide=14` (one slide).

The route sits behind the same sign-in gate as every My Learning page and holds no tenant data. It opens in its own tab, which is what a meeting needs (full screen with F).

## Course 207 (db3, tenant 6): read-only facts
`sub_std_map` id 207 "ScholarClone: What is your school not seeing?", subject_type "Self-paced course", status 0, created 2026-11-23 11:30 by user id 28, one empty chapter 237 "Customer presentation (interactive)", no lessons, no enrolments. **The owner must confirm it is theirs before I use it.** Old cards 205 "G2G Sales" and 206 "ScholarClone Sales" are untouched by this plan.

## Proposed steps, each needing the owner's go (per `DB-RULES.md`)
1. Deploy the g2gv0 front end containing the new route (a push to the owner's branch and the usual Vercel deploy; owner merges). Until then the link would 404.
2. Read-only re-check of course 207 and chapter 237 (SELECT only) on the host the deployed site uses (128.199.17.97, the `live` connection), and SHOW COLUMNS for `content_master` on that host (enums diverge from migrations).
3. With a backup of the two rows first: create two lessons in chapter 237 through the course builder, not raw SQL: "Full presentation" (link) and "Five-slide version" (link, `?mode=short`); set course 207 status to 1; enrol the intended learners with `EnrolmentWriter`.
4. Verify as a real signed-in user on the deployed site (the old Sales row still works; the new course opens the deck).
5. Rollback: set status back to 0 and soft-delete the two lessons; the backup rows restore the original state.

## Titles
Course title stays "ScholarClone: What is your school not seeing?" (already on the draft). Lesson titles say "presentation", never "training".


## What was done (2026-11-23, evening)
Owner confirmed course 207 is theirs and chose to enrol the 11 active tenant-6 users (the same people who hold the two old Sales cards). `scripts/client-presentation/wire-course-207.py --execute` ran against db3 (128.199.17.97/hp_erp), tenant 6 only:
- backup of the 207 and 237 rows: `D:\client-presentation-assets\backup\db3-course207-20261123_204252.json`
- 2 link lessons added to chapter 237: id 275 "Full presentation" and id 276 "Five-slide version" (category "Interactive deck")
- course 207 set from status 0 to 1
- 11 `lms_course_enroll` rows (status `enrolled`) for course 207
- verified inside the transaction before COMMIT, then read back on a fresh connection: status 1, 2 lessons, 11 enrolments
- the script refuses to run if the course is not the hidden empty draft, or if the active users are not the old cards' learners
Not touched: courses 205 and 206 (the old cards), any other tenant, any other table.
Undo: `python -I scripts/client-presentation/wire-course-207.py --rollback <backup.json>` (soft-deletes the 2 lessons and 11 enrolments, restores status 0).
Read in source: `LmsLearningController::courses` lists every course the user is enrolled in for their tenant, with no category filter, so 207 appears in My Learning for those users.
Verified on the live domain: the deck renders (logo, fonts, badges) at `https://g2gv0.vercel.app/module/lms/learning/client-presentation/scholarclone`. Not verified: a real learner's My Learning page showing the card (no learner login available to me).
