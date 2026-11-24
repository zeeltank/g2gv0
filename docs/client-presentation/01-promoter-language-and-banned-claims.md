# 01 Promoter language and claims we must NOT reuse

Slice 0 evidence for the ScholarClone client presentation. Date 2026-11-23. Tags: **verified** (I ran or read it myself), **read** (read in source, not re-run), **scout** (a read-only sub-agent reported it, not independently re-checked).

## A. Is there real promoter / principal language to build the story from? No.

| Source | What it holds | Tag |
|---|---|---|
| db3 (128.199.17.97/hp_erp) tenant 6 `crm_leads` | 92 live rows. 79 are one conference import with a template sentence ("Premier K-12 educational institution in [city], Gujarat evaluating ScholarClone ERP suite"); 3 are non-school HR/payroll inquiries; 3 are signal items | verified count (92); split scout |
| db3 tenant 6 `crm_opportunities` | 19 rows, all seeded demo text (same strings as `database/seeders/Tenant6CrmLifecycleSeeder.php`, e.g. "45% administrative hours saved"). One row re-checked. **Never use as proof.** | verified (1 row), scout (rest) |
| db3 tables for objections, transcripts, meetings, surveys | none exist (`SHOW TABLES LIKE` returned nothing for objection, transcript, meeting) | verified |
| db3 `crm_lead_comments`, `gtm_activities` | 4 and 14 rows; all system or signal summaries, one call with no body | scout |
| db3 `g2g_company_opportunities` | 129 rows of model-written summaries of public web pages, not buyer quotes. One public promoter posting ("first proposed K12 Global School ... onboard an Investor Partner who aspires to become an Edupreneur") is the only phrase in a promoter's own words | scout |
| `hp_erp/config/signals_icp.php` | our own assumption of buyer pain ("a new campus needs systems from day one", Trustee "cares about control, fee collection and reputation", Principal "wants less admin and calmer parents") | read (scout quoted) |

**Consequence.** The story's "recognition" scenes (master prompt Stage 3) rest on our assumptions, not on recorded buyers. The deck must label them "illustrative situations to validate with you", as the master prompt already says, and Slice 1 should add a **discovery-call capture sheet** so the first 5 to 10 real principal/trustee conversations replace these assumptions. This is the single biggest gap versus how a top professional would work.

## B. Claims in our own marketing calendars: UNVERIFIED, banned from the deck until sourced
Source files: `Downloads/ScholarClone_NextWeek_ContentCalendar.xlsx` (sheet "ScholarClone PAL - Next Week") and `Downloads/ScholarClone_PAL_Week4_ContentCalendar_Apr21-26_2026.xlsx`. (scout; cells C16 and C22 re-checked: verified)

- School-in-Madhya-Pradesh story "28% to 61% numeracy in 6 months" ("118% improvement"), "40% reduction in teacher admin workload", "89% student mastery rate", "54% achievement gap reduced", "27% faster time-to-mastery", "40-50% reduction in teacher administrative time". No customer or data behind them.
- "Give teachers back 10 hours a week", "I asked teachers across India" (no documented survey), "47 data points per student", "Rs 3 lakh for software nobody opens".
- Forgetting-curve numbers that contradict each other (30% vs 70% vs 90% forgotten at day 7), "retention improves 200-400%", "90%+ retention after 30 days", "30-50% less study time".
- "NEP 2020 mandates ... / Aligned with NEP 2020" (NEP is a policy, not a certification; the calendar itself retired the "NEP mandate boilerplate" in weeks 1 to 2).
- "India AI Edge 2026" statistics (100M+ AI users, 80% of students use AI, 6% of teachers have AI policies, $1T GDP) with inconsistent variants across cells.
- "Identify at-risk students 6 weeks early", "predicts student failure 6 weeks out", "adapts to all 5 learning types" (learning-styles basis is contested), "built specifically for CBSE and ICSE schools".
- "Free 30-minute consultations", "4 / 10 slots open", "20+ years in education", "I lead implementation of PAL systems in K-12 schools" (offers and personal claims, not product facts).

**Rule for the deck:** none of these may appear unless a ledger entry gives a source the owner accepts. The master prompt already forbids success percentages, AI accuracy statistics, ROI, free trials and invented customer stories; this list is the concrete "do not copy from our own posts" list.

## C. Naming and proof conflicts found so far (owner to resolve at the checkpoint)
1. Portfolio file `hp_erp/config/portfolio_seed_data.json` (read): only SCH-01 School ERP is "Live – with client"; Fees Intelligence "Prototype"; LMS-PAL and Career Intelligence "In development"; Learning ESO "Pilot planned"; Prompt-to-Video, FTS, Bundle "Proposal / concept"; **`readiness_confirmed` is False on all eight**; the bundle note says "Only the live components should be sold today". Owner said all six products are built, so the deck follows the owner, and each capability keeps a status field plus the portfolio value for comparison.
2. Anand Niketan is named as "first live Scholar implementation" in the portfolio file and the product page, and the same file says "Settle one consistent traction figure before partners use it". **Naming a customer on a client slide needs the owner's yes.** Default: not named.
3. "CCB" = teacher capability on the product page, "fee collection system" in the CRM seeder, and "G2G HRIT module" in the sales generator. Default: the product page meaning, per the master prompt.
4. The product page FAQ says pricing is shared "in a personal conversation after a short fit review". The deck carries no price, trial or discount.
