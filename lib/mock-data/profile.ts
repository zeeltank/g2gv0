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

export const mockProfile = {
  id: '1',
  fullName: 'Alex Morgan',
  mobileNumber: '+1 234 567 8900',
  email: 'alex.morgan@company.com',
  department: 'Engineering',
  dob: '1990-05-15',
  jobRole: 'Senior Software Engineer',
  gender: 'Male',
  joinYear: '2020-01-10',
  address1: '123 Main Street',
  address2: 'Apt 4B',
  city: 'San Francisco',
  state: 'California',
  pincode: '94102',
  reporting: [
    { supervisorType: 'Direct', employeeName: 'Sarah Wilson', reportingMethod: 'Formal' },
    { supervisorType: 'Function', employeeName: 'James Chen', reportingMethod: 'Informal' },
  ],
  attendance: [
    { day: 'Monday', login: '09:00 AM', logout: '06:00 PM' },
    { day: 'Tuesday', login: '09:00 AM', logout: '06:00 PM' },
    { day: 'Wednesday', login: '09:00 AM', logout: '06:00 PM' },
    { day: 'Thursday', login: '09:00 AM', logout: '06:00 PM' },
    { day: 'Friday', login: '09:30 AM', logout: '06:30 PM' },
    { day: 'Saturday', login: '09:00 AM', logout: '01:00 PM' },
  ],
  bankDetails: {
    bankName: 'HDFC Bank',
    branchName: 'Main Branch',
    accountNumber: '1234567890',
    ifscCode: 'HDFC0001234',
    amount: '5,000.00',
    transferType: 'NEFT',
  },
  skills: [
    {
      jobrole_skill_id: 54313,
      jobrole: 'Nurse Manager',
      skill: 'Nursing Productivity and Innovation',
      skill_id: 1241,
    },
    {
      jobrole_skill_id: 54315,
      jobrole: 'Nurse Manager',
      skill: 'Emergency Response and Crisis Management',
      skill_id: 2552,
      title: 'Emergency Response and Crisis Management',
      category: 'Technical Skills',
      sub_category: 'Domain-Specific',
      description: 'Support, implement and develop emergency response and crisis management plans and policies',
      proficiency_level: '4',
      knowledge: [
        'Role and responsibilities of emergency response teams',
        'Incident command system protocols',
        'Crisis communication procedures',
      ],
      ability: [
        'Coordinate multi-disciplinary response teams',
        'Develop and drill emergency action plans',
        'Assess incident severity and escalate appropriately',
      ],
      behaviour: [
        'Remains calm under pressure during crisis situations',
        'Proactively identifies potential emergency scenarios',
        'Models compliance with safety protocols',
      ],
      attitude: [
        'Demonstrates commitment to safety-first mindset',
        'Shows accountability for preparedness outcomes',
        'Encourages continuous improvement in response procedures',
      ],
    },
  ],
}
