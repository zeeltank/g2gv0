# GapstoGrowth (GTG) — UX/UI Specification & Functional Requirements
## Module: Organization Management | Menu: Organization Setup | Submenu: Organization Profile

**Version:** 1.0  
**Status:** Production Ready  
**Last Updated:** 2026-01-12  
**Scope:** Organization Information page and Add Organization Detail page — comprehensive UX/UI specifications, responsive design, accessibility, and functional requirements for enterprise SaaS deployment.

---

## Executive Summary

The Organization Profile submenu provides enterprise administrators with centralized management of organizational structure, branding, and operational metadata. Two integrated pages deliver complementary workflows:

1. **Organization Information** — View/edit core organizational data, logos, and key facts (Admin: full edit, HR: view-only)
2. **Add Organization Detail** — Multi-step form for enriching organizational metadata (Admin only)

Both pages enforce strict role-based access control, responsive mobile-first design, WCAG compliance, and GTG design system tokens.

---

## 1. Design System Compliance

### 1.1 Color Palette

| Usage | Token | Value | Role |
|---|---|---|---|
| Primary Brand | `--brand` | `hsl(232 56% 34%)` (Navy) | Active states, accents |
| Brand Action | `--primary` / `--brand-accent` | `hsl(23 100% 50%)` (Orange) | Primary buttons, focus rings |
| Surface | `--card` | `hsl(0 0% 100%)` light / `hsl(224 32% 14%)` dark | Section cards, containers |
| Text Primary | `--foreground` | `hsl(221 39% 11%)` light / `hsl(210 40% 98%)` dark | Page titles, body text |
| Text Secondary | `--muted-foreground` | `hsl(215 16% 47%)` light / `hsl(215 20% 70%)` dark | Labels, hints, descriptions |
| Status: Success | `--success` | `hsl(143 65% 30%)` / `hsl(143 55% 42%)` | Approval badges |
| Status: Warning | `--warning` | `hsl(28 100% 38%)` / `hsl(28 100% 58%)` | Caution states |
| Status: Danger | `--destructive` | `hsl(0 72% 42%)` / `hsl(0 72% 55%)` | Errors, delete actions |
| Border | `--border` | `hsl(219 39% 91%)` light / `hsl(225 22% 25%)` dark | Dividers, input borders |

**Rule:** Never use raw `text-white`, `bg-black`, or non-GTG colors. All colors consumed via design tokens.

### 1.2 Typography

| Usage | Font | Size | Weight | Line Height |
|---|---|---|---|---|
| Page Title | Inter | 36px | 700 (bold) | 1.2 |
| Section Title | Inter | 24px | 600 (semibold) | 1.3 |
| Card Title | Inter | 20px | 600 (semibold) | 1.3 |
| Body Text | Inter | 16px | 400 (regular) | 1.5–1.6 |
| Form Label | Inter | 14px | 500 (medium) | 1.4 |
| Helper Text | Inter | 12px | 400 (regular) | 1.4 |
| Input Text | Inter | 15px | 400 (regular) | 1.4 |

**Rule:** Single font family only (Inter). No serif or display faces. Minimum 14px for body content; 12px reserved for helper text only.

### 1.3 Spacing Scale

| Token | rem | px | Usage |
|---|---|---|---|
| `--space-1` | 0.25 | 4px | Inline gaps, tight spacing |
| `--space-2` | 0.5 | 8px | Component gaps, small margins |
| `--space-3` | 0.75 | 12px | Form field spacing |
| `--space-4` | 1 | 16px | Standard padding, item spacing |
| `--space-5` | 1.25 | 20px | Medium spacing |
| `--space-6` | 1.5 | 24px | Section margins, card padding |
| `--space-8` | 2 | 32px | Large section gaps, page margins |
| `--space-10` | 2.5 | 40px | Extra large spacing |

### 1.4 Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 4px | Input fields, small components |
| `--radius-md` | 8px | Default for cards, buttons |
| `--radius-lg` | 12px | Large containers, modals |
| `--radius-xl` | 14px | Extra large surfaces |
| `--radius-2xl` | 16px | Premium cards, glass effects |

### 1.5 Shadows

