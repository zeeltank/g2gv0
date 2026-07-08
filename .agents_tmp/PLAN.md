# shadcn/ui Remediation Action Plan

## 1. OBJECTIVE

Fix all identified issues in the shadcn/ui implementation to achieve:
- Full WCAG 2.1 AA accessibility compliance
- Consistent component APIs
- Standard shadcn/ui patterns (Radix-based primitives)
- Clear import conventions with no duplication

---

## 2. CONTEXT SUMMARY

The GapstoGrowth application has 38 shadcn/ui components in `components/ui/`. Multiple components deviate from shadcn/ui conventions by using custom implementations instead of Radix UI primitives, creating accessibility gaps. Additionally, duplicate components and legacy re-exports create confusion about the source of truth.

---

## 3. APPROACH OVERVIEW

**Phase 1: Critical Accessibility Fixes**
- Migrate Dialog, AlertDialog, Sheet to Radix UI
- Migrate DropdownMenu to Radix UI
- Fix Select keyboard accessibility

**Phase 2: Button Standardization**
- Migrate Button from @base-ui/react to @radix-ui/react-slot (standard shadcn pattern)

**Phase 3: Duplication Cleanup**
- Delete duplicate DataList in `components/data/`
- Delete or consolidate `components/org/gtg-ui.tsx`

**Phase 4: Import Convention Enforcement**
- Replace all legacy imports with `@/components/ui` barrel exports
- Add ESLint rules to enforce conventions

---

## 4. IMPLEMENTATION STEPS

### STEP 1: Migrate Dialog to Radix UI

**Goal:** Replace custom Dialog with Radix UI-based implementation for proper accessibility.

**Files to modify:**
- `components/ui/dialog.tsx` — Rewrite using `@radix-ui/react-dialog`
- `components/ui/alert-dialog.tsx` — Rewrite using `@radix-ui/react-alert-dialog` or extend Dialog

**Dependencies to add:**
```bash
npm install @radix-ui/react-dialog @radix-ui/react-alert-dialog
```

**Reference implementation:**
```typescript
// components/ui/dialog.tsx
import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// ... continue with DialogContent, DialogHeader, etc.
```

---

### STEP 2: Migrate Sheet to Radix UI

**Goal:** Replace custom Sheet with Radix UI-based implementation.

**Files to modify:**
- `components/ui/sheet.tsx` — Rewrite using `@radix-ui/react-dialog` (Sheet uses same primitive as Dialog)

**Dependencies to add:**
```bash
npm install @radix-ui/react-dialog  # Already added in Step 1
```

---

### STEP 3: Migrate DropdownMenu to Radix UI

**Goal:** Replace custom DropdownMenu with Radix UI for proper keyboard navigation and accessibility.

**Files to modify:**
- `components/ui/dropdown-menu.tsx` — Rewrite using `@radix-ui/react-dropdown-menu`

**Dependencies to add:**
```bash
npm install @radix-ui/react-dropdown-menu
```

---

### STEP 4: Migrate Button to Radix UI

**Goal:** Standardize Button to use `@radix-ui/react-slot` instead of `@base-ui/react`.

**Files to modify:**
- `components/ui/button.tsx` — Replace `@base-ui/react` import with `@radix-ui/react-slot`

**Changes:**
```typescript
// Before
import { Button as ButtonPrimitive } from '@base-ui/react/button'

// After
import { Slot } from '@radix-ui/react-slot'
import { buttonVariants } from './button.tailwind'  // or inline styles

// Button component becomes a wrapper around <button> with cn() applied
```

---

### STEP 5: Fix Select Keyboard Accessibility

**Goal:** Add proper keyboard navigation to Select component.

**Files to modify:**
- `components/ui/select.tsx` — Add arrow key navigation, typeahead search

**Required keyboard behaviors:**
- `ArrowDown` / `ArrowUp`: Navigate options
- `Enter` / `Space`: Select current option
- `Escape`: Close dropdown
- `Home` / `End`: Jump to first/last option
- Typeahead: Jump to matching option on character input

---

### STEP 6: Delete Duplicate DataList

**Goal:** Eliminate confusion about which DataList to use.

**Action:** Delete `components/data/data-list.tsx` and update `components/data/index.ts` to re-export from `components/ui/data-list.tsx`.

**Files to delete:**
- `components/data/data-list.tsx`

