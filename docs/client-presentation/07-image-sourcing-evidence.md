# 07 Image sourcing evidence (Slice 2a; metadata only, nothing downloaded for use)

Date 2026-11-23. Script: `scripts/client-presentation/find-image-candidates.py` (read-only Wikimedia Commons API; output `assets/candidates.json`). Register skeleton: `assets/assets.json` (every slot `awaiting-authorisation` or `placeholder-until-supplied`).

## What the search found (verified: I ran it)
Licence policy applied: accept CC0, public domain, CC BY; set aside CC BY-SA; refuse NC, ND, unknown. Minimum 2400 px wide.

| Slot | Acceptable-licence hits | CC BY-SA hits | Fit |
|---|---|---|---|
| img-hook | 24 | 12 | Poor: documentary photos (a 2008 street-school scene, a ministerial visit, a government event). None is a modern, premium classroom |
| img-principal | 5 | 1 | None usable: historic prints, a map chart, a Dalai Lama visit, an alumni gathering |
| img-teacher | 2 | 13 | One is a 2016 "free education for underprivileged children" scene; not our message |
| open-A-corridor | 5 | 15 | **Usable**: Biswarup Ganguly's West Bengal school corridors, CC BY 3.0 (credit required), heritage buildings |
| img-student, img-staffroom, img-counsel, img-arrival, open-C-campus | 0 | 0 | Nothing |

**Conclusion.** Wikimedia Commons cannot supply the "modern Indian school, realistic educators and students, premium" look the brief needs. It can supply the corridor opener only. Several results show identifiable children in documentary settings; they also fail the "no implied customer" rule.

## Options (owner decides; none is started)
1. **Stock photography with a free API key (Pexels or Unsplash).** Best coverage for the premium look. Needs a free key in an environment variable (none is set). I query it, record each photo's licence page, author and date in the register. Their licences allow commercial use but do not give model releases; photos with identifiable people stay labelled "illustrative stock imagery".
2. **A commissioned photo shoot at an authorised partner school.** What a top professional would do: real teachers, real classrooms, signed releases, and genuine in-use shots. Slower and needs the partner's written permission; the register already has the fields for it.
3. **AI-generated photoreal images.** Not authorised. Only if you say yes in writing, and then labelled `generated_by_ai` with a credit line saying so. Risk: people who do not exist presented to a school promoter.
4. **Commons for the corridor opener only** (CC BY 3.0, credit shown).

## Needed from the owner before Slice 2b (download, WebP, register)
- Which option (1, 2, 3, 4, or a mix) is authorised.
- Whether CC BY-SA is acceptable (share-alike can attach to cropped or toned versions of an image; this is a legal question for you or your adviser, I have not given a view).
- The authorised staging or demo environment for screenshots (Sales/Management is arranging; I will not capture anything until it is named in writing, and every screenshot is masked and logged).