| Token | Value | Usage |
|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(31, 42, 109, 0.05)` | Subtle depth |
| `--shadow-sm` | `0 4px 12px rgba(31, 42, 109, 0.06)` | Card hover, header |
| `--shadow-md` | `0 10px 28px rgba(31, 42, 109, 0.1)` | Elevated state |
| `--shadow-lg` | `0 18px 48px rgba(31, 42, 109, 0.14)` | Modal, drawer |

---

## 2. Role-Based Access Control

### 2.1 Organization Information Page

| Role | Access | Actions | Notes |
|---|---|---|---|
| Admin | **Full** | View, edit all fields, save changes, upload logo | Complete control; all UI elements visible |
| HR Manager | **View** | View all fields (read-only); no edit capability | "View Only" badge displayed; edit button hidden |
| Department Head | **None** | Access denied; redirect to dashboard | AccessDenied component; no partial visibility |
| Employee | **None** | Access denied; redirect to dashboard | AccessDenied component; no partial visibility |

**Enforcement:** `getAccess('organization-information', role)` returns `'full'` / `'view'` / `'none'` per permission matrix.

### 2.2 Add Organization Detail Page

| Role | Access | Actions |
|---|---|---|
| Admin | **Full** | All form sections, multi-step wizard, save/publish actions |
| HR Manager | **None** | Access denied |
| Department Head | **None** | Access denied |
| Employee | **None** | Access denied |

**Enforcement:** Page renders `<AccessDenied>` for non-Admin roles; no form fields exposed.

### 2.3 AccessDenied Component

Displays when a user lacks permission:
- Icon: Lock (16px, `--muted-foreground`)
- Title: "Access Restricted"
- Message: "Your role as [Role] does not have permission to view this page. Contact your administrator if you believe this is an error."
- Action Button: Link to dashboard or back

---

## 3. Page Specifications

### 3.1 Organization Information Page

#### 3.1.1 Layout Structure

```
┌─────────────────────────────────────────┐
│ Page Header                             │
│  Title: "Organization Information"      │
│  Subtitle: "Manage company details..."  │
│  Action: [Edit / Cancel & Save]         │
└─────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Action Bar                                                   │
│  [Badge: "Organization Type"] [Badge: "View Only" if HR]    │
│                            [Edit / Save Changes Buttons]     │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ Main Content Grid (3 columns on desktop, 1 on mobile)               │
├──────────────────────┬───────────────────────┬────────────────────┤
│ Company Logo         │ Quick Facts           │ (empty on lg)      │
│ (Logo upload, 200px) │ - Employees: 500     │                    │
│                      │ - Founded: 2020       │                    │
│                      │ - Industry: Tech      │                    │
├──────────────────────┴───────────────────────┴────────────────────┤
│ Company Information (full width)                                  │
│ - Name, Legal Entity, Tax ID, Organization Type, Status          │
├─────────────────────────────────────────────────────────────────┤
│ Contact Details (full width)                                    │
│ - Primary Contact, Email, Phone, Website                         │
├─────────────────────────────────────────────────────────────────┤
│ Address & Regional Info (full width)                            │
│ - Full Address, Regional Office, HQ Status                       │
├─────────────────────────────────────────────────────────────────┤
│ Sister Companies (full width)                                   │
│ - Related organizations, links                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.1.2 View Mode (Read-Only / HR)

All fields displayed as read-only:
- SectionCard container
- ReadField component for each field (label + value)
- No edit button (if HR)
- "View Only" badge in action bar

```
┌─────────────────────────────────────────────┐
│ Company Information                         │
├─────────────────────────────────────────────┤
│ Organization Name: [Value]                  │
│ Legal Entity Name: [Value]                  │
│ Tax ID: [Value]                             │
│ Organization Type: [Value]                  │
│ Status: [Badge: Active/Inactive/Draft]      │
└─────────────────────────────────────────────┘
```

#### 3.1.3 Edit Mode (Admin)

Form fields activate for editing:
- FormField wrapper (label + hint + input)
- TextInput for text fields
- SelectInput for dropdowns
- TextArea for long text
- Save & Cancel buttons replace Edit button

```
┌─────────────────────────────────────────────┐
│ Company Information                         │
├─────────────────────────────────────────────┤
│ ⬜ Organization Name *                      │ 
│   [Input: Gaps to Growth International]    │
│   Hint: Legal company name                 │
│                                             │
│ ⬜ Status *                                 │
│   [Dropdown: Active / Inactive / Draft]    │
└─────────────────────────────────────────────┘
```

#### 3.1.4 Component Breakdown

**Section Cards (4):**
1. **Company Logo** (Logo upload, 200×200px preview, upload button, delete option)
2. **Quick Facts** (3 read-only fields: employee count, founding year, industry)
3. **Company Information** (Organization name, legal entity, tax ID, org type, status)
4. **Contact Details** (Primary contact, email, phone, website)
5. **Address & Regional Info** (Full address breakdown, regional office, HQ indicator)
6. **Sister Companies** (List of related orgs, with links if applicable)

**Buttons:**
- **Edit Information** (Edit mode toggle, Admin only, Pencil icon, `--primary`)
- **Cancel** (Exit edit mode, Outline style, X icon)
- **Save Changes** (Persist edits, `--primary` gradient, Save icon)
- **Upload Logo** (Trigger file input, Plus icon, secondary style)
- **Delete Logo** (Remove logo, Destructive style, X icon)

**Badges:**
- Organization Type (Navy pill, Building icon)
- View Only (Outline, for HR role)
- Status (Active/Inactive/Draft, color-coded)

#### 3.1.5 Form Validations

| Field | Validation | Error Message |
|---|---|---|
| Organization Name | Required, max 255 chars | "Organization name is required and must be ≤255 characters" |
| Legal Entity | Optional, max 255 chars | "Must be ≤255 characters" |
| Tax ID | Optional, matches format | "Invalid tax ID format" |
| Organization Type | Required | "Please select an organization type" |
| Status | Required | "Please select a status" |
| Email | Valid email format | "Please enter a valid email address" |
| Phone | Valid phone format | "Please enter a valid phone number" |
| Website | Valid URL format | "Please enter a valid website URL" |