**Files to modify:**
- `components/data/index.ts` — Add re-export:
```typescript
export { DataList } from '@/components/ui/data-list'
```

---

### STEP 7: Delete Legacy gtg-ui.tsx

**Goal:** Remove the confusing re-export layer that duplicates `@/components/ui`.

**Files to delete:**
- `components/org/gtg-ui.tsx`

**Files to modify:**
- Find all files importing from `@/components/org/gtg-ui` and update to `@/components/ui`
- Expected files: `organization-profile-step.tsx`, `LeaveConfigurationPage.tsx`, `screens-showcase/page.tsx`

---

### STEP 8: Audit and Fix 34 Raw Button Usages

**Goal:** Replace inline `<button>` elements that should use the Button component.

**Files to scan:**
```bash
grep -rn "<button.*className.*rounded" components/
```

**Expected results:** 34 files contain raw `<button>` elements with rounded styling.

**Action:** Replace with `<Button>` component where appropriate, or add proper styling class utilities.

---

### STEP 9: Add ESLint Rules

**Goal:** Prevent regression to non-standard patterns.

**File to create/modify:** `.eslintrc.js` or `eslint.config.js`

```javascript
// Recommended rules
{
  "rules": {
    // Prevent raw button elements with shadcn styling patterns
    "no-restricted-patterns": [
      "error",
      {
        "pattern": "<button[^>]*className={.*rounded.*}>",
        "message": "Use <Button> component instead of raw <button> with rounded styling"
      }
    ]
  }
}
```

---

### STEP 10: Update Documentation

**Goal:** Document the correct patterns for future development.

**Files to create/update:**
- `COMPONENT_LIBRARY.md` — Update to reflect actual implementations
- Add inline JSDoc to all exported components
- Add `STYLING_GUIDE.md` documenting:
  - Always use `cn()` utility for class merging
  - Never hardcode colors — use design tokens
  - Prefer `Button` component over raw `<button>`
  - Modal components must use Dialog/Sheet from `@/components/ui`

---

## 5. TESTING AND VALIDATION

### Accessibility Testing (per component)

| Component | Test | Expected Result |
|-----------|------|-----------------|
| Dialog | Tab through elements | Focus stays within dialog |
| Dialog | Press Escape | Dialog closes |
| Dialog | Click outside | Dialog closes |
| DropdownMenu | Tab to trigger | Trigger receives focus |
| DropdownMenu | Press Enter/Space | Menu opens |
| DropdownMenu | Arrow keys | Navigate options |
| DropdownMenu | Escape | Menu closes |
| Select | Tab to select | Focus on trigger |
| Select | Press Enter | Dropdown opens |
| Select | Arrow keys | Navigate options |
| Button | All interactive states | Visible focus, hover, active |

### Regression Testing

1. **Import audit:** Run `grep -r "from '@/components/org/gtg-ui'" components/` — expect 0 results
2. **DataList audit:** Run `ls components/data/data-list.tsx` — expect "No such file"
3. **Raw button audit:** Run `grep -rn "<button.*rounded" components/` — expect minimal results (justified usages only)
4. **Build verification:** Run `npm run build` — expect zero TypeScript errors
5. **Lint verification:** Run `npm run lint` — expect zero errors

### Manual Testing Checklist

- [ ] Dialog opens and closes with keyboard
- [ ] Focus trap works in Dialog
- [ ] DropdownMenu navigation works with keyboard
- [ ] Select responds to arrow keys
- [ ] All Button variants render correctly
- [ ] Dark mode works for all migrated components
- [ ] No console errors in browser

---

## Summary of Actions

| Step | Action | Risk | Effort |
|------|--------|------|--------|
| 1 | Migrate Dialog to Radix | Medium | High |
| 2 | Migrate Sheet to Radix | Medium | Medium |
| 3 | Migrate DropdownMenu to Radix | Medium | Medium |
| 4 | Migrate Button to Radix | Low | Low |
| 5 | Fix Select keyboard nav | Low | Medium |
| 6 | Delete duplicate DataList | Low | Low |
| 7 | Delete gtg-ui.tsx | Medium | Medium |
| 8 | Fix raw button usages | Low | High |
| 9 | Add ESLint rules | Low | Low |
| 10 | Update documentation | Low | Medium |

---

*Plan completed: 2026-07-08*
