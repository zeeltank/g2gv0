# 06 Screenshot and image requests

## A. Real product screenshots (needed from you; I cannot capture them)
Each slot stays a clearly labelled **"Screenshot to be supplied"** placeholder until a genuine file arrives. I will not draw, mock up or generate any interface.

**Authorised environment.** A demo or training tenant with **fictional data only**; never production student, parent or staff data. You tell me in writing which environment is authorised. Until then I will not log into anything to capture.

**Capture standard.** 1920×1080 PNG, browser at 100% zoom, light theme, no browser bars, no personal data, English interface, named `shot-<slot>.png`, placed in `D:\client-presentation-incoming\` (outside the repo). I record who supplied each and when.

| Slot | Slide | Screen to show | Where it is in the code (read) |
|---|---|---|---|
| shot-fees | 7 | Fee collection with a demo student | next_lms_erp `fees_collect` (routes/fees.php) |
| shot-attendance | 7 | Daily student attendance marking | `student_attendance` (routes/student.php:88) |
| shot-marks | 7 | Marks entry or a result report | `marks_entry` / `overall_mark_report` (routes/result.php:80,84) |
| shot-diagnostic | 8 | A diagnostic result with the weak / moderate / strong concept breakdown, demo student | `pal/diagnostic` routes (routes/lms.php:186-190, scout) |
| shot-generate | 9 | Question or content generation for staff, with a draft shown | `intelligence/questions/generate` (routes/api.php:724); owner to point to the front-end screen |
| shot-gap | 10 | A competency gap view or a development plan with actions | `competency/gap`, `competency/development-plans` (routes/competency_management.php:157,122) |
| shot-case | 11 | An academic-risk case with its recommendation and the approve / reject / defer choice | `ai` cases and recommendations (routes/ai.php:285-298); K-12 front end `enterprise-brain` (scout) |
| shot-alignment | 12 | A career alignment result, ideally one that says "not enough evidence" | `careerRecommendation` (routes/lms.php:435) |

Open questions: which environment and who authorises it; whether the career alignment screen currently works there (it needs a graph service; not verified).

## B. Photographs and other images (plan; nothing downloaded yet)
| Slot | Slide | Subject | Source tier |
|---|---|---|---|
| img-hook | 1, 15 | Modern Indian classroom, soft morning light, shallow depth of field | Licensed photo; AI image only if you say yes at that point |
| img-principal | 2 | Principal at a desk, face not the focus | Licensed photo |
| img-student | 3 | Student writing, face turned or hands only | Licensed photo |
| img-teacher | 9 | Teacher with a small group of students | Licensed photo |
| img-staffroom | 10 | Teacher in a corridor or staff room | Licensed photo |
| img-counsel | 12 | Senior student with a counsellor | Licensed photo |
| img-arrival | 14 | Principal arriving at school in the morning | Licensed photo |
| img-logo | 5 | ScholarClone logo ring | Brand file from the product page; you confirm which file |

Sourcing: Wikimedia Commons / Openverse need no key. Pexels needs a free API key in an environment variable (none is set today). Every image gets a row in `assets.json`: slot id, file, alt text, source URL, licence, credit, kind (photo / ai / shape / frame / placeholder). Any image you dislike is replaced by editing that one row. Frames, shapes and components are drawn by us; no picture is drawn in code. Raw originals stay on D: (C: has 7.9 GB free); only optimised WebP goes into the repo.
