# GTG Organization Management - 4 Complete Screens

## Overview
This document provides a comprehensive guide to the 4 generated pages for the Organization Management module in the GTG HRMS platform. All screens use the GTG Design System, existing components, and follow the permission matrix strictly.

## Page 1: Organization Information

**Route:** `/organization/information`

### Features
- **View Mode**: Display all organization details with proper formatting
- **Edit Mode** (Admin only): Full editing capabilities for all fields
- **Company Details Section**: 
  - Company Name, Code, Registration Number
  - Industry, Organization Type, Website
  - Fully editable in admin edit mode

- **Logo Management**:
  - Brand gradient logo preview
  - Upload new logo button (Admin only)
  - Founded year and total employees display

- **Contact Information**:
  - Email, Phone, Fax
  - Edit mode for admins
  - Icon-based display with mail/phone icons

- **Registered Address**:
  - Full address with city, state, postal code, country
  - Edit mode allows comprehensive address updates
  - Properly formatted display in view mode

- **Sister Companies Section**:
  - Grid display of subsidiaries and branches
  - Company badges with type indicators
  - Employee count and location information
  - Add Sister Company button (Admin only)

- **Organization Structure Preview**:
  - Visual tree view of top-level departments
  - Quick link to full Department Hierarchy view
  - Shows reporting structure overview

### Permissions
- **Admin**: Full access, view and edit modes
- **HR**: View-only access with "View Only" badge
- **Department Head/Employee**: Access Denied

### Components Used
- `SectionCard` for content organization
- `ReadField` for view-mode displays
- `FormField`, `TextInput`, `SelectInput`, `TextArea` for edit forms
- `Badge` for organization type and access level indicators

---

## Page 2: Add Organization Detail

**Route:** `/organization/add-detail`

### Features
7-Step Guided Form for creating organizations/branches/subsidiaries:

#### Step 1: Basic Information
- Organization Name (required)
- Organization Code (required)
- Entity Type selector (New Organization, Branch, Subsidiary)
- Industry selection

#### Step 2: Registration Details
- Registration Number (required)
- Tax Identification Number
- Date of Incorporation
- Organization Type (Private Limited, Public Limited, LLP)

#### Step 3: Contact Information
- Email Address (required)
- Phone Number
- Website
- Fax (optional)

#### Step 4: Address Information
- Address Line 1 (required)
- Address Line 2
- City (required)
- State/Province
- Postal Code
- Country (required with selector)

#### Step 5: Branch Details
- Parent Organization selector
- Branch Manager assignment
- Operational Notes (TextArea)

#### Step 6: Subsidiary Details
- Ownership Percentage
- Holding Company selector
- Governance Notes (TextArea)

#### Step 7: Logo Upload
- Drag-and-drop logo upload
- Support for PNG, JPG, SVG up to 2MB
- Recommended 512×512 size

### Actions
- Cancel button (returns without saving)
- Save Draft button (saves form state)
- Save & Publish button (finalizes entry)
- Footer action bar with all three options

### Permissions
- **Admin Only**: Full access
- **HR/Department Head/Employee**: Access Denied

### Design Elements
- Step icons and numbers for visual progression
- Section Cards for logical grouping
- Color-coded step headers with icons
- Clear form layout with responsive grid

---

## Page 3: Department List

**Route:** `/organization/departments`

### Features

#### Table Columns
1. Department Name (with Building icon)
2. Parent Department
3. HOD (Head of Department)
4. Employees (employee count)
5. Status (badge with color)
6. Created Date (formatted as DD MMM YYYY)
7. Actions (context-specific)

#### Filters & Search
- **Search Bar**: Search by department name, parent department, or HOD
- **HOD Filter**: Dropdown to filter by specific HOD
- **Status Filter**: Filter by Active, Inactive, Draft, or All

#### Pagination
- Page size: 8 departments per page
- Previous/Next buttons
- Numbered page buttons
- Result summary showing "Showing X to Y of Z departments"

#### Sorting
- Clickable column headers for sorting
- Sort indicators (up/down chevrons)
- Sorts by: Name, Parent, HOD, Employees, Status, Created

#### Actions (Admin/HR)
- Assign HOD button (UserPlus icon)
- Edit button (Pencil icon)
- Delete button (Trash icon, danger red on hover)

#### Special Features
- Department Head sees only own department
- "View only" badge for non-admin users
- "Own Department Only" badge for Department Heads
- Department counter badge

#### Empty State
- Building icon with "No departments found" message
- Suggestion to adjust search/filters

### Permissions
- **Admin/HR**: Full access (manage, add, edit, delete, export)
- **Department Head**: View own department only
- **Employee**: Access Denied