---

### 3.2 Add Organization Detail Page

#### 3.2.1 Layout Structure

Multi-step form with progress indicator:

```
┌─────────────────────────────────────────┐
│ Page Header                             │
│ Title: "Add Organization Detail"        │
│ Subtitle: "Enrich organizational data" │
│ Badge: "Admin Only"                     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Step Indicator (1/3)                    │
│ ◉ ─── ○ ─── ○                           │
│ Step 1: Operational Details             │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Step 1: Operational Details                            │
├─────────────────────────────────────────────────────────┤
│ [Section 1 Form Fields]                                 │
│ - Industry Classification                               │
│ - Company Size                                          │
│ - Annual Revenue                                        │
│ - Primary Business Unit                                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Action Bar                                              │
│ [Cancel] [Previous] [Next: Step 2 →]                   │
└─────────────────────────────────────────────────────────┘
```

#### 3.2.2 Steps

**Step 1: Operational Details**
- Industry Classification (Dropdown)
- Company Size (Radio group: 1-50, 51-500, 501-5000, 5000+)
- Annual Revenue (Dropdown with ranges)
- Primary Business Unit (TextInput)

**Step 2: Infrastructure & Governance**
- Reporting Structure (Dropdown)
- Quality Standards (Checkbox group: ISO 9001, ISO 27001, etc.)
- Compliance Framework (Multi-select: GDPR, HIPAA, SOC2, etc.)
- Audit Trail Required (Toggle)

**Step 3: Integration & Systems**
- ERP System (Dropdown)
- HRIS Connected (Toggle)
- Learning Platform (Dropdown)
- Data Sync Frequency (Dropdown: Real-time, Daily, Weekly, Monthly)

#### 3.2.3 Form Validations

| Field | Validation | Error |
|---|---|---|
| Industry Classification | Required | "Please select an industry" |
| Company Size | Required | "Please select company size" |
| Annual Revenue | Optional | — |
| Reporting Structure | Required | "Please select reporting structure" |
| ERP System | Optional | — |

#### 3.2.4 Action Buttons

- **Cancel** (Exit form, redirect to Organization Information)
- **Previous** (Go to prior step, hidden on Step 1)
- **Next** (Advance to next step, validate step form first)
- **Save Draft** (Save progress without publishing)
- **Save & Publish** (Final step only; save and activate organization detail)

---

## 4. Responsive Design Specifications

### 4.1 Breakpoints

| Device | Width | Media Query | Sidebar | Grid |
|---|---|---|---|---|
| Mobile | 320–767px | `<md` | Collapsed (72px) or off-canvas | 1 column |
| Tablet | 768–1023px | `md:` | Icon rail (72px) | 1–2 columns |
| Laptop | 1024–1439px | `lg:` | Expanded (260px) | 2–3 columns |
| Desktop | 1440px+ | `xl:` | Expanded (260px) | 3–4 columns |

### 4.2 Organization Information — Responsive Behavior

#### Desktop (1440px)

```
┌─ Sidebar ─┬──────────── Main Content ────────────────┐
│           │ Breadcrumb: Organization / Organization  │
│           │ Profile / Organization Information       │
│  [M1]     │                                           │
│  [M2]     │ Page Header & Action Bar (full width)    │
│  [M3]     │                                           │
│  [M4]     │ Grid: 3 columns                          │
│  [M5]     │ ┌─────┬─────┬──────┐                    │
│           │ │Logo │Facts│(Empty)│                   │
│           │ ├─────┴─────┴──────┤                    │
│           │ │ Company Info     │                    │
│           │ │ (spans 3 col)    │                    │
│           │ ├──────────────────┤                    │
│           │ │ Contact Details  │                    │
│           │ │ (spans 3 col)    │                    │
│           │ └──────────────────┘                    │
└───────────┴──────────────────────────────────────────┘
```

**Behavior:**
- Sidebar: Expanded (260px)
- Main content: 3-column grid
- Logo card: spans 1 column
- Quick facts: spans 1 column
- Other sections: span full width
- Scroll: vertical scroll for long content

#### Laptop (1024–1439px)

```
┌─ Sidebar ─┬──────────────── Main ─────────────┐
│  (expanded)│ Breadcrumb                        │
│           │ Page Header & Action Bar          │
│           │                                    │
│           │ Grid: 2 columns                   │
│           │ ┌───────────┬──────────┐         │
│           │ │Logo (1col)│Facts(1col)│        │
│           │ ├───────────┴──────────┤         │
│           │ │Company Info (2 col)  │         │
│           │ ├──────────────────────┤         │
│           │ │Contact Details (2 col)│        │
│           │ └──────────────────────┘         │
└───────────┴────────────────────────────────────┘
```

**Behavior:**
- Sidebar: Expanded (260px)
- Main content: 2-column grid
- Logo + Facts: each 1 column
- Other sections: full width

#### Tablet (768–1023px)

