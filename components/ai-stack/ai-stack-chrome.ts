'use client';

/**
 * The chrome every AI Stack screen shares.
 *
 * WHY THIS IS A RE-EXPORT AND NOT A SECOND COPY
 *
 * `app/fees/ai-stack/_screens/fees-ai-chrome.tsx` is pure presentation — a header strip,
 * a card, a pill, a table head, an `en-IN` date. It contains no fee logic, fetches
 * nothing, and knows about no tab. Copying two hundred lines of Tailwind so the shared
 * screens could have their own identical header is how modules end up looking subtly
 * different after a design tweak lands in one of them.
 *
 * So the shared screens import it, and this file is the seam that lets them do so under
 * names that read correctly anywhere. Nothing in the Fees folder is modified, nothing
 * there imports from here, and a change to the shared chrome reaches every module at once
 * — which is the point. `app/attendance/ai-stack/_screens/attendance-ai-chrome.ts`,
 * `.../admissions-ai-chrome.ts` and `.../students-ai-chrome.ts` are the same seam for
 * those three modules and made the same choice.
 *
 * The component is still in the Fees folder. When it moves out to a shared home, the five
 * seams like this one are what have to be repointed, and each is a one-line change.
 */

export {
  FeesAiCard as AiStackCard,
  FeesAiCardHeading as AiStackCardHeading,
  FeesAiEmpty as AiStackEmpty,
  FeesAiError as AiStackError,
  FeesAiHeader as AiStackHeader,
  FeesAiHint as AiStackHint,
  FeesAiLoading as AiStackLoading,
  FeesAiMetrics as AiStackMetrics,
  FeesAiNotice as AiStackNotice,
  FeesAiPill as AiStackPill,
  FeesAiTableHead as AiStackTableHead,
  formatWhen,
} from './ai-stack-chrome-impl';