### Components Used
- `SectionCard` for table wrapper
- `Badge` and `StatusBadge` for status indicators
- `SelectInput` for filters
- Icon buttons for row actions
- Custom search input with icon

---

## Page 4: Department Hierarchy

**Route:** `/organization/hierarchy`

### Features

#### Tree Structure Visualization
- **Root Nodes**: Top-level departments with brand gradient background
- **Child Nodes**: Sub-departments with secondary background
- **Nested Levels**: Support for multiple hierarchy levels
- **Expandable/Collapsible**: Chevron buttons to toggle visibility

#### Node Information Display
- Department Name
- HOD Information ("HOD: [Name]" or "HOD unassigned")
- Employee count (with Users icon)
- Status badge (Active/Inactive/Draft)

#### Node Styling
- Gradient backgrounds for root departments
- Color-coded depth levels
- Hover effects for interactivity
- Grip handle for dragging (Admin/HR only)

#### Controls
- **Expand All Button**: Opens all hierarchy nodes
- **Collapse All Button**: Closes all hierarchy nodes
- Individual expand/collapse chevrons per node

#### Drag & Drop
- Admin/HR only feature
- Grip vertical icon shows on hover
- Allows reordering of departments
- Maintains hierarchy while reordering

#### Information Display
- Total node count badge
- "Drag to Reorder" badge (for admin/HR)
- Comprehensive description based on role

### Permissions
- **Admin/HR**: Full access with drag-and-drop reordering
- **Department Head**: View-only access
- **Employee**: Access Denied

### Components Used
- `SectionCard` for main container
- `StatusBadge` for department status
- `Badge` for metadata display
- Recursive `TreeNode` component for hierarchy rendering
- Custom tree navigation with keyboard support

---

## Technical Implementation

### Architecture Compliance
✓ Uses ONLY existing GTG components
✓ Uses ONLY GTG Design Tokens
✓ Uses ONLY GTG Colors (Navy, Orange, Grays)
✓ Uses ONLY GTG Typography (Inter font)
✓ Uses ONLY GTG Spacing (4px base unit)
✓ Follows GTG Master Application Layout
✓ Maintains enterprise HRMS experience

### Component Library
- `OrganizationInformation` - Full org info display and editing
- `AddOrganizationDetail` - Multi-step form for org creation
- `DepartmentList` - Searchable, filterable table
- `DepartmentHierarchy` - Interactive tree view with drag-drop

### Routing
- `/organization/information` - Org Information
- `/organization/add-detail` - Add Organization Detail
- `/organization/departments` - Department List
- `/organization/hierarchy` - Department Hierarchy

### Authentication & Access
- All pages check user authentication
- Role-based access control via `getAccess()` function
- `AccessDenied` component for unauthorized access
- Proper role-based UI element visibility

### Responsive Design
- Mobile-first approach
- Tablet optimization (768px breakpoint)
- Desktop layouts (1440px+ viewports)
- Touch-friendly action buttons
- Collapsible/expandable sections for mobile

---

## Permission Matrix Summary

| Role | Org Info | Add Detail | Dept List | Hierarchy |
|------|----------|-----------|-----------|-----------|
| Admin | Full Edit | Full Create | Full Manage | Full + Reorder |
| HR | View Only | View Only | Full Manage | View Only |
| Dept Head | Access Denied | Access Denied | Own Dept Only | Own Dept View |
| Employee | Access Denied | Access Denied | Access Denied | Access Denied |

---

## GTG Design Compliance

### Colors Used
- `bg-brand` - Primary navy color
- `text-brand` - Brand text color
- `bg-secondary` - Secondary gray
- `bg-surface` - Light surface
- `bg-danger` - For delete actions
- `text-muted-foreground` - Secondary text
- `border-border` - Consistent borders

### Typography
- Heading: `text-3xl font-bold` for page titles
- Subheading: `text-base font-semibold` for sections
- Body: `text-sm` for content
- Label: `text-xs font-semibold uppercase` for labels
- Font family: Inter (via `font-sans`)

### Spacing
- Page padding: `px-4 py-8 sm:px-6 lg:px-8`
- Section gaps: `gap-6`
- Content gaps: `gap-3` to `gap-5`
- Button spacing: `gap-2`

### Components
- All UI elements from existing GTG component library
- No new components created
- Consistent with existing patterns

---

## Generated Screens

All 4 screens have been successfully generated and tested:

1. Organization Information - READY
2. Add Organization Detail - READY
3. Department List - READY
4. Department Hierarchy - READY

Routes are accessible and fully functional with proper authentication and authorization checks in place.