```
┌─ Icon ─┬──────────────── Main ──────────────────┐
│ Rail   │ Breadcrumb (wraps if needed)           │
│ (72px) │                                         │
│        │ Page Header (title, action stacks)     │
│        │                                         │
│        │ Single Column Layout                   │
│        │ ┌──────────────────────────────────┐  │
│        │ │Logo Card (full width)             │  │
│        │ ├──────────────────────────────────┤  │
│        │ │Quick Facts (full width)           │  │
│        │ ├──────────────────────────────────┤  │
│        │ │Company Info (full width)          │  │
│        │ ├──────────────────────────────────┤  │
│        │ │Contact Details (full width)       │  │
│        │ └──────────────────────────────────┘  │
└────────┴───────────────────────────────────────────┘
```

**Behavior:**
- Sidebar: Collapsed to icon rail (72px); labels appear on hover
- Main content: 1-column (full width)
- All cards: stack vertically
- Horizontal padding: `--space-4` (16px)

#### Mobile (320–767px)

```
┌─ (Off-Canvas Toggle) ──────────────────┐
│ Breadcrumb: "Organization ▾"           │
│ Page Title (smaller: 24px / 600 weight)│
│ Action Bar (vertical stack)            │
│ [Edit / Cancel | Save]                 │
└────────────────────────────────────────┘

┌──────────────────────────────────────┐
│ Logo Card (full width, centered)     │
├──────────────────────────────────────┤
│ Quick Facts (full width, vertical)   │
│ - Employees                          │
│ - Founded                            │
│ - Industry                           │
├──────────────────────────────────────┤
│ Company Information (full width)     │
│ - Fields stack vertically            │
│ - Labels above values                │
├──────────────────────────────────────┤
│ Contact Details (full width)         │
│ [Contact icons, links]               │
├──────────────────────────────────────┤
│ Address (full width, stacked)        │
└──────────────────────────────────────┘
```

**Behavior:**
- Sidebar: Off-canvas drawer (triggered by menu button)
- Breadcrumb: Collapsed to current page name + dropdown
- Page title: 24px / 600 weight (smaller than desktop)
- Action bar: Buttons stack vertically or wrap
- Cards: Full width, 1-column layout
- Horizontal padding: `--space-4` (16px)
- Bottom actions: Sticky footer if form has many fields

### 4.3 Add Organization Detail — Responsive Behavior

#### Desktop (1440px)

```
┌─────────┬──────────────────────────────────────┐
│Sidebar  │ Step Indicator: ◉─○─○ (Step 1/3)    │
│(expanded)│                                      │
│         │ Section Card: Operational Details    │
│         │ ┌────────────────────────────────┐  │
│         │ │Form Fields (2-column grid)     │  │
│         │ │ - Industry Classification      │  │
│         │ │ - Company Size                 │  │
│         │ │ - Annual Revenue               │  │
│         │ │ - Primary Business Unit        │  │
│         │ └────────────────────────────────┘  │
│         │                                      │
│         │ Actions: [Cancel][Previous][Next →] │
└─────────┴──────────────────────────────────────┘
```

**Behavior:**
- Form fields: 2-column grid on large screens
- Step indicator: Horizontal progress bar
- Action buttons: Inline, right-aligned

#### Tablet (768–1023px)

```
┌───┬───────────────────────────────────┐
│Icon│ Step Indicator: ◉─○─○            │
│Rail│                                   │
│    │ Section Card: Operational Details│
│    │ ┌──────────────────────────────┐│
│    │ │Form Fields (1-column)        ││
│    │ │ - Each field full width       ││
│    │ └──────────────────────────────┘│
│    │                                   │
│    │ Actions: [Cancel][Previous][Next]│
└────┴───────────────────────────────────┘
```

**Behavior:**
- Form fields: 1-column layout
- Action buttons: Inline, may wrap

#### Mobile (320–767px)

