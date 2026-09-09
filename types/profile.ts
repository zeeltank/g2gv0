/**
 * The shape of an employee's own profile screen.
 *
 * ── WHY THIS MOVED OUT OF lib/mock-data ─────────────────────────────────────
 *
 * These types lived in `lib/mock-data/profile.ts` beside a `mockProfile`
 * fixture - "Alex Morgan", "alex.morgan@company.com", "123 Main Street, San
 * Francisco". Eight live files imported the TYPE from that path, so every one of
 * them read as though the profile screen were still running on invented data.
 *
 * It is not: `profile-dashboard.tsx` loads the signed-in person's real record.
 * The fixture was rendered nowhere and has been deleted; only the shape is kept,
 * and it now lives with the other types.
 */

export type TabId = 'personal' | 'address' | 'reporting' | 'attendance' | 'bank' | 'skills'

export interface Profile {
  id: string
  fullName: string
  mobileNumber: string
  email: string
  department: string
  dob: string
  jobRole: string
  gender: string
  joinYear: string
  address1: string
  address2: string
  city: string
  state: string
  pincode: string
  reporting: Array<{
    supervisorType: string
    employeeName: string
    reportingMethod: string
  }>
  attendance: Array<{
    day: string
    login: string
    logout: string
  }>
  bankDetails: {
    bankName: string
    branchName: string
    accountNumber: string
    ifscCode: string
    amount: string
    transferType: string
  }
  skills: Array<{
    jobrole_skill_id: number
    jobrole: string
    skill: string
    skill_id: number
    title?: string
    category?: string
    sub_category?: string
    description?: string
    proficiency_level?: string
    knowledge?: string[]
    ability?: string[]
    behaviour?: string[]
    attitude?: string[]
  }>
}

export interface ProfileProps {
  user?: {
    id: string
    name: string
    email: string
    role: string
  }
}