```
┌──────────────────────────────────┐
│ ☰ Step 1 of 3: Operational       │
│ Details                          │
│ (header collapse/expand)         │
├──────────────────────────────────┤
│ Form Fields (1-column, full-width)
│                                  │
│ [Label]                          │
│ [Input / Dropdown / Radio]       │
│ [Hint text if applicable]        │
│                                  │
│ [Label]                          │
│ [Input / Dropdown / Radio]       │
│                                  │
├──────────────────────────────────┤
│ Sticky Footer Actions            │
│ ┌──────────────────────────────┐ │
│ │ [Cancel][Previous][Next →]   │ │
│ │ (vertical stack on very small)│ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

**Behavior:**
- Form fields: Full width, 1-column, large touch targets (min 44px height)
- Action buttons: Sticky footer; stack vertically if space < 320px
- Padding: `--space-4` (16px) inline, `--space-6` (24px) vertical

---

## 5. Component Specifications

### 5.1 SectionCard

**Purpose:** Container for related form fields or read-only data.

**Props:**
- `title?: string` — Card heading (20px / 600 weight)
- `description?: string` — Subtitle (14px / 400 weight, `--muted-foreground`)
- `actions?: ReactNode` — Right-aligned action buttons
- `children: ReactNode` — Card content
- `className?: string` — Tailwind overrides

**Rendering:**
```
┌─ Card ─────────────────────────────────────┐
│ [Title]        [Actions → ] (if provided)  │
│ [Description]                              │
│ ─────────────────────────────────────────  │ (divider)
│ [Content]                                  │
└────────────────────────────────────────────┘
```

**CSS:**
- Border: `1px solid --border`
- Background: `--card`
- Radius: `--radius-xl` (12px)
- Shadow: `--shadow-xs`
- Padding (header): `px-6 py-4`
- Padding (content): `px-6 py-5`
- Border between header & content: `border-b --border`

**Responsive:**
- Header stacks on mobile if actions exceed width
- Title remains bold; description wraps

### 5.2 FormField

**Purpose:** Label + input wrapper with validation feedback.

**Props:**
- `label: string` — Field label (14px / 500)
- `htmlFor?: string` — Input id for accessibility
- `required?: boolean` — Shows red asterisk if true
- `hint?: string` — Helper text (12px / 400, `--muted-foreground`)
- `children: ReactNode` — Input component

**Rendering:**
```
┌────────────────────────────┐
│ Organization Name *        │ (required marker in primary color)
│ [Input field...]           │
│ Hint: Legal company name   │ (if provided, 12px gray)
└────────────────────────────┘
```

**Spacing:**
- Gap between label and input: `gap-1.5` (6px)
- Gap between input and hint: `gap-1.5` (6px)

### 5.3 TextInput

**Purpose:** Single-line text input field.

**Props:**
- `id?: string`
- `placeholder?: string`
- `value?: string`
- `onChange?: (value: string) => void`
- `disabled?: boolean`
- `error?: string` — Shows error message in red
- `maxLength?: number`

**CSS:**
- Border: `1px solid --input`
- Background: `--surface` / `--surface-muted` (if disabled)
- Height: `h-10` (40px, accessible for touch)
- Padding: `px-3 py-2` (12px / 8px)
- Font: 15px / 400 weight
- Radius: `--radius-sm` (4px)
- Focus ring: `focus-visible:ring-2 --ring` (orange)
- Placeholder: `--muted-foreground`

**Responsive:** No special responsive behavior; maintains 40px height on all screens.

### 5.4 SelectInput

**Purpose:** Dropdown selection.

**Props:**
- `id?: string`
- `value?: string`
- `onChange?: (value: string) => void`
- `options: { value: string; label: string }[]`
- `disabled?: boolean`

**CSS:**
- Same as TextInput (40px height, matching borders)
- Shows default browser dropdown
- Keyboard accessible: Tab, Arrow keys

### 5.5 TextArea

**Purpose:** Multi-line text input.

**Props:**
- `id?: string`
- `placeholder?: string`
- `value?: string`
- `onChange?: (value: string) => void`
- `rows?: number` (default: 4)
- `maxLength?: number`

**CSS:**
- Height: `40px + (rows × 20px)` (adjusts for content)
- Padding: `px-3 py-2`
- Radius: `--radius-sm`
- Resize: Vertical only (no horizontal distortion)
- Min-height: 100px (4 rows default)

### 5.6 ReadField

**Purpose:** Display read-only label + value pair.

**Props:**
- `label: string` — Field label (12px / 600, uppercase, `--muted-foreground`)
- `value: ReactNode` — Field value (14px / 500, `--foreground`)

**Rendering:**
```
┌──────────────────────┐
│ ORGANIZATION NAME    │ (12px uppercase gray)
│ Gaps to Growth Inc   │ (14px bold dark)
└──────────────────────┘
```

**Spacing:** `gap-1.5` between label and value.

### 5.7 Badge

**Purpose:** Status or category indicator.

**Props:**
- `tone?: 'navy' | 'orange' | 'success' | 'warning' | 'destructive' | 'outline'`
- `icon?: ReactNode` (optional)
- `children: ReactNode`

**Variants:**

| Tone | Background | Text | Border |
|---|---|---|---|
| `navy` | `--brand` | `--brand-foreground` | — |
| `orange` | `--primary` | `--primary-foreground` | — |
| `success` | `--success` | `--success-foreground` | — |
| `warning` | `--warning` | `--warning-foreground` | — |
| `destructive` | `--destructive` | `--destructive-foreground` | — |
| `outline` | transparent | `--foreground` | `1px --border` |

**CSS:**
- Padding: `px-3 py-1` (8px × 4px)
- Radius: `--radius-md` (8px)
- Font: 12px / 500
- Icon: 14px, margin right `--space-1`

### 5.8 Button

**Purpose:** Primary, secondary, or tertiary action.

**Props:**
- `variant?: 'default' | 'secondary' | 'outline' | 'ghost'`
- `size?: 'default' | 'sm' | 'lg'`
- `disabled?: boolean`
- `onClick?: () => void`
- `children: ReactNode`

**Variants:**

| Variant | Background | Text | Border |
|---|---|---|---|
| `default` | `--primary` | `--primary-foreground` | — |
| `secondary` | `--secondary` | `--secondary-foreground` | — |
| `outline` | transparent | `--foreground` | `1px --border` |
| `ghost` | transparent | `--foreground` | — |

**CSS:**
- Default size: `h-10 px-4` (40px height, 16px padding)
- Radius: `--radius-md`
- Font: 14px / 500
- Transition: `all 200ms` ease
- Hover: Shadow, background shift
- Focus: `ring-2 --ring`
- Disabled: `opacity-50`, cursor not-allowed

### 5.9 AccessDenied

**Purpose:** Display when user lacks permission.

**Props:**
- `role: string` — User's role (e.g., "Employee")

**Rendering:**
```
┌────────────────────────────────────────┐
│ 🔒 Access Restricted                   │
├────────────────────────────────────────┤
│ Your role as Employee does not have    │
│ permission to view this page. Contact  │
│ your administrator if you believe this │
│ is an error.                           │
│                                        │
│ [← Back to Dashboard]                  │
└────────────────────────────────────────┘
```

**CSS:**
- Centered layout, full-height container
- Icon (Lock, 32px, `--muted-foreground`)
- Title (20px / 600)
- Message (14px / 400, `--muted-foreground`)
- Button: Secondary style

---

## 6. Functional Requirements

### 6.1 Organization Information — Functional Spec

#### 6.1.1 View Mode (Read-Only / HR)

**Precondition:** User role = HR OR Admin in view-only scenario.

**Flow:**
1. Page loads with `role` prop
2. `getAccess('organization-information', role)` returns `'view'` or `'full'`
3. If `'view'`: All form fields render as `<ReadField>` (non-interactive)
4. Edit button hidden
5. "View Only" badge appears next to organization type
6. User can scroll, expand sections, but cannot modify data

**Data Source:** `ORG_PROFILE` from `gtg-org-data.ts`

#### 6.1.2 Edit Mode (Admin Only)

**Precondition:** User role = Admin, `access = 'full'`.

**Flow:**
1. Page loads in view mode
2. User clicks "Edit Information" button
3. `editing` state → `true`
4. All ReadField components become FormField + TextInput/SelectInput
5. Edit button replaced with [Cancel] + [Save Changes]
6. Form fields prepopulate with current values
7. User modifies one or more fields
8. On **Save Changes**:
   - Client-side validation runs
   - If valid: Show success toast, exit edit mode, refresh data (or update local state)
   - If invalid: Display error toast with field-level errors, remain in edit mode
9. On **Cancel**: Discard changes, exit edit mode

**Validation Rules:**
- Organization Name: Required, max 255 chars
- Status: Required
- Email: Valid email if provided
- Phone: Valid phone format if provided
- Website: Valid URL if provided

#### 6.1.3 Logo Upload (Admin)

**Flow:**
1. User clicks "Upload Logo" button (in Company Logo card)
2. File input opens (accepts `image/*`)
3. User selects image
4. Image previews (200×200px, centered)
5. Delete button appears below preview
6. On Save Changes, logo sent to backend
7. On Delete: Logo removed from preview, persisted on save

**Constraints:**
- Max file size: 5MB
- Allowed formats: JPG, PNG, GIF, WebP
- Aspect ratio: Any (cropped to square in preview)

#### 6.1.4 Data Persistence

**Current:** LocalStorage (mock); **Future:** API call to `/api/organization/profile`

**Request Shape:**
```json
{
  "organizationName": "...",
  "legalEntityName": "...",
  "taxId": "...",
  "organizationType": "...",
  "status": "Active|Inactive|Draft",
  "primaryContact": "...",
  "email": "...",
  "phone": "...",
  "website": "...",
  "address": { "line1": "...", "city": "...", ... },
  "logoUrl": "..." (if uploaded)
}
```

**Response Shape:**
```json
{
  "success": true,
  "data": { /* updated org profile */ },
  "message": "Organization profile updated successfully"
}
```

---

### 6.2 Add Organization Detail — Functional Spec

#### 6.2.1 Form Flow (Multi-Step Wizard)

**Precondition:** User role = Admin.

**Initial State:** Step 1 of 3, all fields empty or default values.

**Step 1: Operational Details**
1. Display form fields:
   - Industry Classification (dropdown, required)
   - Company Size (radio group, required)
   - Annual Revenue (dropdown, optional)
   - Primary Business Unit (text input, optional)
2. Buttons: [Cancel] [Next →]
3. On **Next**: Validate Step 1 fields, advance to Step 2 if valid
4. On **Cancel**: Confirm "Discard form and return to Organization Information?" → redirect

**Step 2: Infrastructure & Governance**
1. Display form fields:
   - Reporting Structure (dropdown, required)
   - Quality Standards (checkbox group, optional)
   - Compliance Framework (multi-select, optional)
   - Audit Trail Required (toggle, optional)
2. Buttons: [Cancel] [← Previous] [Next →]
3. On **Previous**: Return to Step 1 (preserve entered data)
4. On **Next**: Validate Step 2, advance to Step 3

**Step 3: Integration & Systems** (Final)
1. Display form fields:
   - ERP System (dropdown, optional)
   - HRIS Connected (toggle, optional)
   - Learning Platform (dropdown, optional)
   - Data Sync Frequency (dropdown, optional)
2. Buttons: [Cancel] [← Previous] [Save Draft] [Save & Publish]
3. On **Save Draft**: Save form data (no validation), show success, redirect
4. On **Save & Publish**: Validate all steps, save to database, activate, redirect

#### 6.2.2 Step Progress Indicator

**Visual:** Horizontal progress bar or numbered steps (1/2/3).

**Behavior:**
- Current step: Filled circle (navy)
- Completed steps: Checkmark or filled
- Upcoming steps: Empty circle (gray)
- Non-clickable (no step jumping)

**CSS:**
```html
<div className="flex items-center gap-2">
  <!-- Step 1 -->
  <div className="flex size-8 items-center justify-center rounded-full bg-brand text-white font-semibold">1</div>
  <div className="h-0.5 flex-1 bg-border" />
  
  <!-- Step 2 -->
  <div className="flex size-8 items-center justify-center rounded-full border-2 border-border text-muted-foreground font-semibold">2</div>
  <div className="h-0.5 flex-1 bg-border" />
  
  <!-- Step 3 -->
  <div className="flex size-8 items-center justify-center rounded-full border-2 border-border text-muted-foreground font-semibold">3</div>
</div>
```

#### 6.2.3 Form Validation

**Step 1:**
- Industry Classification: Required
- Company Size: Required
- Annual Revenue: Optional
- Primary Business Unit: Optional, max 255 chars

**Step 2:**
- Reporting Structure: Required
- Quality Standards: Optional (checkboxes)
- Compliance Framework: Optional (multi-select)
- Audit Trail Required: Optional (toggle)

**Step 3:**
- ERP System: Optional
- HRIS Connected: Optional (toggle)
- Learning Platform: Optional
- Data Sync Frequency: Optional

**Error Display:**
- Below each field: Error message (12px, `--destructive`)
- Field border turns red (`--destructive`)
- Summary error above form: "Please fix errors before proceeding"

#### 6.2.4 Data Persistence

**On Save Draft:**
```json
{
  "step": 1,
  "status": "draft",
  "formData": { /* all entered data */ }
}
```

**On Save & Publish:**
```json
{
  "step": 3,
  "status": "published",
  "formData": { /* all entered data */ }
}
```

**Response:**
```json
{
  "success": true,
  "organizationDetailId": "uuid",
  "message": "Organization detail saved successfully"
}
```

---

## 7. Accessibility (WCAG 2.1 AA Compliance)

### 7.1 Structure & Semantics

- Page title (h1): Single per page, describes content
- Section titles (h2, h3): Hierarchical structure
- Form labels: `<label htmlFor="inputId">` for all inputs
- Required fields: Marked with aria-required or asterisk + text "required"
- Buttons: Semantic `<button>` or `<a role="button">`
- Links: Descriptive link text (not "Click here")

### 7.2 Color & Contrast

- All text: WCAG AA (4.5:1) contrast ratio minimum
- Form fields: 3:1 border contrast
- Status badges: Icon + text (not color-only)
- Error messages: Red text + icon, never color alone

### 7.3 Keyboard Navigation

- Tab order: Logical (left-to-right, top-to-bottom)
- Focus visible: Always visible outline (orange `--ring`)
- Form fields: Tab through all inputs
- Buttons: Enter/Space activates
- Modals/drawers: Focus trap, return to trigger on close
- Dropdowns: Arrow keys navigate options

### 7.4 Screen Reader

- Page regions: `<main>`, `<nav>`, `<header>` landmarks
- Form sections: `<fieldset>` + `<legend>`
- Icons: `aria-hidden="true"` for decorative
- Interactive icons: `aria-label` (e.g., "Edit Information")
- Status changes: Live regions or explicit announcements
- Errors: `aria-describedby` links to error message
- Loading states: `aria-busy="true"` + spinner

### 7.5 Mobile Accessibility

- Touch targets: Minimum 44×44px (buttons, links)
- Form inputs: 40px height (not smaller than 12px)
- Labels above inputs (not placeholder-only)
- Error messages: Clear, easy to read
- No hover-only interactions

---

## 8. Performance Considerations

### 8.1 Page Load

- Initial bundle: < 150KB gzipped (GTG + Organization pages)
- CSS: Tokenized, no inline styles (Tailwind)
- Images: Optimized (WebP preferred, fallback JPG)
- Logo preview: Max 200×200px, lazy-loaded if below fold

### 8.2 Form Interactions

- Input validation: Debounced (300ms) or on blur
- Dropdown filtering: Debounced (300ms)
- Auto-save drafts: Throttled (1 save per 10s)
- No unnecessary re-renders: Controlled inputs only

### 8.3 Asset Optimization

- Tailwind CSS: Purged to used classes only
- Icons: Lucide React (tree-shakeable, SVG)
- Fonts: System fonts or single Google Font (Inter)
- No external scripts (analytics, tracking) on form pages

---

## 9. Security & Data Protection

### 9.1 Input Validation

- All user inputs validated server-side
- No client-only validation (security through obscurity)
- Sanitize HTML inputs (no `<script>` injection)
- Email/phone/URL format checks

### 9.2 Authorization

- Role-based access enforced on backend
- No data exposure if user lacks permission
- Audit log: Who edited what, when
- Sensitive fields (Tax ID) masked on display

### 9.3 Session Management

- Session tokens: Secure, HTTPOnly cookies
- Logout clears session
- Idle timeout: Redirect to login if inactive > 30 min
- CSRF protection: Token in form submission

---

## 10. Testing Strategy

### 10.1 Unit Tests

- Form validation logic (each field rule)
- Role-based access control (getAccess function)
- Data formatting (address, phone)

### 10.2 Integration Tests

- Edit mode toggle (view → edit → save)
- Multi-step form progression (Step 1 → 2 → 3)
- Logo upload flow
- Validation error display

### 10.3 E2E Tests

- Admin creates/edits organization
- HR views organization (read-only)
- Employee redirected to dashboard
- Form submit triggers API call

### 10.4 Accessibility Tests

- axe, Lighthouse, WAVE
- Keyboard-only navigation
- Screen reader walkthrough (NVDA, JAWS)
- Mobile device testing (touch targets, spacing)

---

## 11. Responsive Test Cases

### 11.1 Desktop (1440px)

**Test:** Organization Information page
- [ ] Sidebar expanded (260px)
- [ ] 3-column grid displays
- [ ] Logo card + facts visible
- [ ] All sections full-width below
- [ ] Horizontal scroll not present

**Test:** Add Organization Detail
- [ ] Step indicator horizontal
- [ ] Form fields 2-column
- [ ] Buttons inline at bottom

### 11.2 Tablet (768px)

**Test:** Organization Information
- [ ] Sidebar collapsed to icon rail (72px)
- [ ] 1-column layout (full-width cards)
- [ ] All content visible without horizontal scroll
- [ ] Padding adjusted (--space-4)

**Test:** Add Organization Detail
- [ ] Form fields 1-column
- [ ] Step indicator adapts
- [ ] Buttons stack or wrap

### 11.3 Mobile (375px)

**Test:** Organization Information
- [ ] Off-canvas sidebar
- [ ] Breadcrumb collapses to current page
- [ ] Page title 24px / 600
- [ ] Action buttons stack vertically
- [ ] Cards full-width
- [ ] Horizontal scroll: None
- [ ] Touch targets: All ≥44px

**Test:** Add Organization Detail
- [ ] Form fields full-width
- [ ] Labels above inputs
- [ ] Sticky footer actions
- [ ] Step indicator simplified or numeric only

---

## 12. Error Handling & Edge Cases

### 12.1 Validation Errors

**Scenario:** User submits form with blank required field

**Behavior:**
- Form does not submit
- Field border turns red (`--destructive`)
- Error message displays below field (12px, red)
- Focus moves to first invalid field
- Toast notification: "Please fix errors and try again"

### 12.2 Network Errors

**Scenario:** API call fails during save

**Behavior:**
- Save button disabled during request
- On failure: Toast error, form remains, user can retry
- Offline scenario: LocalStorage fallback (show warning)

### 12.3 Authorization Errors

**Scenario:** Non-Admin visits Add Organization Detail

**Behavior:**
- AccessDenied component displays immediately
- No form fields rendered
- Back button navigates to Organization Information

### 12.4 Logo Upload Errors

**Scenario:** File size > 5MB or unsupported format

**Behavior:**
- Validation message: "File must be ≤5MB and JPG/PNG/GIF/WebP"
- Preview not updated
- User can retry with different file

---

## 13. Future Enhancements

- Export organization profile (PDF)
- Bulk import sister companies (CSV)
- Approve/reject organization detail submissions
- Audit trail viewer (who changed what, when)
- Organization hierarchy visualization
- Integration with external APIs (LinkedIn, D&B)
- Real-time collaboration (multiple admins editing)
- Workflow approval gates for detail submissions

---

## 14. Documentation & References

**Related Documents:**
- GTG Design System Documentation
- GTG Master Application Layout Specification
- GTG Architecture Reference (Permission Flowchart, Cross-Role Flow)
- GTG Component Library
- GTG Auth Foundation

**Dependencies:**
- React 19+ (Server & Client Components)
- Tailwind CSS v4 (GTG tokens)
- Lucide React (Icons)
- Next.js 16 (App Router)

**File Structure:**
```
/components/org/
├── organization-information.tsx    # Main component
├── add-organization-detail.tsx     # Multi-step form
├── gtg-ui.tsx                      # Primitives (SectionCard, FormField, etc.)
└── ...

/lib/
├── gtg-org-data.ts                 # Mock data
├── gtg-roles.ts                    # Role model & permissions
└── ...

/docs/
├── gtg-org-profile-uxspec.md       # This file
└── ...
```

---

**Document Status:** Ready for Development  
**Last Reviewed:** 2026-01-12  
**Next Review:** Post-launch (feedback incorporation)
